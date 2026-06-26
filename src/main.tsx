import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { routerSearch } from './router-search'
import './styles.css'

// Conservative defaults: never refetch on focus, never auto-retry. Combined with
// the route's `staleTime: Infinity`, each distinct query hits ohsome at most once.
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
})

const router = createRouter({
  routeTree,
  // Matches the Vite `base` so client routing works under /<repo>/ on GitHub Pages.
  basepath: import.meta.env.BASE_URL,
  defaultPreload: 'intent',
  trailingSlash: 'never',
  // Pretty, readable share URLs instead of percent-encoded JSON.
  parseSearch: routerSearch.parse,
  stringifySearch: routerSearch.stringify,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
