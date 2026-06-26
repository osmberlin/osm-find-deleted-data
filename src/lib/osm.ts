/** Helpers for turning an ohsome `@osmId` into OpenStreetMap links. */

export type OsmType = 'node' | 'way' | 'relation'

export interface OsmRef {
  type: OsmType
  id: number
  /** Original "node/123" string. */
  raw: string
}

/** Parse an ohsome `@osmId` like "node/967694075". Returns null if unrecognized. */
export function parseOsmId(value: string | undefined | null): OsmRef | null {
  if (!value) return null
  const match = /^(node|way|relation)\/(\d+)$/.exec(value.trim())
  if (!match) return null
  const type = match[1] as OsmType
  const id = Number(match[2])
  if (!Number.isSafeInteger(id)) return null
  return { type, id, raw: value.trim() }
}

const BASE = 'https://www.openstreetmap.org'

/** Default zoom for the map hash on a history link. */
const HISTORY_ZOOM = 18

/**
 * Link to the full edit history of an object (creation → … → deletion).
 *
 * For a deleted object the location no longer exists on OSM, so the map won't
 * center on it. When we know the (last-known) coordinates, append a `#map=`
 * hash so OSM still pans to where the object used to be.
 */
export function osmHistoryUrl(ref: OsmRef, coords?: { lat: number; lon: number }): string {
  const base = `${BASE}/${ref.type}/${ref.id}/history`
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) return base
  const lat = coords.lat.toFixed(6)
  const lon = coords.lon.toFixed(6)
  return `${base}#map=${HISTORY_ZOOM}/${lat}/${lon}`
}

/** Link to the object page itself. */
export function osmObjectUrl(ref: OsmRef): string {
  return `${BASE}/${ref.type}/${ref.id}`
}

/** Link to a changeset (shows the user who made the edit). */
export function osmChangesetUrl(changesetId: number): string {
  return `${BASE}/changeset/${changesetId}`
}
