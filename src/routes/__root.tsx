import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="flex h-full flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className="h-9 w-9"
            width={36}
            height={36}
          />
          OSM Find Deleted Data
          <span className="ml-1 text-sm font-normal text-gray-500">
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
            href="https://dashboard.ohsome.org/en/"
            target="_blank"
            rel="noreferrer"
          >
            HeiGIT
          </a>{' '}
          for providing the preprocessed OSM history data.
        </p>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
