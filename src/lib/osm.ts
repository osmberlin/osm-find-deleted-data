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

/** Link to the full edit history of an object (creation → … → deletion). */
export function osmHistoryUrl(ref: OsmRef): string {
  return `${BASE}/${ref.type}/${ref.id}/history`
}

/** Link to the object page itself. */
export function osmObjectUrl(ref: OsmRef): string {
  return `${BASE}/${ref.type}/${ref.id}`
}

/** Link to a changeset (shows the user who made the edit). */
export function osmChangesetUrl(changesetId: number): string {
  return `${BASE}/changeset/${changesetId}`
}
