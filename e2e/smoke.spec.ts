import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Real ohsome response captured once, reused offline. No live API calls in tests.
const fixture = readFileSync(
  fileURLToPath(new URL('../src/lib/__fixtures__/contributions-hasenheide.json', import.meta.url)),
  'utf8',
)

const metadata = JSON.stringify({
  extractRegion: {
    temporalExtent: { fromTimestamp: '2007-10-08T00:00:00Z', toTimestamp: '2024-06-01T00:00:00Z' },
  },
})

// Minimal valid MapLibre style → map initializes without fetching any tiles.
const emptyStyle = JSON.stringify({ version: 8, sources: {}, layers: [] })

/** Intercept every external service so the test is fully offline. */
async function mockExternals(page: Page) {
  await page.route('**/api.ohsome.org/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/metadata')) {
      return route.fulfill({ contentType: 'application/json', body: metadata })
    }
    return route.fulfill({ contentType: 'application/json', body: fixture })
  })
  await page.route('**/tiles.openfreemap.org/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: emptyStyle }),
  )
}

const completeQuery =
  '/?bbox=[13.4115,52.4845,13.428,52.4905]' +
  '&filter=' +
  encodeURIComponent('amenity=bench and type:node') +
  '&from=2018-01-01&to=2024-01-01'

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

  // 3 deletions in the fixture.
  await expect(page.getByRole('heading', { name: /3 deletions/ })).toBeVisible()

  // Each row links to the OSM history page in a new tab.
  const historyLink = page.getByRole('link', { name: /^node\/\d+$/ }).first()
  await expect(historyLink).toBeVisible()
  await expect(historyLink).toHaveAttribute('href', /openstreetmap\.org\/node\/\d+\/history/)
  await expect(historyLink).toHaveAttribute('target', '_blank')

  // Bbox inputs reflect the URL (input side of the bidirectional sync).
  await expect(page.getByLabel('minLon')).toHaveValue('13.4115')
  await expect(page.getByLabel('maxLat')).toHaveValue('52.4905')

  // The generated ohsome request is shown for transparency.
  await expect(page.getByText('FYI: The Generated ohsome API request')).toBeVisible()
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
