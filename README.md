# OSM Find Deleted Data

Find **deleted OpenStreetMap objects** in an area, using the
[ohsome API](https://docs.ohsome.org/ohsome-api/v1/). A static single-page app — no backend.

Pick an area, a time range, and an ohsome filter → get every object that was deleted, each linked to
its OpenStreetMap **history** (who deleted it, when, in which changeset). Replaces the manual
"download GeoJSON → QGIS → filter `@deletion`" workflow.

## Use it

1. **Filter** — an ohsome filter, e.g. `amenity=bench and type:node`.
2. **Time range** — from/to (or the "last month/year" shortcuts).
3. **Area** — draw a box on the map, or type coordinates.
4. **Find deletions** — results show in a table and on the map.

Every input lives in the URL, so any query is a shareable link.

### Good to know

- **Map location:** a deletion contribution has no geometry (the object is gone). Its marker is
  derived from the object's earlier creation/edit *if that falls inside your time range* — otherwise
  it's listed (flagged ⚑) without a marker. Widen the start date to capture creations.
- **Editor:** ohsome doesn't expose usernames; the table links the **changeset**, which reveals the
  user on openstreetmap.org.
- Queries run only on **Find deletions** (never on keystroke) and are cached, so each search hits
  ohsome at most once.

## Develop

```bash
bun install
bun run dev          # http://localhost:5173
bun run check        # lint + typecheck + unit tests + build
bun run test:e2e     # Playwright (fully mocked — no external calls)
```

Stack: Bun · Vite · React 19 · TanStack Router (SPA) + Query · Zod · Tailwind ·
react-map-gl/maplibre + OpenFreeMap · oxlint · Vitest · Playwright.
Follows the [FixMyBerlin tech-stack skill](https://github.com/FixMyBerlin/fixmyskills/tree/main/skills/tech-stack)
in its client-only profile.

## Deploy

Push to `main` → GitHub Actions builds and publishes to **GitHub Pages**
(enable once under Settings → Pages → Source: GitHub Actions). The Vite `base` is
`/osm-find-deleted-data/`; for a custom domain or user page set it to `/` in `vite.config.ts`.

Thanks to [HeiGIT](https://dashboard.ohsome.org/en/) for the preprocessed OSM history data.
