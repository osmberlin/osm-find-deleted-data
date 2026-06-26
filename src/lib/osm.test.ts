import { describe, it, expect } from 'vitest'
import { parseOsmId, osmHistoryUrl, osmObjectUrl, osmChangesetUrl } from './osm'

describe('parseOsmId', () => {
  it('parses node/way/relation ids', () => {
    expect(parseOsmId('node/967694075')).toEqual({
      type: 'node',
      id: 967694075,
      raw: 'node/967694075',
    })
    expect(parseOsmId('way/123')?.type).toBe('way')
    expect(parseOsmId('relation/9')?.type).toBe('relation')
  })
  it('rejects junk', () => {
    expect(parseOsmId('bench/1')).toBeNull()
    expect(parseOsmId('node/')).toBeNull()
    expect(parseOsmId('node/abc')).toBeNull()
    expect(parseOsmId(undefined)).toBeNull()
    expect(parseOsmId('')).toBeNull()
  })
})

describe('OSM urls', () => {
  const ref = parseOsmId('node/967694075')!
  it('builds a history url', () => {
    expect(osmHistoryUrl(ref)).toBe('https://www.openstreetmap.org/node/967694075/history')
  })
  it('appends a #map hash when coords are known (deleted objects have no location on OSM)', () => {
    expect(osmHistoryUrl(ref, { lat: 52.764051, lon: 13.271388 })).toBe(
      'https://www.openstreetmap.org/node/967694075/history#map=18/52.764051/13.271388',
    )
  })
  it('omits the hash when coords are missing or invalid', () => {
    expect(osmHistoryUrl(ref, undefined)).toBe(
      'https://www.openstreetmap.org/node/967694075/history',
    )
    expect(osmHistoryUrl(ref, { lat: NaN, lon: 13 })).toBe(
      'https://www.openstreetmap.org/node/967694075/history',
    )
  })
  it('builds an object url', () => {
    expect(osmObjectUrl(ref)).toBe('https://www.openstreetmap.org/node/967694075')
  })
  it('builds a changeset url', () => {
    expect(osmChangesetUrl(89852551)).toBe('https://www.openstreetmap.org/changeset/89852551')
  })
})
