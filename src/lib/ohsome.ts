import { z } from 'zod'
import type { Geometry } from 'geojson'
import type { Bbox } from './bbox'
import { bboxToOhsomeParam } from './bbox'
import { parseOsmId, type OsmRef } from './osm'

export const OHSOME_BASE = 'https://api.ohsome.org/v1'

/** The inputs that define a query (all of these also live in the URL). */
export interface OhsomeQuery {
  bbox: Bbox
  filter: string
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

/**
 * Build the ohsome `contributions/geometry` request URL.
 * We always ask for tags + contributionTypes + metadata so we can show the
 * deletion flag, the changeset, and the object's tags.
 */
export function buildContributionsUrl(q: OhsomeQuery): string {
  const params = new URLSearchParams({
    bboxes: bboxToOhsomeParam(q.bbox),
    filter: q.filter,
    time: `${q.from},${q.to}`,
    properties: 'tags,contributionTypes,metadata',
    clipGeometry: 'false',
  })
  return `${OHSOME_BASE}/contributions/geometry?${params.toString()}`
}

// --- Response parsing -------------------------------------------------------
// Properties are kept loose: ohsome adds tag keys plus @-prefixed metadata, and
// we don't want unknown keys to fail validation.

const ContributionFeature = z.object({
  type: z.literal('Feature'),
  geometry: z.unknown().nullable(),
  properties: z.record(z.string(), z.unknown()).nullable(),
})

const ContributionsResponse = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(ContributionFeature),
})

export type ContributionsResponse = z.infer<typeof ContributionsResponse>
export type ContributionFeature = z.infer<typeof ContributionFeature>

/** ohsome error envelope, returned with non-2xx status. */
const OhsomeError = z.object({
  status: z.number().optional(),
  message: z.string().optional(),
})

export class OhsomeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'OhsomeApiError'
  }
}

export async function fetchContributions(
  q: OhsomeQuery,
  signal?: AbortSignal,
): Promise<ContributionsResponse> {
  const res = await fetch(buildContributionsUrl(q), {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = OhsomeError.parse(await res.json())
      if (body.message) detail = body.message
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new OhsomeApiError(detail, res.status)
  }
  return ContributionsResponse.parse(await res.json())
}

// --- Deletion extraction ----------------------------------------------------

export interface Deletion {
  osmId: string
  ref: OsmRef | null
  /** ISO timestamp of the deletion contribution. */
  timestamp: string | undefined
  changesetId: number | undefined
  version: number | undefined
  /** Tags from the last known state of the object (before deletion). */
  tags: Record<string, string>
  /** Last known location, derived from a non-deletion contribution. May be absent. */
  lon: number | undefined
  lat: number | undefined
}

const prop = (f: ContributionFeature, key: string): unknown => f.properties?.[key]
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

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
    walk((geometry as { coordinates?: unknown }).coordinates)
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

const nonTagKey = (k: string) => !k.startsWith('@')

function tagsOf(f: ContributionFeature): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(f.properties ?? {})) {
    if (nonTagKey(k) && typeof v === 'string') out[k] = v
  }
  return out
}

/**
 * Reduce a contributions FeatureCollection to the deletions, deriving each
 * deleted object's last-known location and tags from its other contributions
 * in the same result set (deletion features themselves carry no geometry).
 */
export function extractDeletions(fc: ContributionsResponse): Deletion[] {
  const byId = new Map<string, ContributionFeature[]>()
  for (const f of fc.features) {
    const id = str(prop(f, '@osmId'))
    if (!id) continue
    const list = byId.get(id)
    if (list) list.push(f)
    else byId.set(id, [f])
  }

  const deletions: Deletion[] = []
  for (const [osmId, features] of byId) {
    const deletionFeatures = features.filter((f) => prop(f, '@deletion') === true)
    if (deletionFeatures.length === 0) continue

    // Latest geometry-bearing contribution → representative location.
    const located = features
      .filter((f) => f.geometry)
      .sort((a, b) => (str(prop(b, '@timestamp')) ?? '').localeCompare(str(prop(a, '@timestamp')) ?? ''))
    const point = located.length ? representativePoint(located[0]!.geometry as Geometry) : null

    // Tags from the highest-version contribution that has any tags.
    const tagged = features
      .filter((f) => Object.keys(tagsOf(f)).length > 0)
      .sort((a, b) => (num(prop(b, '@version')) ?? 0) - (num(prop(a, '@version')) ?? 0))
    const tags = tagged.length ? tagsOf(tagged[0]!) : {}

    for (const del of deletionFeatures) {
      deletions.push({
        osmId,
        ref: parseOsmId(osmId),
        timestamp: str(prop(del, '@timestamp')),
        changesetId: num(prop(del, '@changesetId')),
        version: num(prop(del, '@version')),
        tags,
        lon: point ? point[0] : undefined,
        lat: point ? point[1] : undefined,
      })
    }
  }

  // Most recent deletions first.
  deletions.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
  return deletions
}
