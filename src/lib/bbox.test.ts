import { describe, it, expect } from 'vitest'
import {
  type Bbox,
  isValidBbox,
  normalizeBbox,
  bboxToOhsomeParam,
  parseBbox,
  bboxCorners,
  moveCorner,
  bboxAreaKm2,
} from './bbox'

const hasenheide: Bbox = [13.4115, 52.4845, 13.428, 52.4905]

describe('isValidBbox', () => {
  it('accepts a well-formed box', () => {
    expect(isValidBbox(hasenheide)).toBe(true)
  })
  it('rejects min >= max', () => {
    expect(isValidBbox([13.428, 52.4845, 13.4115, 52.4905])).toBe(false)
    expect(isValidBbox([13.4115, 52.4905, 13.428, 52.4845])).toBe(false)
  })
  it('rejects out-of-range coordinates', () => {
    expect(isValidBbox([-181, 0, 1, 1])).toBe(false)
    expect(isValidBbox([0, -91, 1, 1])).toBe(false)
  })
  it('rejects NaN', () => {
    expect(isValidBbox([NaN, 0, 1, 1])).toBe(false)
  })
})

describe('normalizeBbox', () => {
  it('orders swapped corners into min/max', () => {
    expect(normalizeBbox([13.428, 52.4905, 13.4115, 52.4845])).toEqual([
      13.4115, 52.4845, 13.428, 52.4905,
    ])
  })
})

describe('bboxToOhsomeParam / parseBbox', () => {
  it('round-trips', () => {
    const param = bboxToOhsomeParam(hasenheide)
    expect(param).toBe('13.4115,52.4845,13.428,52.4905')
    expect(parseBbox(param)).toEqual([13.4115, 52.4845, 13.428, 52.4905])
  })
  it('clamps precision', () => {
    expect(bboxToOhsomeParam([1.123456789, 2, 3, 4])).toBe('1.12346,2,3,4')
  })
  it('returns null for malformed input', () => {
    expect(parseBbox('')).toBeNull()
    expect(parseBbox('1,2,3')).toBeNull()
    expect(parseBbox('a,b,c,d')).toBeNull()
    expect(parseBbox(undefined)).toBeNull()
  })
})

describe('corners + moveCorner', () => {
  it('lists four corners', () => {
    const corners = bboxCorners(hasenheide)
    expect(corners.map((c) => c.corner)).toEqual(['sw', 'se', 'ne', 'nw'])
    expect(corners[0]).toMatchObject({ lon: 13.4115, lat: 52.4845 })
  })
  it('moving the NE corner only changes max values', () => {
    const moved = moveCorner(hasenheide, 'ne', 13.43, 52.491)
    expect(moved).toEqual([13.4115, 52.4845, 13.43, 52.491])
  })
  it('moving the SW corner only changes min values', () => {
    const moved = moveCorner(hasenheide, 'sw', 13.41, 52.484)
    expect(moved).toEqual([13.41, 52.484, 13.428, 52.4905])
  })
})

describe('bboxAreaKm2', () => {
  it('is small and positive for the example box', () => {
    const km2 = bboxAreaKm2(hasenheide)
    expect(km2).toBeGreaterThan(0)
    expect(km2).toBeLessThan(5)
  })
})
