# OSM Find Deleted Data

A small single-page web app that finds **deleted OpenStreetMap objects** in an area, using the
[ohsome API](https://docs.ohsome.org/ohsome-api/v1/). It replaces the manual
"download GeoJSON → open in QGIS → filter `@deletion` → look up `@osmId`" workflow with a few clicks.

Pick an area on the map (or type coordinates), choose a time range and an ohsome filter, and the app
lists every object that was deleted — each linked to its OpenStreetMap **history** so you can see who
deleted it, when, and in which changeset.

No backend: the browser talks to the public ohsome API directly, and the app is deployed as static
files to **GitHub Pages**.

## How it works

1. You define **area** (bbox), **time range**, and an **ohsome filter** (e.g. `amenity=bench and type:node`).
2. The app queries `contributions/geometry` and keeps the contributions where **`@deletion` is `true`**.
3. Each deletion is shown in a table and (where a location can be derived) on the map, linked to
   `openstreetmap.org/{type}/{id}/history`.

Everything that defines a query lives in the **URL** (TanStack Router `validateSearch` + Zod), so any
result is a shareable, bookmarkable link.

### Notes & limitations

- **Deletion location.** ohsome returns a deletion contribution with **no geometry** (the object is
  gone). The app derives a marker position from the same object's earlier creation/edit contribution
  *if it falls inside your time window*. Objects created before the start date are listed in the table
  (with a ⚑) but can't be placed on the map — widen the start date to include their creation.
- **"Editor" = changeset.** ohsome doesn't expose usernames (privacy). The table links the deletion
  **changeset**, which on openstreetmap.org reveals the user who made it.
- **Be kind to the API.** Queries run only when you press **Find deletions** (never on keystroke), and
  results are cached per query, so a given search hits ohsome at most once. All automated tests mock
  the API — they never touch the live service.

## Tech stack

Follows the [FixMyBerlin `tech-stack` skill](https://github.com/FixMyBerlin/fixmyskills/tree/main/skills/tech-stack),
in its **client-only SPA** profile (no server, so it can live on GitHub Pages):

- **Bun** · **Vite** · **React 19** · **TypeScript**
- **TanStack Router** (SPA mode) + **TanStack Query**
- **Zod** for URL-state and API-response validation
- **Tailwind CSS** (+ forms)
- **react-map-gl / maplibre** + **OpenFreeMap** basemap
- **oxlint** · **Vitest** · **Playwright**

> Deviation from the skill: `oxfmt` isn't a published package yet, so formatting isn't wired up;
> `oxlint` handles linting. TanStack **Start** is intentionally not used — it's SSR-oriented, and this
> app needs no server.

## Develop

```bash
bun install
bun run dev          # http://localhost:5173

bun run lint         # oxlint
bun run typecheck    # tsr generate + tsc --noEmit
bun run test         # vitest unit tests
bun run test:e2e     # playwright (mocked; no external calls)
bun run build        # static build into dist/ (+ 404.html SPA fallback)
bun run check        # lint + typecheck + test + build
```

## Deploy

Push to `main` → the **Deploy to GitHub Pages** workflow builds and publishes `dist/`.

The Vite `base` is `/osm-find-deleted-data/` for a project Pages site, and the build copies
`index.html` to `404.html` so client-side routes resolve on Pages. Serving from a custom domain or a
user/organization page (root path)? Set `base` to `/` in [vite.config.ts](vite.config.ts).

Enable Pages once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.
