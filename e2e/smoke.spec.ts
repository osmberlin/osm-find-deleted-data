import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Real v2 ohsome response (GeoParquet) captured once, reused offline. No live API calls in tests.
const parquet = readFileSync(
  fileURLToPath(new URL('../src/lib/__fixtures__/contributions-hasenheide.parquet', import.meta.url)),
)

const metadata = JSON.stringify({
  apiVersion: '2.0.0',
  temporalExtent: { start: '2007-10-08T00:00:00Z', end: '2024-06-01T00:00:00Z' },
})

// Minimal valid MapLibre style → map initializes without fetching any tiles.
const emptyStyle = JSON.stringify({ version: 8, sources: {}, layers: [] })

/** Intercept every external service so the test is fully offline. */
async function mockExternals(page: Page) {
  // Safety net, registered first so the specific mocks below take precedence:
  // anything that is not the local dev server is aborted, never sent out.
  await page.route('**/*', (route) => {
    // blob:/data: URLs (e.g. MapLibre's web worker) never leave the browser.
    const { protocol, hostname } = new URL(route.request().url())
    if (!protocol.startsWith('http')) return route.fallback()
    if (hostname === 'localhost' || hostname === '127.0.0.1') return route.fallback()
    return route.abort()
  })

  await page.route('**/api.heigit.org/ohsome-api/**', async (route) => {
    const request = route.request()
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors })
    }
    if (request.url().includes('/metadata')) {
      return route.fulfill({ contentType: 'application/json', body: metadata, headers: cors })
    }
    return route.fulfill({
      contentType: 'application/vnd.apache.parquet',
      body: parquet,
      headers: cors,
    })
  })
  await page.route('**/tiles.openfreemap.org/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: emptyStyle }),
  )
}

const completeQuery =
  '/?bbox=[13.4115,52.4845,13.428,52.4905]' +
  '&filter=' +
  encodeURIComponent('amenity=bench and type:node') +
  '&from=2020-01-01&to=2024-01-01'

test('empty visit shows the prompt and a disabled run button', async ({ page }) => {
  await mockExternals(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /OSM Find Deleted Data/ })).toBeVisible()
  await expect(page.getByText(/then press/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Find deletions/i })).toBeDisabled()
})

test('a complete shared link auto-runs and lists deletions with history links', async ({ page }) => {
  await mockExternals(page)
  await page.goto(completeQuery)

  // 2 deletions in the fixture.
  await expect(page.getByRole('heading', { name: /2 deletions/ })).toBeVisible()

  // Each row links to the OSM history page in a new tab.
  const historyLink = page.getByRole('link', { name: /^node\/\d+$/ }).first()
  await expect(historyLink).toBeVisible()
  await expect(historyLink).toHaveAttribute('href', /openstreetmap\.org\/node\/\d+\/history/)
  await expect(historyLink).toHaveAttribute('target', '_blank')

  // The editor's username links to their OSM profile.
  const userLink = page.getByRole('link', { name: 'Supaplex030' }).first()
  await expect(userLink).toHaveAttribute('href', 'https://www.openstreetmap.org/user/Supaplex030')

  // Bbox inputs reflect the URL (input side of the bidirectional sync).
  await page.locator('summary', { hasText: 'Bbox:' }).click()
  await expect(page.getByLabel('minLon')).toHaveValue('13.4115')
  await expect(page.getByLabel('maxLat')).toHaveValue('52.4905')

  // The generated ohsome request is shown as a curl command without the real key.
  await expect(page.getByText('FYI: The Generated ohsome API request')).toBeVisible()
  await expect(page.getByText(/curl -H "Authorization: \$OHSOME_API_KEY"/)).toBeVisible()
})

test('hovering a result row highlights it (table <-> map link)', async ({ page }) => {
  await mockExternals(page)
  await page.goto(completeQuery)

  const firstRow = page.locator('tbody tr').first()
  await firstRow.hover()
  await expect(firstRow).toHaveClass(/bg-amber-200/)
})

test('typing a coordinate updates the URL (input → map sync)', async ({ page }) => {
  await mockExternals(page)
  await page.goto(completeQuery)

  // Coordinates live in a collapsible; open it first.
  await page.locator('summary', { hasText: 'Bbox:' }).click()
  await page.getByLabel('maxLon').fill('13.4300')
  await expect.poll(() => new URL(page.url()).search).toContain('13.43')
  // Pretty URLs: arrays stay readable (unencoded brackets), not %5B/%5D.
  expect(new URL(page.url()).search).toContain('bbox=[')
})

test('the map starts without console errors (MapLibre worker loads)', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await mockExternals(page)
  await page.goto(completeQuery)

  await expect(page.getByRole('heading', { name: /2 deletions/ })).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  expect(errors).toEqual([])
})

test('after a rate-limit error, the same query can be run again', async ({ page }) => {
  await mockExternals(page)
  // Registered last, so it wins: the first contributions request is rate limited.
  let calls = 0
  await page.route('**/extraction/contributions.parquet**', (route) => {
    calls += 1
    if (calls === 1) {
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Rate Limit Exceeded' }),
      })
    }
    return route.fallback()
  })
  await page.goto(completeQuery)

  await expect(page.getByText(/Rate limit exceeded/)).toBeVisible()
  await page.getByRole('button', { name: /Find deletions/i }).click()
  await expect(page.getByRole('heading', { name: /2 deletions/ })).toBeVisible()
  expect(calls).toBe(2)
})
