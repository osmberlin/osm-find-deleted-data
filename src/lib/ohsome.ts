import { z } from 'zod'
import type { Geometry } from 'geojson'
import type { Bbox } from './bbox'
import { bboxToOhsomeParam } from './bbox'
import { parseOsmId, type OsmRef } from './osm'

/**
 * ohsome API v2. The docs still point at `/v2-rc`, but `/v2` is the server the
 * OpenAPI spec names and keeps working once the release candidate is promoted.
 */
export const OHSOME_BASE = 'https://api.heigit.org/ohsome-api/v2'

/**
 * HeiGIT API key, baked in at build time. It ends up readable in the bundle;
 * that is a deliberate trade-off for a static SPA (see README).
 */
export const OHSOME_API_KEY: string | undefined = import.meta.env.VITE_OHSOME_API_KEY || undefined

/** Headers for every ohsome request; v2 expects the bare key in `Authorization`. */
export function ohsomeHeaders(accept: string): HeadersInit {
  return OHSOME_API_KEY ? { Accept: accept, Authorization: OHSOME_API_KEY } : { Accept: accept }
}

/** The inputs that define a query (all of these also live in the URL). */
export interface OhsomeQuery {
  bbox: Bbox
  filter: string
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

const dayToIso = (day: string) => `${day}T00:00:00Z`

/**
 * Build the ohsome `extraction/contributions.parquet` GET request URL.
 * v2 always returns every column (tags, contribution type, changeset, user),
 * never clips geometries, and takes the time range as `start/end`.
 */
export function buildContributionsUrl(q: OhsomeQuery): string {
  const params = new URLSearchParams({
    aoi: bboxToOhsomeParam(q.bbox),
    filter: q.filter,
    time: `${dayToIso(q.from)}/${dayToIso(q.to)}`,
  })
  return `${OHSOME_BASE}/extraction/contributions.parquet?${params.toString()}`
}

// --- Response parsing -------------------------------------------------------
// The response is GeoParquet. hyparquet decodes it into one object per row,
// with INT64 columns as bigint, timestamps as Date, MAP columns as plain
// objects and the WKB `geom` column as a GeoJSON geometry.

const StringMap = z.record(z.string(), z.string())

const ContributionRow = z.object({
  osm_type: z.string(),
  osm_id: z.bigint(),
  edit_timestamp: z.date(),
  version: z.number(),
  user_name: z.string().nullish(),
  changeset_id: z.bigint(),
  changeset_tags: StringMap.nullish(),
  contribution_type: z.string(),
  tags: StringMap.nullish(),
  tags_before: StringMap.nullish(),
  geom: z.custom<Geometry>((v) => typeof v === 'object' && v !== null && 'type' in v).nullish(),
})

export type ContributionRow = z.infer<typeof ContributionRow>

/** ohsome v2 error envelopes, returned with non-2xx status. */
const OhsomeError = z.union([
  z.object({ error: z.string() }),
  z.object({ detail: z.union([z.string(), z.array(z.object({ msg: z.string() }))]) }),
])

export class OhsomeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'OhsomeApiError'
  }
}

/** Read a non-2xx response into an `OhsomeApiError`, preferring the API's own message. */
export async function toOhsomeApiError(res: Response): Promise<OhsomeApiError> {
  let detail = res.statusText
  try {
    const body = OhsomeError.parse(await res.json())
    if ('error' in body) detail = body.error
    else detail = typeof body.detail === 'string' ? body.detail : body.detail.map((d) => d.msg).join('; ')
  } catch {
    // non-JSON or unknown error body; keep statusText
  }
  return new OhsomeApiError(detail || `HTTP ${res.status}`, res.status)
}

/** Decode a contributions GeoParquet file into validated rows. */
export async function parseContributions(file: ArrayBuffer): Promise<ContributionRow[]> {
  // Loaded on demand: the parquet reader is only needed once a query runs.
  const [{ parquetReadObjects }, { compressors }] = await Promise.all([
    import('hyparquet'),
    import('hyparquet-compressors'),
  ])
  const rows = await parquetReadObjects({ file, compressors })
  return z.array(ContributionRow).parse(rows)
}

export async function fetchContributions(
  q: OhsomeQuery,
  signal?: AbortSignal,
): Promise<ContributionRow[]> {
  const res = await fetch(buildContributionsUrl(q), {
    headers: ohsomeHeaders('application/vnd.apache.parquet'),
    signal,
  })
  if (!res.ok) throw await toOhsomeApiError(res)
  return parseContributions(await res.arrayBuffer())
}

// --- Deletion extraction ----------------------------------------------------

export interface Deletion {
  osmId: string
  ref: OsmRef | null
  /** ISO timestamp of the deletion contribution. */
  timestamp: string
  changesetId: number
  changesetComment: string | undefined
  userName: string | undefined
  version: number
  /** Tags from the last known state of the object (before deletion). */
  tags: Record<string, string>
  /** Last known geometry of the object. */
  geometry: Geometry | undefined
  /** Last known location, for placing a marker. */
  lon: number | undefined
  lat: number | undefined
}

/** A single representative [lon, lat] for any geometry, for placing a marker. */
export function representativePoint(geometry: Geometry | null | undefined): [number, number] | null {
  if (!geometry) return null
  const coords: number[][] = []
  const walk = (c: unknown): void => {
    if (Array.isArray(c)) {
      if (typeof c[0] === 'number' && typeof c[1] === 'number') {
        coords.push([c[0], c[1]])
      } else {
        for (const inner of c) walk(inner)
      }
    }
  }
  if (geometry.type === 'GeometryCollection') {
    for (const g of geometry.geometries) {
      const p = representativePoint(g)
      if (p) coords.push(p)
    }
  } else {
    walk(geometry.coordinates)
  }
  if (coords.length === 0) return null
  let sx = 0
  let sy = 0
  for (const [x, y] of coords) {
    sx += x ?? 0
    sy += y ?? 0
  }
  return [sx / coords.length, sy / coords.length]
}

const isEmpty = (tags: Record<string, string> | null | undefined) =>
  !tags || Object.keys(tags).length === 0

/**
 * Reduce the contributions to the deletions. In v2 a deletion row carries the
 * object's last known geometry and tags itself, so no cross-row lookup is needed.
 */
export function extractDeletions(rows: ContributionRow[]): Deletion[] {
  const deletions = rows
    .filter((r) => r.contribution_type === 'DELETION')
    .map((r): Deletion => {
      const osmId = `${r.osm_type}/${r.osm_id}`
      const point = representativePoint(r.geom)
      return {
        osmId,
        ref: parseOsmId(osmId),
        timestamp: r.edit_timestamp.toISOString(),
        changesetId: Number(r.changeset_id),
        changesetComment: r.changeset_tags?.comment,
        userName: r.user_name ?? undefined,
        version: r.version,
        tags: (isEmpty(r.tags_before) ? r.tags : r.tags_before) ?? {},
        geometry: r.geom ?? undefined,
        lon: point?.[0],
        lat: point?.[1],
      }
    })

  // Most recent deletions first.
  deletions.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return deletions
}
