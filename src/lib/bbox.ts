import bboxPolygon from '@turf/bbox-polygon'
import area from '@turf/area'
import type { Feature, Polygon } from 'geojson'

/** A bounding box as ohsome expects it: [minLon, minLat, maxLon, maxLat]. */
export type Bbox = [number, number, number, number]

export const isLon = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180
export const isLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90

/** A bbox is valid only if it's in range AND min < max on both axes. */
export function isValidBbox(b: Bbox): boolean {
  const [minLon, minLat, maxLon, maxLat] = b
  return (
    isLon(minLon) &&
    isLon(maxLon) &&
    isLat(minLat) &&
    isLat(maxLat) &&
    minLon < maxLon &&
    minLat < maxLat
  )
}

/** Normalize a possibly-swapped box (e.g. from a drag) into min/max order. */
export function normalizeBbox(b: Bbox): Bbox {
  const [a, c, d, e] = b
  return [Math.min(a, d), Math.min(c, e), Math.max(a, d), Math.max(c, e)]
}

/** ohsome `bboxes` value: comma-joined, fixed precision to keep URLs short and stable. */
export function bboxToOhsomeParam(b: Bbox, precision = 5): string {
  return b.map((n) => Number(n.toFixed(precision))).join(',')
}

/** Parse "minLon,minLat,maxLon,maxLat" → Bbox, or null if it isn't four finite numbers. */
export function parseBbox(value: string | undefined | null): Bbox | null {
  if (!value) return null
  const parts = value.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  return parts as Bbox
}

/** GeoJSON rectangle for rendering the bbox as a map layer. */
export function bboxToPolygon(b: Bbox): Feature<Polygon> {
  return bboxPolygon(b)
}

/** Approximate area in km², for warning the user before a huge query. */
export function bboxAreaKm2(b: Bbox): number {
  return area(bboxToPolygon(b)) / 1_000_000
}

/** The four corners, labelled, for rendering drag handles. */
export type Corner = 'sw' | 'se' | 'ne' | 'nw'
export function bboxCorners(b: Bbox): { corner: Corner; lon: number; lat: number }[] {
  const [minLon, minLat, maxLon, maxLat] = b
  return [
    { corner: 'sw', lon: minLon, lat: minLat },
    { corner: 'se', lon: maxLon, lat: minLat },
    { corner: 'ne', lon: maxLon, lat: maxLat },
    { corner: 'nw', lon: minLon, lat: maxLat },
  ]
}

/** Move one corner to a new lng/lat, returning a fresh (un-normalized) bbox. */
export function moveCorner(b: Bbox, corner: Corner, lon: number, lat: number): Bbox {
  const [minLon, minLat, maxLon, maxLat] = b
  switch (corner) {
    case 'sw':
      return [lon, lat, maxLon, maxLat]
    case 'se':
      return [minLon, lat, lon, maxLat]
    case 'ne':
      return [minLon, minLat, lon, lat]
    case 'nw':
      return [lon, minLat, maxLon, lat]
  }
}
