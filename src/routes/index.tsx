import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { searchSchema, type AppSearch } from '../search-schema'
import { type Bbox, isValidBbox } from '../lib/bbox'
import {
  fetchContributions,
  extractDeletions,
  type OhsomeQuery,
  OhsomeApiError,
} from '../lib/ohsome'
import { fetchDataExtent } from '../lib/ohsome-metadata'
import { QueryForm } from '../components/query-form/QueryForm'
import { AreaMap } from '../components/map/AreaMap'
import { ResultsPanel } from '../components/results/ResultsPanel'

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: HomePage,
})

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
    if (q) setApplied(q)
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
  const errorMessage =
    contributions.error instanceof OhsomeApiError
      ? `ohsome API error (${contributions.error.status}): ${contributions.error.message}`
      : contributions.error
        ? String(contributions.error)
        : null

  return (
    <div className="grid h-full grid-rows-[1fr] lg:grid-cols-[minmax(360px,420px)_1fr]">
      {/* Left: controls + results */}
      <section className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white p-4">
        <QueryForm
          search={search}
          extent={extent.data}
          canRun={draftQuery !== null}
          isRunning={contributions.isFetching}
          drawing={drawing}
          onToggleDraw={() => setDrawing((d) => !d)}
          onPatch={patchSearch}
          onRun={() => {
            const q = toOhsomeQuery(search)
            if (q) setApplied(q)
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
