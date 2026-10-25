// @vitest-environment node
// Node env: the parquet fixture is read from disk and decoded by hyparquet.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildContributionsUrl,
  extractDeletions,
  parseContributions,
  representativePoint,
  toOhsomeApiError,
} from './ohsome'

const fixturePath = fileURLToPath(new URL('./__fixtures__/contributions-hasenheide.parquet', import.meta.url))

/** Read the captured v2 GeoParquet response as the ArrayBuffer `fetch` would give us. */
function readFixture(): ArrayBuffer {
  const buf = readFileSync(fixturePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('buildContributionsUrl', () => {
  it('builds the v2 parquet extraction request', () => {
    const url = new URL(
      buildContributionsUrl({
        bbox: [13.4115, 52.4845, 13.428, 52.4905],
        filter: 'amenity=bench and type:node',
        from: '2020-01-01',
        to: '2024-01-01',
      }),
    )
    expect(url.origin + url.pathname).toBe(
      'https://api.heigit.org/ohsome-api/v2/extraction/contributions.parquet',
    )
    expect(url.searchParams.get('aoi')).toBe('13.4115,52.4845,13.428,52.4905')
    expect(url.searchParams.get('filter')).toBe('amenity=bench and type:node')
    expect(url.searchParams.get('time')).toBe('2020-01-01T00:00:00Z/2024-01-01T00:00:00Z')
  })

  it('does not send the v1-only parameters', () => {
    const url = new URL(
      buildContributionsUrl({
        bbox: [0, 0, 1, 1],
        filter: 'highway=primary',
        from: '2020-01-01',
        to: '2021-01-01',
      }),
    )
    expect(url.searchParams.has('properties')).toBe(false)
    expect(url.searchParams.has('clipGeometry')).toBe(false)
    expect(url.searchParams.has('bboxes')).toBe(false)
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

describe('toOhsomeApiError', () => {
  it('uses the `error` message of a v2 error envelope', async () => {
    const res = new Response(JSON.stringify({ error: 'aoi is too large' }), {
      status: 400,
      statusText: 'Bad Request',
    })
    const err = await toOhsomeApiError(res)
    expect(err.name).toBe('OhsomeApiError')
    expect(err.status).toBe(400)
    expect(err.message).toBe('aoi is too large')
  })

  it('joins the `msg` of a validation `detail` array', async () => {
    const res = new Response(
      JSON.stringify({ detail: [{ msg: 'filter is invalid' }, { msg: 'time is invalid' }] }),
      { status: 422, statusText: 'Unprocessable Entity' },
    )
    const err = await toOhsomeApiError(res)
    expect(err.status).toBe(422)
    expect(err.message).toBe('filter is invalid; time is invalid')
  })

  it('accepts a plain string `detail`', async () => {
    const res = new Response(JSON.stringify({ detail: 'Forbidden' }), { status: 403 })
    const err = await toOhsomeApiError(res)
    expect(err.status).toBe(403)
    expect(err.message).toBe('Forbidden')
  })

  it('falls back to the status text for a non-JSON body', async () => {
    const res = new Response('<html>gateway</html>', { status: 502, statusText: 'Bad Gateway' })
    const err = await toOhsomeApiError(res)
    expect(err.status).toBe(502)
    expect(err.message).toBe('Bad Gateway')
  })
})

describe('parseContributions + extractDeletions (real v2 fixture)', () => {
  // Captured from the live v2 API once (72 rows, 2 DELETIONs), then reused offline.
  it('decodes the GeoParquet rows', async () => {
    const rows = await parseContributions(readFixture())
    expect(rows.length).toBe(72)
    expect(rows.filter((r) => r.contribution_type === 'DELETION').length).toBe(2)
  })

  it('extracts exactly the two deletions with their metadata', async () => {
    const deletions = extractDeletions(await parseContributions(readFixture()))
    expect(deletions.map((d) => d.osmId).sort()).toEqual(['node/967694044', 'node/967694075'])

    for (const d of deletions) {
      expect(d.ref).toEqual(expect.objectContaining({ type: 'node' }))
      expect(d.userName).toBe('Supaplex030')
      expect(d.changesetId).toBe(89852551)
      expect(d.changesetComment).toBeTypeOf('string')
      expect(d.tags).toEqual({ amenity: 'bench' })
      expect(d.timestamp).toMatch(/^2020-08-24T/)
      expect(d.geometry?.type).toBe('Point')
      expect(d.lon).toBeTypeOf('number')
      expect(d.lat).toBeTypeOf('number')
      // Both benches are in Berlin-Hasenheide.
      expect(d.lon!).toBeGreaterThan(13.4)
      expect(d.lon!).toBeLessThan(13.45)
      expect(d.lat!).toBeGreaterThan(52.48)
      expect(d.lat!).toBeLessThan(52.5)
    }
  })

  it('sorts most-recent first', async () => {
    const [row] = (await parseContributions(readFixture())).filter(
      (r) => r.contribution_type === 'DELETION',
    )
    const at = (iso: string, id: bigint) => ({ ...row!, osm_id: id, edit_timestamp: new Date(iso) })
    const deletions = extractDeletions([
      at('2021-01-01T00:00:00Z', 1n),
      at('2023-01-01T00:00:00Z', 2n),
      at('2022-01-01T00:00:00Z', 3n),
    ])
    expect(deletions.map((d) => d.osmId)).toEqual(['node/2', 'node/3', 'node/1'])
  })
})
