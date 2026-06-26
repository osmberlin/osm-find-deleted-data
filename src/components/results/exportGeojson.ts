import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Deletion } from '../../lib/ohsome'

/**
 * Build a GeoJSON FeatureCollection of the deletions. Located deletions get a
 * Point; deletions whose location couldn't be derived get null geometry (still
 * valid GeoJSON) so nothing is silently dropped.
 */
export function deletionsToGeojson(deletions: Deletion[]): FeatureCollection<Point | null> {
  const features: Feature<Point | null>[] = deletions.map((d) => ({
    type: 'Feature',
    geometry:
      d.lon !== undefined && d.lat !== undefined
        ? { type: 'Point', coordinates: [d.lon, d.lat] }
        : null,
    properties: {
      osmId: d.osmId,
      deletedAt: d.timestamp ?? null,
      changesetId: d.changesetId ?? null,
      version: d.version ?? null,
      ...d.tags,
    },
  }))
  return { type: 'FeatureCollection', features }
}

export function downloadGeojson(deletions: Deletion[], filename = 'osm-deletions.geojson') {
  const blob = new Blob([JSON.stringify(deletionsToGeojson(deletions), null, 2)], {
    type: 'application/geo+json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
