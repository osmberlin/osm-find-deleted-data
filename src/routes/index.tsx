import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { hashKey, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { searchSchema, type AppSearch } from '../search-schema'
import { type Bbox, isValidBbox } from '../lib/bbox'
import {
  fetchContributions,
  extractDeletions,
  type OhsomeQuery,
  OhsomeApiError,
  OHSOME_API_KEY,
} from '../lib/ohsome'
import { fetchDataExtent } from '../lib/ohsome-metadata'
import { QueryForm } from '../components/query-form/QueryForm'
import { AreaMap } from '../components/map/AreaMap'
import { ResultsPanel } from '../components/results/ResultsPanel'

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: HomePage,
})

/** Human-readable text for a failed ohsome request, by HTTP status. */
function describeApiError(error: OhsomeApiError): string {
  switch (error.status) {
    case 401:
      return 'ohsome API key missing or invalid.'
    case 403:
      return 'ohsome API daily quota exceeded (403). Try again tomorrow.'
    case 429:
      return 'Rate limit exceeded (max 15 requests per minute). Try again in a minute.'
    default:
      return `ohsome API error (${error.status}): ${error.message}`
  }
}

/** Build a runnable ohsome query from the URL search, or null if incomplete/invalid. */
function toOhsomeQuery(search: AppSearch): OhsomeQuery | null {
  const { bbox, filter, from, to } = search
  if (!bbox || !isValidBbox(bbox as Bbox)) return null
  if (!filter?.trim() || !from || !to) return null
  return { bbox: bbox as Bbox, filter: filter.trim(), from, to }
}

function HomePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Patch the URL search (the single source of truth) without losing other keys.
  const patchSearch = (patch: Partial<AppSearch>, opts?: { replace?: boolean }) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: opts?.replace ?? false,
    })

  // The query that has been *applied* (submitted). Editing inputs does not change
  // this, so we never refetch on keystroke — only on an explicit submit.
  const [applied, setApplied] = useState<OhsomeQuery | null>(null)

  // Auto-run a shared link once, if it arrives with a complete, valid query.
  const didAutoRun = useRef(false)
  useEffect(() => {
    if (didAutoRun.current) return
    didAutoRun.current = true
    const q = toOhsomeQuery(search)
    if (q && OHSOME_API_KEY) setApplied(q)
    // run-once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contributions = useQuery({
    queryKey: ['contributions', applied],
    queryFn: ({ signal }) => fetchContributions(applied!, signal),
    enabled: applied !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  // Data extent: one cached request per session, used to bound the date inputs.
  const extent = useQuery({
    queryKey: ['ohsome-metadata'],
    queryFn: ({ signal }) => fetchDataExtent(signal),
    enabled: OHSOME_API_KEY !== undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  const deletions = useMemo(
    () => (contributions.data ? extractDeletions(contributions.data) : []),
    [contributions.data],
  )

  // Cross-highlight state shared by the table and the map (ephemeral UI state).
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Draw mode is triggered from the form's step 2 and performed on the map.
  const [drawing, setDrawing] = useState(false)

  const draftQuery = toOhsomeQuery(search)
  // Without a key baked into the build, every request would fail with 401.
  const canRun = draftQuery !== null && OHSOME_API_KEY !== undefined
  const errorMessage =
    contributions.error instanceof OhsomeApiError
      ? describeApiError(contributions.error)
      : contributions.error
        ? String(contributions.error)
        : null

  return (
    <div className="grid h-full grid-rows-[1fr] lg:grid-cols-[minmax(360px,420px)_1fr]">
      {/* Left: controls + results */}
      <section className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white p-4">
        {OHSOME_API_KEY === undefined && (
          <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            This build has no ohsome API key (VITE_OHSOME_API_KEY), so queries are disabled.
          </p>
        )}
        <QueryForm
          search={search}
          extent={extent.data}
          canRun={canRun}
          isRunning={contributions.isFetching}
          drawing={drawing}
          onToggleDraw={() => setDrawing((d) => !d)}
          onPatch={patchSearch}
          onRun={() => {
            const q = toOhsomeQuery(search)
            if (!q || !canRun) return
            // The same query again only refetches after a failure (e.g. a rate
            // limit); successful results stay cached so each search runs once.
            if (contributions.isError && hashKey([q]) === hashKey([applied])) {
              void contributions.refetch()
            } else {
              setApplied(q)
            }
          }}
        />
        <ResultsPanel
          status={contributions.status}
          isFetching={contributions.isFetching}
          hasApplied={applied !== null}
          errorMessage={errorMessage}
          deletions={deletions}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={setHoveredId}
          onSelect={setSelectedId}
        />

        <footer className="mt-4 flex flex-col gap-1 border-t border-gray-200 pt-4 text-xs text-gray-500">
          <a
            className="text-blue-600 underline"
            href="https://github.com/osmberlin/osm-find-deleted-data"
            target="_blank"
            rel="noreferrer"
          >
            Code on GitHub
          </a>
          <a
            className="text-blue-600 underline"
            href="https://github.com/osmberlin/osm-find-deleted-data#alternative-approaches"
            target="_blank"
            rel="noreferrer"
          >
            Alternative approaches
          </a>
        </footer>
      </section>

      {/* Right: map */}
      <section className="relative min-h-[320px]">
        <AreaMap
          search={search}
          deletions={deletions}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={setHoveredId}
          onSelect={setSelectedId}
          drawing={drawing}
          onDrawingChange={setDrawing}
          onBboxChange={(bbox) => patchSearch({ bbox })}
          onCameraChange={(cam) => patchSearch(cam, { replace: true })}
        />
      </section>
    </div>
  )
}
