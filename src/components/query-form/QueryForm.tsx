import { useEffect, useState } from 'react'
import type { AppSearch } from '../../search-schema'
import { type Bbox, isValidBbox, bboxAreaKm2, bboxToOhsomeParam } from '../../lib/bbox'
import { buildContributionsUrl } from '../../lib/ohsome'
import type { DataExtent } from '../../lib/ohsome-metadata'
import { StepBadge } from '../StepBadge'

const FILTER_EXAMPLE = 'amenity=bench and type:node'
const AREA_WARN_KM2 = 25

interface Props {
  search: AppSearch
  extent: DataExtent | undefined
  canRun: boolean
  isRunning: boolean
  drawing: boolean
  onToggleDraw: () => void
  onPatch: (patch: Partial<AppSearch>) => void
  onRun: () => void
}

const numOrEmpty = (n: number | undefined) => (n === undefined ? '' : String(n))

export function QueryForm({
  search,
  extent,
  canRun,
  isRunning,
  drawing,
  onToggleDraw,
  onPatch,
  onRun,
}: Props) {
  // Local string state for the four bbox fields so partial/invalid edits don't
  // wipe the URL. We push a valid bbox up as soon as all four parse.
  const [fields, setFields] = useState(() => bboxFields(search.bbox))
  useEffect(() => setFields(bboxFields(search.bbox)), [search.bbox])

  const setField = (i: 0 | 1 | 2 | 3, value: string) => {
    const next = [...fields] as [string, string, string, string]
    next[i] = value
    setFields(next)
    const nums = next.map((v) => Number(v.trim()))
    if (next.every((v) => v.trim() !== '') && nums.every(Number.isFinite)) {
      onPatch({ bbox: nums as Bbox })
    }
  }

  const bbox = search.bbox as Bbox | undefined
  const bboxValid = bbox ? isValidBbox(bbox) : false
  const areaKm2 = bbox && bboxValid ? bboxAreaKm2(bbox) : null
  const url =
    canRun && bbox
      ? buildContributionsUrl({
          bbox,
          filter: (search.filter ?? '').trim(),
          from: search.from!,
          to: search.to!,
        })
      : null

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (canRun) onRun()
      }}
    >
      {/* Step 1: Filter */}
      <label className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <StepBadge n={1} />
          ohsome filter
        </span>
        <input
          type="text"
          className="rounded border-gray-300 text-sm shadow-sm"
          placeholder={FILTER_EXAMPLE}
          value={search.filter ?? ''}
          onChange={(e) => onPatch({ filter: e.target.value })}
          aria-label="ohsome filter"
        />
        <span className="text-xs text-gray-500">
          Example: <code className="rounded bg-gray-100 px-1">{FILTER_EXAMPLE}</code> —{' '}
          <a
            className="text-blue-600 underline"
            href="https://docs.ohsome.org/ohsome-api/v1/filter.html"
            target="_blank"
            rel="noreferrer"
          >
            filter syntax
          </a>
        </span>
      </label>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">From</span>
          <input
            type="date"
            className="rounded border-gray-300 text-sm shadow-sm"
            value={search.from ?? ''}
            min={extent?.from}
            max={extent?.to}
            onChange={(e) => onPatch({ from: e.target.value || undefined })}
            aria-label="From date"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">To</span>
          <input
            type="date"
            className="rounded border-gray-300 text-sm shadow-sm"
            value={search.to ?? ''}
            min={extent?.from}
            max={extent?.to}
            onChange={(e) => onPatch({ to: e.target.value || undefined })}
            aria-label="To date"
          />
        </label>
      </div>
      <div className="-mt-2 flex items-center gap-3 text-xs">
        <span className="text-gray-500">Quick range:</span>
        <button
          type="button"
          className="text-blue-600 underline"
          onClick={() => onPatch(presetRange('month', extent))}
        >
          last month
        </button>
        <button
          type="button"
          className="text-blue-600 underline"
          onClick={() => onPatch(presetRange('year', extent))}
        >
          last year
        </button>
      </div>
      {extent && (
        <p className="text-xs text-gray-500">
          ohsome data available {extent.from} → {extent.to}. The end date must be within this range.
        </p>
      )}

      {/* Step 2: Bbox */}
      <fieldset className="flex flex-col gap-2">
        <legend className="flex items-center gap-2 text-sm font-medium">
          <StepBadge n={2} />
          Bounding box
        </legend>
        <p className="text-xs text-gray-500">
          Set the area to search — draw it on the map, or open the coordinates below. Both stay in sync.
        </p>
        <button
          type="button"
          onClick={onToggleDraw}
          className={`self-start rounded px-3 py-1.5 text-sm font-medium shadow-sm ${
            drawing
              ? 'bg-blue-600 text-white'
              : 'border border-blue-600 text-blue-700 hover:bg-blue-50'
          }`}
        >
          {drawing ? 'ⓘ Click and drag in the map' : 'Draw area'}
        </button>

        <details className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
          <summary className="cursor-pointer text-xs text-gray-600">
            Bbox: <span className="font-mono">{bbox ? bboxToOhsomeParam(bbox).replaceAll(',', ', ') : 'not set'}</span>
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['minLon', 'minLat', 'maxLon', 'maxLat'] as const).map((label, i) => (
              <label key={label} className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">{label}</span>
                <input
                  type="number"
                  step="any"
                  className="rounded border-gray-300 text-sm shadow-sm"
                  value={fields[i]}
                  onChange={(e) => setField(i as 0 | 1 | 2 | 3, e.target.value)}
                  aria-label={label}
                />
              </label>
            ))}
          </div>
          {bbox && !bboxValid && (
            <p className="mt-2 text-xs text-red-600">
              Invalid box: min must be less than max, longitude ∈ [-180, 180], latitude ∈ [-90, 90].
            </p>
          )}
        </details>

        {areaKm2 !== null && areaKm2 > AREA_WARN_KM2 && (
          <p className="text-xs text-amber-600">
            Large area (~{areaKm2.toFixed(0)} km²). This may be a heavy query — consider narrowing it.
          </p>
        )}
      </fieldset>

      {/* Step 3: Search */}
      <button
        type="submit"
        disabled={!canRun || isRunning}
        className="flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        <StepBadge n={3} className="bg-white text-blue-600" />
        {isRunning ? 'Finding deletions…' : 'Find deletions'}
      </button>

      {url && <GeneratedUrl url={url} />}
    </form>
  )
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Build a "last month" / "last year" range. The end is anchored to the latest
 * available data (so it's always a valid ohsome end date), falling back to today
 * before the data extent has loaded.
 */
function presetRange(period: 'month' | 'year', extent: DataExtent | undefined) {
  const to = extent?.to ? new Date(`${extent.to}T00:00:00Z`) : new Date()
  const from = new Date(to)
  if (period === 'year') from.setUTCFullYear(from.getUTCFullYear() - 1)
  else from.setUTCMonth(from.getUTCMonth() - 1)
  return { from: isoDay(from), to: isoDay(to) }
}

function bboxFields(bbox: AppSearch['bbox']): [string, string, string, string] {
  const b = bbox as Bbox | undefined
  return [numOrEmpty(b?.[0]), numOrEmpty(b?.[1]), numOrEmpty(b?.[2]), numOrEmpty(b?.[3])]
}

function GeneratedUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Generated ohsome request</span>
        <button
          type="button"
          className="text-xs text-blue-600 underline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block max-h-24 overflow-y-auto rounded bg-gray-50 p-2 font-mono text-[11px] break-all text-gray-700"
      >
        {url}
      </a>
    </div>
  )
}
