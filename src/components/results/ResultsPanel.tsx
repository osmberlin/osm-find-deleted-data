import type { Deletion } from '../../lib/ohsome'
import { osmHistoryUrl, osmChangesetUrl } from '../../lib/osm'
import { downloadGeojson } from './exportGeojson'

interface Props {
  status: 'pending' | 'error' | 'success'
  isFetching: boolean
  hasApplied: boolean
  errorMessage: string | null
  deletions: Deletion[]
}

export function ResultsPanel({ status, isFetching, hasApplied, errorMessage, deletions }: Props) {
  if (!hasApplied) {
    return (
      <Box>
        <p className="text-sm text-gray-500">
          Set an area, an ohsome filter, and a date range, then press{' '}
          <span className="font-medium">Find deletions</span>.
        </p>
      </Box>
    )
  }

  if (isFetching) {
    return (
      <Box>
        <p className="text-sm text-gray-500">Querying ohsome…</p>
      </Box>
    )
  }

  if (status === 'error') {
    return (
      <Box>
        <p className="text-sm text-red-600">{errorMessage ?? 'Request failed.'}</p>
      </Box>
    )
  }

  if (deletions.length === 0) {
    return (
      <Box>
        <p className="text-sm text-gray-600">
          No deletions found for this area, filter, and time range.
        </p>
      </Box>
    )
  }

  const located = deletions.filter((d) => d.lon !== undefined).length
  const unlocated = deletions.length - located

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {deletions.length} deletion{deletions.length === 1 ? '' : 's'}
        </h2>
        <button
          type="button"
          onClick={() => downloadGeojson(deletions)}
          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
        >
          Export GeoJSON
        </button>
      </div>

      {unlocated > 0 && (
        <p className="text-xs text-amber-600">
          {unlocated} deletion{unlocated === 1 ? '' : 's'} can’t be shown on the map (the object was
          created before the start date, so no location is available). Tip: set an earlier start date
          to include each object’s creation.
        </p>
      )}

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-2 py-1 font-medium">Object</th>
              <th className="px-2 py-1 font-medium">Deleted</th>
              <th className="px-2 py-1 font-medium">Changeset</th>
              <th className="px-2 py-1 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {deletions.map((d, i) => (
              <tr key={`${d.osmId}-${i}`} className="border-t border-gray-100 align-top">
                <td className="px-2 py-1">
                  {d.ref ? (
                    <a
                      className="font-mono text-blue-600 underline"
                      href={osmHistoryUrl(d.ref)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.osmId}
                    </a>
                  ) : (
                    <span className="font-mono">{d.osmId}</span>
                  )}
                  {d.lon === undefined && (
                    <span className="ml-1 text-amber-600" title="No location available">
                      ⚑
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">{(d.timestamp ?? '').slice(0, 10)}</td>
                <td className="px-2 py-1">
                  {d.changesetId !== undefined ? (
                    <a
                      className="text-blue-600 underline"
                      href={osmChangesetUrl(d.changesetId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.changesetId}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-1 text-gray-600">{summarizeTags(d.tags)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function summarizeTags(tags: Record<string, string>): string {
  const entries = Object.entries(tags)
  if (entries.length === 0) return '—'
  const shown = entries
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  return entries.length > 3 ? `${shown}, +${entries.length - 3}` : shown
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-gray-200 bg-gray-50 p-3">{children}</div>
}
