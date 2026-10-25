import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Deletion } from '../../lib/ohsome'

/**
 * Build a GeoJSON FeatureCollection of the deletions. Each deletion keeps its
 * last known geometry from ohsome; deletions without one get null geometry
 * (still valid GeoJSON) so nothing is silently dropped.
 */
export function deletionsToGeojson(deletions: Deletion[]): FeatureCollection<Geometry | null> {
  const features: Feature<Geometry | null>[] = deletions.map((d) => ({
    type: 'Feature',
    geometry: d.geometry ?? null,
    // Tags first, so an OSM tag like `version=*` can't overwrite our metadata.
    properties: {
      ...d.tags,
      osmId: d.osmId,
      deletedAt: d.timestamp,
      changesetId: d.changesetId,
      changesetComment: d.changesetComment ?? null,
      userName: d.userName ?? null,
      version: d.version,
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
