import { z } from 'zod'
import { OHSOME_BASE } from './ohsome'

/**
 * ohsome `/metadata` describes the loaded OSM data, including the temporal
 * extent. The `to` timestamp is the latest date a query may use.
 */
const Metadata = z.object({
  extractRegion: z.object({
    temporalExtent: z.object({
      fromTimestamp: z.string(),
      toTimestamp: z.string(),
    }),
  }),
})

export interface DataExtent {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
}

const toDay = (iso: string): string => iso.slice(0, 10)

export async function fetchDataExtent(signal?: AbortSignal): Promise<DataExtent> {
  const res = await fetch(`${OHSOME_BASE}/metadata`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`ohsome metadata failed: ${res.status}`)
  const meta = Metadata.parse(await res.json())
  return {
    from: toDay(meta.extractRegion.temporalExtent.fromTimestamp),
    to: toDay(meta.extractRegion.temporalExtent.toTimestamp),
  }
}
