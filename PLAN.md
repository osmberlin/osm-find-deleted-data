# OSM Find Deleted Data — Plan

A small **single-page web app** that finds OSM object **deletions** in an area using the
[ohsome API](https://docs.ohsome.org/ohsome-api/v1/), replacing the manual
"download GeoJSON → open in QGIS → filter `@deletion` → look up `@osmId`" workflow.

Deployed as a **static SPA on GitHub Pages** — no backend required.

---

## 1. What the app does

Automates this manual workflow:

1. Define an **area** (bbox), a **time range**, and an **ohsome filter** (e.g. `amenity=bench and type:node`).
2. Query the ohsome `contributions/geometry` endpoint.
3. Keep only features where **`@deletion` is `true`**.
4. For each deletion, show the **(former) OSM ID** with a deep link to the object **history**
   (`https://www.openstreetmap.org/{type}/{id}/history`), plus map + table view.

### Reference request (from the source notes)

```
https://api.ohsome.org/v1/contributions/geometry
  ?bboxes=13.4115,52.4845,13.4280,52.4905        # minLon,minLat,maxLon,maxLat (Hasenheide, Berlin)
  &filter=amenity%3Dbench%20and%20type%3Anode
  &time=2020-01-01,2026-02-19                     # start,end (YYYY-MM-DD); end ≤ data extent
  &properties=tags,contributionTypes,metadata     # metadata → last editor/changeset for the table
  &clipGeometry=false
```

Response is a GeoJSON `FeatureCollection`; deletions are features with `@deletion: true`,
carrying `@osmId` like `node/967694075`.

---

## 2. Tech stack (FMC `tech-stack` skill, SPA profile)

| Concern        | Choice |
|----------------|--------|
| Runtime/PM     | **Bun** (`minimumReleaseAge = 5`) |
| Build          | **Vite 8+**, React Compiler |
| Language       | **TypeScript 7.x**, dual tsconfig (app + scripts) |
| UI             | **React 19** |
| Routing        | **TanStack Router** in **SPA / client-only mode** (no TanStack Start — keeps it server-free) |
| Server data    | **TanStack Query** (fetch ohsome; no raw `useEffect` fetching) |
| URL state      | Route `validateSearch` + **Zod 4** (shareable, bookmarkable queries) |
| Client state   | **Zustand** only if needed (likely not — URL state covers it) |
| Styling        | **Tailwind CSS** + `@tailwindcss/forms`, `tailwind-merge` |
| Map            | **`react-map-gl/maplibre`** + **OpenFreeMap** basemap |
| Geo            | per-function `@turf/*` (bbox/area helpers), `@types/geojson` |
| Validation     | **Zod 4** |
| Lint/format    | **oxlint** + **oxfmt** |
| Unit tests     | **Vitest** |
| E2E            | **Playwright** (one smoke test) |
| CI/Deploy      | **GitHub Actions → GitHub Pages** |

> Why SPA, not TanStack Start: the ohsome API is public and CORS-enabled, so there is no
> server logic to run. A static SPA is the simplest thing that deploys to Pages.

---

## 3. UI

Two-pane layout:

- **Left — Query panel**
  - **Free-form ohsome filter** text input, with **example syntax shown next to it**
    (e.g. `amenity=bench and type:node`) so users learn the format. Starts empty.
  - Start / end date pickers; end date validated against ohsome **data extent** (`/metadata`).
  - Bbox: editable text fields **and** drawn on the map; the two stay in sync.
  - "Find deletions" button; live **generated ohsome URL** with a copy button (transparency).
- **Right — Map** (`react-map-gl/maplibre`, see §3a)
  - Draw / resize / drag the **bbox rectangle**; this is the primary way to set the area.
  - Deletion features rendered as a `<Source>`/`<Layer>`; click → highlights the matching table row.
- **Below / panel — Results table**
  - Columns: OSM ID, type, last-known timestamp, **last editor** (via `properties=metadata`).
  - Each row links to the OSM **history** page in a new tab.
  - **Export** the filtered deletions as `.geojson`.
  - Loading / empty / error states from TanStack Query.

All inputs live in the URL (`validateSearch`) so a query is shareable as a link.

### 3a. Map setup & bbox editing (react-map-gl/maplibre)

Per the FMC `react-map-gl` skill — **declarative only**, no imperative `map.addSource`/`map.on`:

- Import from `react-map-gl/maplibre`; include `maplibre-gl/dist/maplibre-gl.css`.
- Wrap in `<MapProvider>`; access the instance via `useMap()` keyed by map `id`.
- **Basemap:** OpenFreeMap style (Maptiler fallback). `attributionControl={false}` + child `<AttributionControl>`.
- **Camera:** uncontrolled `initialViewState` seeded from URL; write `zoom/lat/lng` back on `onMoveEnd`
  with `history: 'replace'` (so panning doesn't spam history, but the view is shareable).
- **Bbox rectangle:** rendered as a `<Source type="geojson">` (a Polygon from the bbox) + sibling
  `<Layer>` (fill + outline). Corner/edge **drag handles** are a second geojson source of points;
  dragging updates the bbox. Guard map reads with `useMapLoaded()`.
- **Deletions:** one `<Source>` for the GeoJSON results + `<Layer>` siblings; layer id in
  `interactiveLayerIds`, read `event.features` in the `<Map onClick>` prop. Highlight the
  clicked/selected feature via `setFeatureState` (truth stays in React/URL state, cleared before re-apply).

### 3b. Bidirectional bbox ↔ input sync

The bbox lives in **one source of truth: the URL** (`bbox` search param, `minLon,minLat,maxLon,maxLat`).

- **Input → map:** editing the four number fields updates the URL → map re-derives the rectangle Polygon
  and (optionally) fits/keeps the view.
- **Map → input:** drawing/dragging the rectangle on the map updates the URL → the number fields re-render.
- Both directions write the **same Zod-validated `bbox` param**, so they can never drift. Invalid/partial
  input (e.g. min > max) is flagged inline and does not overwrite a valid map state.

---

## 4. Project structure (FMC conventions)

```
src/
  routes/
    __root.tsx
    index.tsx              # the single search route (validateSearch = Zod schema)
  components/
    query-form/            # filter, dates, bbox inputs, presets, generated-URL
    map/                   # MapLibre map, bbox draw, deletion markers
    results/               # table, row → OSM history link, GeoJSON export
    layouts/
  lib/
    ohsome.ts              # URL builder + fetch + response Zod types
    ohsome-metadata.ts     # data extent (for end-date validation)
    osm.ts                 # history-link helpers, @osmId parsing
    bbox.ts                # bbox <-> string, turf helpers
  search-schema.ts         # Zod schema for URL search params (TanStack Router validateSearch)
.github/workflows/deploy.yml
```

---

### 4a. URL state (TanStack Router — single source of truth)

The index route's `validateSearch` is a Zod schema; **every shareable decision is a search param**:

```ts
// search-schema.ts
const Search = z.object({
  bbox:   z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(), // minLon,minLat,maxLon,maxLat
  filter: z.string().optional(),                 // free-form ohsome filter
  from:   z.string().optional(),                 // YYYY-MM-DD
  to:     z.string().optional(),                 // YYYY-MM-DD
  // map camera (written on onMoveEnd, history: 'replace')
  z: z.number().optional(), lat: z.number().optional(), lng: z.number().optional(),
})
```

- Read with `Route.useSearch()`; write with `navigate({ search })`.
- Form edits + map drags both call `navigate` → URL is the only place state lives → the whole query
  (area, filter, dates, view) is captured in a **copy-pasteable link**.
- Camera changes use `history: 'replace'`; query-defining edits use a normal push so back/forward work.

---

## 5. Implementation milestones

1. **Scaffold** — Bun + Vite + React 19 + TS + Tailwind + oxlint/oxfmt; TanStack Router (SPA) + TanStack Query providers.
2. **ohsome client** — typed URL builder + fetch + Zod response parsing; **Vitest** unit tests for URL building and deletion filtering.
3. **URL state + query form** — Zod `validateSearch` (§4a) as the single source of truth; filter/date/bbox
   number inputs all read/write search params; live generated ohsome URL + copy.
4. **Map + bidirectional bbox** — `react-map-gl/maplibre` + OpenFreeMap (declarative `<Source>`/`<Layer>`,
   `<MapProvider>`/`useMap`); draggable bbox rectangle with **input↔map sync** via the shared `bbox` param;
   camera seeded from URL, written on `onMoveEnd`; deletion features as a layer.
5. **Results** — deletion filter (`@deletion === true`), table, OSM history links, GeoJSON export; loading/empty/error states.
6. **Robustness** — `/metadata` extent check + end-date guard; large-bbox / large-result warning.
7. **Deploy** — GitHub Actions → Pages; Vite `base` = repo name; copy `index.html`→`404.html` for SPA routing.
8. **E2E** — one Playwright smoke test (load → run sample query → see deletions → history link present).

---

## 6. GitHub Pages deployment notes

- Static build (`vite build`) → `dist/`; deploy via official Pages Actions.
- Set Vite `base: '/osm-find-deleted-data/'` for project pages.
- Add `404.html` = `index.html` so client-side routes resolve on Pages.
- ohsome API is queried **directly from the browser** (public + CORS) — no proxy, no secrets.

---

## 7. Decisions (resolved)

- **Filter:** free-form ohsome filter input with example syntax shown alongside it. No preset dropdown.
- **First load:** empty form (no pre-filled example).
- **Editor column:** included, via `properties=metadata`.
- **Repo / Pages path:** `osm-find-deleted-data` → Vite `base: '/osm-find-deleted-data/'`.
