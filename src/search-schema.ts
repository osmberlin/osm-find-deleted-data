import { z } from 'zod'

/**
 * Every shareable decision lives in the URL. This schema is the single source of
 * truth, validated by TanStack Router's `validateSearch`.
 *
 *  - bbox:   the area, as [minLon, minLat, maxLon, maxLat]
 *  - filter: free-form ohsome filter (e.g. "amenity=bench and type:node")
 *  - from/to: query time window (YYYY-MM-DD)
 *  - z/lat/lng: map camera (written on move-end, so a link restores the view)
 */
export const searchSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().catch(undefined),
  filter: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  z: z.number().optional().catch(undefined),
  lat: z.number().optional().catch(undefined),
  lng: z.number().optional().catch(undefined),
})

export type AppSearch = z.infer<typeof searchSchema>
