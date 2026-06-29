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

Every input lives in the URL, so any query is a shareable link. Example query:
<https://osmberlin.github.io/osm-find-deleted-data/?z=15.56&lat=52.47502&lng=13.42067&filter=amenity%253Dbench&from=2024-04-01&to=2026-06-19&bbox=%5B13.41291,52.472494,13.420682,52.476229>

### Good to know

- **Map location:** a deletion contribution has no geometry (the object is gone). Its marker is
  derived from the object's earlier creation/edit *if that falls inside your time range* — otherwise
  it's listed (flagged ⚑) without a marker. Widen the start date to capture creations.
- **Editor:** ohsome doesn't expose usernames; the table links the **changeset**, which reveals the
  user on openstreetmap.org.
- Queries run only on **Find deletions** (never on keystroke) and are cached, so each search hits
  ohsome at most once.

## Alternative approaches

### Ways — WAMY ("Wo sind meine Ways geblieben?")

[WAMY](https://michreichert.de/projects/wamy/) is a dedicated analysis for **deleted ways** (this app
is more general but derives way locations less reliably). Mind the data age — check when the dataset
was last built on its [about page](https://michreichert.de/projects/wamy/about.html).

- Code: <https://codeberg.org/nakaner/deleted-map>
- Talk (German): [FOSSGIS 2026 — Wo sind meine Ways geblieben?](https://media.ccc.de/v/fossgis2026-82321-wo-sind-meine-ways-geblieben)

### Overpass with a past date (tiny area)

Alternatively, query Overpass at a **past date** and load a **tiny area**: at that date the
now-deleted objects still existed, so they show up. This uses the `[date:...]` setting, which needs an
Overpass instance with attic (historical) data, e.g. the main `overpass-api.de`.

Same area and filter as the example query above, at the start date:

```overpassql
[out:json][timeout:25][date:"2024-04-01T00:00:00Z"];
node[amenity=bench](52.472494,13.41291,52.476229,13.420682);
out geom;
```

- Run it in [Overpass Turbo](https://overpass-turbo.eu/?Q=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%5Bdate%3A%222024-04-01T00%3A00%3A00Z%22%5D%3B%0Anode%5Bamenity%3Dbench%5D(52.472494%2C13.41291%2C52.476229%2C13.420682)%3B%0Aout%20geom%3B).
- Docs: [Overpass QL (the `[date:…]` setting)](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)
  and [Overpass API — attic/historical data](https://wiki.openstreetmap.org/wiki/Overpass_API).

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
