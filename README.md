# 🎬 Film Point — Movie Discovery App

Live demo: <https://filmpoint.vercel.app/>

A statically prerendered movie discovery app built with **React 19 + Vite + vite-react-ssg**, powered by the **TMDB API** with optional **Appwrite** search analytics and watchlist sync.

Search movies, explore trending searches, read full movie pages, and keep a personal watchlist — all without an application server.

---

## ✨ Features

- Movie search with a 1s debounce, request cancellation and stale-response guards
- Trending searches ranked by count (Appwrite)
- Full movie pages (`/movie/:id`) with synopsis, cast, genres, ratings, budget/revenue, quick facts, FAQ and "More like this"
- Genre hub pages (`/genre/:slug`) for all 19 TMDB genres, ranked by current popularity
- Local-first watchlist (localStorage) with optional background sync to Appwrite, across-tab updates and an offline mutation queue
- Recent searches (last 8) and a weighted "Random pick"
- Responsive dark UI, skeleton loaders, reduced-motion support, focus-trapped dialog
- Shared footer with a compact FAQ and a clear disclaimer (TMDB attribution, no hosting, third-party links)
- Static prerendering of the home page, genre hubs and up to 200 popular movie pages


## 🚀 SEO & performance

| Area | Implementation |
| --- | --- |
| Prerendering | `vite-react-ssg` emits static HTML for `/`, `/genres`, 19 `/genre/:slug` hubs, 22 curated list pages and up to 200 popular `/movie/:id` pages (dir-style, nested) |
| Topical depth | 19 genre hubs **plus** `/top-rated`, `/year/<year>` (15 years) and `/decade/<decade>` (6 decades): each page has unique copy, an instant-answer sentence, a ranked list and its own canonical URL, so the site competes for "best movies of 2024"-style queries instead of only head terms |
| Crawlable link graph | Every page links to the genre index, the curated lists (dropdowns) and popular movie pages. All anchors live in the prerendered HTML — `<details>` gives the layout, not JavaScript |
| Metadata | One `<title>` per page (≤60 chars, keyword first), one absolute `canonical`, Open Graph + Twitter cards with a generated 1200×630 image, `robots` with `max-image-preview:large` / `max-snippet:-1` |
| Structured data | One `@graph` per page with shared `@id`s: `Movie`, `FAQPage`, `BreadcrumbList`, `CollectionPage` + `ItemList` (nested `Movie`), `WebSite` + `SearchAction`, `Organization` |
| Direct answers | Movie and list pages open with a one-sentence answer; movie pages add a "Quick facts" table and a 6-question FAQ (for readers and AI crawlers) |
| Sitemap | `scripts/generate-sitemap.js` writes every prerendered URL with `lastmod`, `changefreq`, `priority` and `<image:image>` entries taken from each page's own `og:image` |
| AI crawlers | `scripts/generate-llms.mjs` writes a generated `llms.txt` inventory (genres, years, decades, sample movie pages, JSON-LD summary) |
| Robots & errors | `robots.txt` allows everything (including `/api/`, which Googlebot needs after hydration); unmatched URLs return `public/404.html` with `noindex` instead of a soft-404 homepage |
| Core Web Vitals | Preconnect to TMDB, `srcset` posters (w342/w500), `fetchPriority="high"` on the LCP poster, lazy-loading elsewhere, no layout-shifting images |
| Security headers | `vercel.json` adds `X-Content-Type-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, immutable asset caching and `noindex` on `/api/*` + `/build-info.json` |
| API key safety | The browser only talks to `/api/tmdb`; `VITE_API_KEY` is **not** shipped in the client bundle |
| Verification | `npm run seo:audit` re-reads `dist/` and fails on missing titles/canonicals/H1s/alts/invalid JSON-LD; `npm run verify:deploy` checks a live deployment end to end |


### Measured performance (mobile Lighthouse, local preview build)

| Metric | Reported before | After this pass |
| --- | --- | --- |
| Performance | 65 | **100** |
| Accessibility | 95 | **100** |
| Cumulative Layout Shift | 0.516 | **0.049** |
| Total page weight | 5,005 KiB | **1,432 KiB** |
| Largest Contentful Paint / Speed Index (localhost, no simulated latency) | 2.8 s | 0.9 s |
| Total Blocking Time | 50 ms | **30 ms** |

Reproduce locally:

```bash
npm run build && npm run preview      # serves the real prerendered build
npx lighthouse http://localhost:4173/ --chrome-flags="--headless=new"
```

Two notes: localhost has no network latency (PageSpeed simulates Slow 4G, so its
FCP/LCP will be higher), and the largest remaining layout-shift risk was
`content-visibility: auto` on the movie grid — see the comment in
`src/index.css`. Gallery posters are optimised once with
`npm run posters:optimize` (3.92 MB → 466 KB) and committed.

## 🛠 Tech stack

- React 19, React Router 6, Vite 6, `vite-react-ssg` (SSG/SSR)
- Tailwind CSS v4 + Flowbite React + custom CSS
- TMDB REST API v3 (serverless proxy)
- Appwrite (optional search analytics + watchlist sync)
- Vercel hosting, Vercel Analytics, Speed Insights, GA4

## 📦 Installation

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # prerender + sitemap
npm run preview
npm run lint
npm run posters:optimize   # regenerate the resized gallery posters (~4 MB -> ~470 KB)
```

> `npm run dev` also serves `/api/tmdb` through a Vite middleware that mirrors the Vercel function, so the TMDB key never reaches the browser during development either.

## 🔐 Environment variables

Create `.env` in the project root:

```env
# TMDB bearer token (v4). Used server-side only: SSG, dev proxy and the Vercel function.
VITE_API_KEY=YOUR_TMDB_BEARER_TOKEN

# Canonical site origin used by canonical tags, OG tags and the sitemap.
VITE_SITE_URL=https://filmpoint.vercel.app

# Appwrite (optional — trending searches + watchlist sync)
VITE_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
VITE_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
VITE_APPWRITE_DATABASE_ID=YOUR_DATABASE_ID
VITE_APPWRITE_COLLECTION_ID=YOUR_COLLECTION_ID
# Optional: enables watchlist background sync
VITE_APPWRITE_WATCHLIST_COLLECTION_ID=YOUR_WATCHLIST_COLLECTION_ID
```

**On Vercel** also add a plain (non-`VITE_`) variable so the serverless proxy can authenticate:

```env
TMDB_API_KEY=YOUR_TMDB_BEARER_TOKEN
```

The proxy also accepts `VITE_API_KEY` as a fallback, so a project that already has that variable configured works without a second copy of the token. If neither is present the proxy returns `500` and the site shows the "could not load" state — there is intentionally no client-side key fallback.

### How to get the keys

1. **TMDB** → <https://www.themoviedb.org/settings/api> → create an API key → copy the **API Read Access Token (v4)**.
2. **Appwrite** → <https://cloud.appwrite.io> → create a project → copy the project ID, endpoint and database/collection IDs.
3. Appwrite → *Integrations → Platforms* → add a Web platform for `localhost` and `*.vercel.app`.

## 🗂 Watchlist sync collection (optional)

Create a collection and set `VITE_APPWRITE_WATCHLIST_COLLECTION_ID`.

| Attribute | Type | Required |
| --- | --- | --- |
| `device_key` | string | yes |
| `movie_id` | integer | yes |
| `payload` | string | yes |
| `updated_at` | string | yes |

Recommended indexes: `device_key`, `movie_id`, and a **unique** combined index on `device_key` + `movie_id`.

The `device_key` is an anonymous client-generated identifier — it is **not** authentication. Configure collection permissions accordingly.

## 🧭 Project structure

```
api/tmdb.js                    Vercel serverless TMDB proxy (TMDB_API_KEY)
api/health.js                  Runtime key/deployment check (/api/health)
api/build-info.js              Runtime build report (/api/build-info)
scripts/generate-sitemap.js    Sitemap + robots generator (build step)
scripts/generate-llms.mjs      llms.txt generator for AI crawlers (build step)
scripts/generate-og-image.mjs  1200x630 social card + favicons (build step)
scripts/postprocess-html.mjs   charset/lang/async HTML fixes (build step)
scripts/build-info.mjs         dist/build-info.json + shared diagnostics
scripts/seo-audit.mjs          Post-build SEO audit (`npm run seo:audit`)
scripts/verify-deploy.mjs      Checks a live deployment (`npm run verify:deploy`)
scripts/mock-tmdb-server.mjs   Offline TMDB mock (`npm run mock:tmdb`)
src/api/tmdbProxy.js           Browser helper: always calls /api/tmdb
src/api/tmdbServer.js          Server-only TMDB fetch (SSR/SSG only, retries)
src/api/tmdb-ssg.js            Build-time popular movie list (routes + nav + sitemap)
src/appwrite.js                Search analytics + watchlist sync CRUD
src/lib/poster.js              TMDB image helpers (w342/w500/w780, srcset)
src/lib/seo.js                 SITE_URL, canonical/OG helpers, title builders
src/lib/collections.js         Year / decade / top-rated list definitions
src/lib/schema.js              JSON-LD builders (@graph, @id references)
src/lib/watchlist.js           Unified watchlist store + offline sync queue
src/lib/watchLinks.js          External watch/download provider configuration
src/hooks/useDebounce.js       Small debounce hook (no extra dependency)
src/pages/HomePage.jsx         Discovery UI, watchlist, detail dialog
src/pages/MovieDetails.jsx     Prerendered movie page (SEO + JSON-LD + FAQ)
src/pages/GenrePage.jsx        Prerendered genre hub (long-tail landing pages)
src/pages/GenresIndexPage.jsx  Prerendered genre index (/genres)
src/pages/CollectionPage.jsx   Prerendered /top-rated, /year/:y, /decade/:d
src/pages/NotFound.jsx         Branded noindex 404 route
src/lib/genres.js              Canonical 19-genre taxonomy (slugs, blurbs, intros)
src/components/                MovieCard, Search, SeoHead, JsonLd, MovieLinkGrid,
                               MovieSchema, SiteSchema, FaqSchema,
                               BreadcrumbSchema, PopularLinks, GenreLinks,
                               CollectionLinks, Spinner, skeletons
vite.config.js                 Poster manifest, popular-movie list, dev TMDB proxy,
                               /build-info.json middleware, SSG route list
```

### Data flow

```
Browser ──► /api/tmdb?path=/3/…  ──►  TMDB (server-side key)
   │
   └── /movie/:id served from prerendered HTML + static loader data
Build  ──► TMDB (VITE_API_KEY) ──► dist/index.html + dist/movie/<id>/index.html
```

Compliance map for every recommendation in [Google's SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): [`docs/seo.md`](docs/seo.md).



## 🌐 Deploy on Vercel

1. Push the repository to GitHub.
2. Import it at <https://vercel.com/new>.
3. Add the environment variables above (`VITE_*` **and** `TMDB_API_KEY`).
4. Deploy, then submit `https://filmpoint.vercel.app/sitemap.xml` in Google Search Console and Bing Webmaster Tools for fast indexing.

`vercel.json` already configures rewrites, cache headers and `cleanUrls`, so prerendered pages and client-side routes coexist.

### Pre-flight checklist (production)

| Check | Why it matters |
| --- | --- |
| `TMDB_API_KEY` set in Vercel (Production **and** Preview) | The browser only calls `/api/tmdb`; without it every movie/search request returns 500. `VITE_API_KEY` is accepted as a fallback. Verify with `/api/health`. |
| `VITE_API_KEY` set in Vercel | Used at **build** time to prerender the movie pages, the genre hubs, the curated lists and the full sitemap. Missing = the build still succeeds, but every list is empty and `build-info.json` says so. |
| `VITE_SITE_URL` set | Canonical tags, OG URLs and the sitemap use it. Must match the deployed origin. |
| Node ≥ 20 | Pinned via `engines` in `package.json`; Vite 6 requires it. |
| Deployment Protection **off** for Production | Crawlers get a login wall otherwise and nothing gets indexed. |
| Build command = `npm run build` | Generates the social image, runs `vite-react-ssg build`, then sitemap → llms.txt → HTML fixes → `build-info.json` → SEO audit. |
| Output directory = `dist` | Vercel's Vite default; matches the SSG output. |
| `npm run verify:deploy` after the first deploy | Confirms `/build-info.json`, `/api/health`, `robots.txt`, `sitemap.xml`, a genre hub, a curated list and a movie page all respond for the deployed commit. |

Promote a preview to production by merging into `main`:

```bash
git checkout main
git merge --ff-only prduck-improvement-session
git push origin main
```

Unknown URLs return a real `404` (via `public/404.html` + `noindex`) instead of a homepage duplicate — check that before a big SEO push.

## 🩺 Troubleshooting

### "We could not load … right now" on every genre and movie page

That message is the loader's failure state, and the browser console now says which of these it is:

| Console message | Cause | Fix |
| --- | --- | --- |
| `/api/tmdb returned "text/html" instead of JSON` | The API route does not exist where you are looking (plain `vite preview` before this fix, a static host, `file://`, or `vercel dev` without functions) | Use `npm run dev`, or deploy to Vercel. `npm run preview` now ships the proxy + clean URLs |
| `/api/tmdb responded 500` | No key in that environment | Set `TMDB_API_KEY` **or** `VITE_API_KEY` in the deployment env, then redeploy. Check `/api/health` |
| `/api/tmdb responded 502` | Upstream network failure reaching TMDB | Retry; transient |
| Prerendered HTML is also empty (`dist/genre/*/index.html` has no links) | The build ran without `VITE_API_KEY` | Add it to the build environment and rebuild |

`GET /api/health` reports whether the proxy has a key (booleans only, never the token):

```json
{ "ok": true, "tmdbKey": { "TMDB_API_KEY": true, "VITE_API_KEY": false } }
```

### Vercel build logs show a `VITE_API_KEY is missing` banner

The banner lists what cannot be prerendered (movie pages, genre lists, curated lists, popular-movies dropdown, sitemap/llms entries). The build continues by default so the deployment still publishes current HTML plus a `build-info.json` that reports `tmdbKeyPresent: false`.

**Fix:** Vercel → Project → Settings → Environment Variables → add `VITE_API_KEY` (TMDB v4 read token) for **Production and Preview**, then **redeploy** — env changes never apply to an existing build.

Prefer a hard failure? Add `STRICT_TMDB_BUILD_CHECK=1` to the build environment (the build then exits non-zero instead of publishing a degraded site). `SKIP_TMDB_BUILD_CHECK=1` does the opposite: it silences the warning when a data-free build is intentional.

### `/build-info.json` returns 404

`dist/build-info.json` is written by `scripts/build-info.mjs` at the end of `npm run build`. If the deployed URL 404s, the deployment was **not built from a commit that runs that step** — i.e. production is serving an older build. Confirm from the outside:

```bash
npm run verify:deploy            # or: node scripts/verify-deploy.mjs https://your-site
```

The script prints one line per check and compares the deployed commit with your local `HEAD`.

| Symptom | Meaning | Fix |
| --- | --- | --- |
| `/build-info.json` 404 **and** `/api/health`, `/llms.txt` 404 | Nothing from the current branch is deployed | Redeploy the current commit (merge to the production branch, or trigger a redeploy) |
| `/build-info.json` 404 but `/api/health` 200 | The functions deployed but the build step did not | Build command must be `npm run build` and output directory `dist` |
| `/build-info.json` 200 with `tmdbKeyPresent: false` and `problems` | The build ran without `VITE_API_KEY` | Add the key for Production **and** Preview, then redeploy |
| `/build-info.json` 200 but counts are low (`genrePagesWithMovies` / `collectionPagesWithMovies`) | TMDB throttled during the build | Re-run the build; requests now retry with backoff and are concurrency-limited |

`/api/build-info` is the runtime twin: it works even when the static file is missing and reports the deployment's commit, branch and environment.

`npm run build` warns loudly when `VITE_API_KEY` is missing, but deliberately does **not** fail: a failed build keeps the previous deployment live and hides the cause. Pass `STRICT_TMDB_BUILD_CHECK=1` in the build environment if you would rather block a degraded deploy.

### Build a page set offline (no TMDB key, no network)

```bash
npm run mock:tmdb                                  # terminal 1: http://127.0.0.1:5099
$env:TMDB_BASE_URL='http://127.0.0.1:5099'; npm run build   # terminal 2 (PowerShell)
```

`TMDB_BASE_URL` redirects every build-time TMDB call to the mock, so the prerender, sitemap, llms.txt and audit can be verified deterministically. A real build still prerenders 19/19 genre hubs and 22/22 list pages (the mock catalogue is only 40 films, so the "expected ~200 movie pages" warning is intentional).

### Other common cases

- **Trending section never appears + a 403 in the console** — the Appwrite search collection is not readable anonymously. Either allow read access for guests (Users role) on the collection, or disable the request with `VITE_APPWRITE_TRENDING=off`. The console error is cached per session so it does not repeat on navigation.
- **Accessing `/genre/…` or `/movie/…` directly returns the home page** — that is a host without rewrites. `vercel.json` covers production; `npm run preview` covers local (see `cleanUrlPreviewMiddleware` in `vite.config.js`).
- **Build prerenders only `/`** — no `VITE_API_KEY` at build time; the sitemap will say `Using 0 movie URLs`.
- **Watchlist does not sync between devices** — expected: it is local-first, and sync only runs when `VITE_APPWRITE_WATCHLIST_COLLECTION_ID` is configured.

## 👨‍💻 Author

**MD Azhar Hussain** — CSE (IoT) · Frontend Developer · Cloud & API Integrations
GitHub: <https://github.com/MD-Azhar-Hussain>

Movie data by [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.

