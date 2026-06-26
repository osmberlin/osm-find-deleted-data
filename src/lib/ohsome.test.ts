import { describe, it, expect } from 'vitest'
import {
  buildContributionsUrl,
  extractDeletions,
  representativePoint,
  type ContributionsResponse,
} from './ohsome'
import fixture from './__fixtures__/contributions-hasenheide.json'

const fc = fixture as unknown as ContributionsResponse

describe('buildContributionsUrl', () => {
  it('encodes all required params', () => {
    const url = new URL(
      buildContributionsUrl({
        bbox: [13.4115, 52.4845, 13.428, 52.4905],
        filter: 'amenity=bench and type:node',
        from: '2020-01-01',
        to: '2024-01-01',
      }),
    )
    expect(url.pathname).toBe('/v1/contributions/geometry')
    expect(url.searchParams.get('bboxes')).toBe('13.4115,52.4845,13.428,52.4905')
    expect(url.searchParams.get('filter')).toBe('amenity=bench and type:node')
    expect(url.searchParams.get('time')).toBe('2020-01-01,2024-01-01')
    expect(url.searchParams.get('properties')).toBe('tags,contributionTypes,metadata')
    expect(url.searchParams.get('clipGeometry')).toBe('false')
  })
})

describe('representativePoint', () => {
  it('returns the point itself for a Point', () => {
    expect(representativePoint({ type: 'Point', coordinates: [13.42, 52.48] })).toEqual([
      13.42, 52.48,
    ])
  })
  it('averages a LineString', () => {
    const p = representativePoint({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [2, 4],
      ],
    })
    expect(p).toEqual([1, 2])
  })
  it('returns null for missing geometry', () => {
    expect(representativePoint(null)).toBeNull()
    expect(representativePoint(undefined)).toBeNull()
  })
})

describe('extractDeletions (real fixture)', () => {
  const deletions = extractDeletions(fc)

  it('finds exactly the deletions in the fixture', () => {
    // Fixture is known to contain 3 deletion contributions.
    expect(deletions.length).toBe(3)
  })

  it('every deletion has a parsed node ref', () => {
    for (const d of deletions) {
      expect(d.ref?.type).toBe('node')
      expect(d.osmId).toMatch(/^node\/\d+$/)
    }
  })

  it('leaves location undefined when the object was created before the query window', () => {
    // In this fixture (2018–2024) the deleted benches predate the window, so no
    // geometry-bearing contribution is present for them. Extraction must not crash.
    for (const d of deletions) {
      expect(d.lon).toBeUndefined()
      expect(d.lat).toBeUndefined()
    }
  })

  it('sorts most-recent first', () => {
    const ts = deletions.map((d) => d.timestamp ?? '')
    expect([...ts].sort((a, b) => b.localeCompare(a))).toEqual(ts)
  })

  it('ignores objects that were only created/edited, not deleted', () => {
    // 79 features but far fewer deletions.
    expect(deletions.length).toBeLessThan(fc.features.length)
  })
})

describe('extractDeletions (synthetic: creation in window)', () => {
  it('derives the deleted node location from its earlier creation contribution', () => {
    const synthetic = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.42, 52.487] },
          properties: {
            '@osmId': 'node/111',
            '@timestamp': '2021-01-01T00:00:00Z',
            '@version': 1,
            '@creation': true,
            amenity: 'bench',
          },
        },
        {
          type: 'Feature',
          geometry: null,
          properties: {
            '@osmId': 'node/111',
            '@timestamp': '2022-06-01T00:00:00Z',
            '@version': 2,
            '@changesetId': 999,
            '@deletion': true,
          },
        },
      ],
    } as unknown as ContributionsResponse

    const [d] = extractDeletions(synthetic)
    expect(d).toBeDefined()
    expect(d!.lon).toBe(13.42)
    expect(d!.lat).toBe(52.487)
    expect(d!.changesetId).toBe(999)
    expect(d!.tags).toEqual({ amenity: 'bench' })
  })
})
