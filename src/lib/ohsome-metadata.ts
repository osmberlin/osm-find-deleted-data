import { z } from 'zod'
import { OHSOME_BASE, ohsomeHeaders, toOhsomeApiError } from './ohsome'

/**
 * ohsome `/metadata` describes the loaded OSM data, including the temporal
 * extent. The `end` timestamp is the latest date a query may use.
 */
const Metadata = z.object({
  temporalExtent: z.object({
    start: z.string(),
    end: z.string(),
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
    headers: ohsomeHeaders('application/json'),
    signal,
  })
  if (!res.ok) throw await toOhsomeApiError(res)
  const meta = Metadata.parse(await res.json())
  return {
    from: toDay(meta.temporalExtent.start),
    to: toDay(meta.temporalExtent.end),
  }
}
