import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="flex h-full flex-col bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">
          OSM Find Deleted Data
          <span className="ml-2 text-sm font-normal text-gray-500">
            deletions in an area, via the ohsome API
          </span>
        </h1>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
