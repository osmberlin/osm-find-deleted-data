import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="flex h-full flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">
          OSM Find Deleted Data
          <span className="ml-2 text-sm font-normal text-gray-500">
            deletions in an area, via the{' '}
            <a
              className="font-medium text-blue-600 underline"
              href="https://api.ohsome.org"
              target="_blank"
              rel="noreferrer"
            >
              ohsome API
            </a>
          </span>
        </h1>
        <p className="text-right text-xs text-gray-500">
          Thanks to{' '}
          <a
            className="text-blue-600 underline"
            href="https://ohsome-now.heigit.org/"
            target="_blank"
            rel="noreferrer"
          >
            HeiGIT
          </a>{' '}
          for making this possible.
        </p>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
