# FilmPoint / MovieVerse: Project Interview Guide

This document is the source-of-truth briefing for understanding, explaining, reviewing, and interviewing on this repository. It is written from the implementation currently in the repository, not from assumptions about a future architecture. The older sections were written against a client-only version of the app; the **Refactor log** below records what changed, and the sections that follow have been updated where they were wrong.

## 0. Refactor log (2026-11 hardening + SEO pass)

- **TMDB key no longer ships to the browser.** The client only calls the same-origin `/api/tmdb` proxy. `VITE_API_KEY` is read in Node only (SSG loader, `vite.config.js` dev proxy, `scripts/`). Verified: `dist/assets/*.js` contains zero bearer tokens.
- **Routing moved to `src/pages/`** with `vite-react-ssg` prerendering `/` plus up to 200 popular `/movie/:id` pages. `src/App.jsx` is now only the layout shell.
- **One watchlist implementation** (`src/lib/watchlist.js`) shared by the home page and the movie page; includes normalized entries, cross-tab `storage` sync, coalescing offline mutation queue (max one mutation per movie) and best-effort Appwrite flush.
- **Removed dead code:** `src/api/tmdb.js` (`API_OPTIONS`), `src/App.css`, the 248-line commented stylesheet at the top of `src/index.css`, duplicated poster-URL helpers (now `src/lib/poster.js`), duplicated `<Analytics />`, and the `react-use` dependency (replaced by `src/hooks/useDebounce.js`).
- **SEO:** single `<title>` per page (template title removed from `index.html`), absolute canonical/OG/Twitter URLs, `Movie` + `BreadcrumbList` + `WebSite`/`SearchAction`/`Organization` JSON-LD, 120 crawlable internal links on the home page (`PopularLinks`) and 12 "More like this" links per movie page, 187-URL sitemap, `robots.txt` disallowing `/api/`, security + cache headers in `vercel.json`.
- **Deleted assets** `public/hero.png` and `public/hero-bg.png` are no longer referenced: the hero pattern is a CSS gradient and OG images use `/title.png`.
- **Lint is green** (Node globals configured for `api/`, `scripts/`, `vite.config.js`, `src/api/tmdb-ssg.js`, `src/api/tmdbServer.js`), and `npm run build` prerenders successfully.

## 0.1 SEO content + indexing pass (2026-11, second pass)

- **Topical hub pages:** `/genre/:slug` for all 19 TMDB genres, prerendered at build time (`src/lib/genres.js` taxonomy, `src/pages/GenrePage.jsx`, `genreLoader` in `src/routes.jsx`). Each has unique intro copy, an instant-answer block, a 20-movie ranked list, `CollectionPage` + `ItemList` + `BreadcrumbList` JSON-LD and its own canonical.
- **Direct answers / depth on movie pages:** one-sentence answer under the H1, a six-field "Quick facts" table and a six-question FAQ section backed by `FAQPage` JSON-LD (`src/components/FaqSchema.jsx`).
- **Crawlable link graph expanded:** `PopularLinks` (120 movies) + `GenreLinks` (19 genres) rendered as native `<details>` dropdowns on the home page, genre dropdown on movie pages, and 12 "More like this" links per movie page. Anchors remain in the prerendered HTML, so crawlability is unchanged by the collapse.
- **Title discipline:** `buildTitle()` keeps titles at ≤60 characters with the keyword first (`Best Action Movies - Film Point` is 31 chars).
- **Real 404s:** `public/404.html` plus a `noindex` `*` route, and `vercel.json` no longer rewrites unknown paths to `/index.html` (that rewrite previously produced soft-404 duplicate content).
- **Sitemap:** 206 URLs (home + 19 genres + 186 movies) with `lastmod` and `<image:image>` poster entries for image search.
- Verified after the change: `npm run lint` passes, `npm run build` prerenders 206 pages, and every JSON-LD block parses.

## 1. Executive Summary


This is a client-side React movie discovery application built with Vite. Users can:

- Browse popular movies from TMDB.
- Search TMDB movies as they type, with a one-second debounce.
- View trending search terms recorded in Appwrite.
- Save movies to a local watchlist.
- Optionally synchronize that watchlist to an Appwrite collection using a device-specific key.
- Open movie details in a modal, loading richer details on demand.
- Sort the local watchlist by recent, title, or rating.
- Use recent searches and a weighted personalized random search.

There is no application server in this repository. The browser calls TMDB and Appwrite directly. Vite injects `VITE_*` environment variables into the browser bundle at build time. Vercel serves the generated static site and provides cache headers for static assets.

The central orchestration component is `src/pages/HomePage.jsx` (with `src/pages/MovieDetails.jsx` for prerendered movie pages). `src/components` contains focused UI components, `src/api/tmdbProxy.js` + `api/tmdb.js` own the TMDB request path (no key in the browser), and `src/appwrite.js` owns Appwrite persistence operations.

## 2. AI Context Brief

Use the following facts when answering questions about this project:

- Product: movie discovery and personal watchlist web app.
- Runtime: browser-rendered React 19 application, prerendered to static HTML at build time.
- Build tool: Vite 6 with `vite-react-ssg` (no `rolldown-vite` override).
- Styling: Tailwind CSS v4 through the Vite plugin plus custom CSS in `src/index.css`.
- Primary data provider: TMDB REST API v3, always through the `/api/tmdb` proxy in the browser.
- Optional backend services: Appwrite Database for trending search analytics and watchlist synchronization.
- Local persistence: `localStorage` for the watchlist, recent searches, device key, and pending sync queue; `sessionStorage` for random-pick history.
- Deployment: Vercel static deployment plus one serverless function (`api/tmdb.js`).
- Authentication: none. The device key is an anonymous client-generated identifier, not user authentication.
- State ownership: page-level React hooks (`src/pages/HomePage.jsx`, `src/pages/MovieDetails.jsx`).
- Main consistency strategy: local-first watchlist updates followed by best-effort background synchronization.
- Search strategy: controlled input -> one-second debounce -> abort previous request -> TMDB search/discover request.
- Stale request protection: both `AbortController` and monotonically increasing request IDs are used.
- External failure behavior: search errors are shown with a retry action; Appwrite failures generally degrade to local-only behavior.
- Verified status on 2026-11-01: `npm run lint` passes and `npm run build` passes (187 prerendered pages).

## 3. Repository Map

| Path | Responsibility |
| --- | --- |
| `index.html` | HTML shell, Google Analytics bootstrap, favicon, preconnect hints, root mount node, viewport metadata. |
| `src/main.jsx` | React entry point; imports global CSS; mounts the route tree with `ViteReactSSG` and guards stale static-loader-data responses. |
| `src/App.jsx` | Layout shell only: `<Outlet />`, Vercel Analytics and Speed Insights. |
| `src/routes.jsx` | Route table plus `movieLoader` (SSR branch gated by `import.meta.env.SSR`, browser branch via the proxy). |
| `src/pages/HomePage.jsx` | Discovery UI: search, trending, watchlist, random pick, detail dialog, SEO head block. |
| `src/pages/MovieDetails.jsx` | Prerendered movie page: metadata, JSON-LD, cast, "More like this" links, watchlist toggle. |
| `src/api/tmdbProxy.js` | Browser-only helper; always calls `/api/tmdb` (never TMDB directly). |
| `src/api/tmdbServer.js` | Server-only TMDB fetch with retry; imported behind `import.meta.env.SSR` so the key stays out of the client bundle. |
| `src/api/tmdb-ssg.js` | Build-time popular-movie list (SSG routes, popular-links nav, sitemap) with an in-process cache. |
| `api/tmdb.js` | Vercel serverless TMDB proxy using `TMDB_API_KEY`; validates the `/3/` path prefix and sets CDN cache headers. |
| `src/lib/poster.js` | TMDB image URL helpers (`w342`/`w500`/`w780`, `srcset`, placeholder handling). |
| `src/lib/seo.js` | `SITE_URL`, canonical/OG helpers, title and description builders. |
| `src/lib/watchlist.js` | Single watchlist store: normalization, merge, cross-tab sync, coalescing offline queue, Appwrite flush. |
| `src/lib/watchLinks.js` | External watch/download provider configuration and safe new-tab helper. |
| `src/hooks/useDebounce.js` | Local debounce hook (replaces `react-use`). |
| `src/appwrite.js` | Conditional Appwrite client setup and database CRUD helpers. |
| `src/components/Search.jsx` | Controlled search form, clear button, random pick, recent-search controls. |
| `src/components/MovieCard.jsx` | Movie card presentation, poster `srcset`, image accent extraction, save/watch/download actions. |
| `src/components/MovieCardSkeleton.jsx` | Loading placeholder card. |
| `src/components/MovieSchema.jsx` | `Movie` JSON-LD (cast, director, trailer, rating, publisher). |
| `src/components/BreadcrumbSchema.jsx` | `BreadcrumbList` JSON-LD for movie pages. |
| `src/components/SiteSchema.jsx` | `WebSite` + `SearchAction` + `Organization` JSON-LD. |
| `src/components/PopularLinks.jsx` | Server-rendered internal links to prerendered movie pages (crawlable link graph). |
| `src/components/Spin.jsx` | Flowbite loading spinner used by the detail dialog. |
| `src/index.css` | Tailwind imports, theme, layout, responsive styling, animation, modal, watchlist, card and link-block styles. |
| `vite.config.js` | React/Tailwind/Flowbite plugins, poster manifest, popular-movie list, dev TMDB proxy and SSG options. |
| `scripts/generate-sitemap.js` | Writes `sitemap.xml` (public + dist) and keeps `robots.txt` in sync. |
| `eslint.config.js` | Flat ESLint configuration for browser code plus a Node override for server/build files. |
| `package.json` | Scripts and runtime/build dependencies. |
| `public/newposters/` | Local landing-page poster assets discovered at build time. |
| `public/no-movie.png`, `search.svg`, `star.svg`, `title.png` | Static visual, favicon and fallback assets. |
| `vercel.json` | Rewrites, `cleanUrls`, security headers and cache headers. |
| `.env` | Local secrets/configuration; ignored by Git and must never be committed. |
| `dist/` | Generated production output; do not edit manually. |


## 4. Runtime Architecture

```mermaid
flowchart TD
  Browser[Browser] --> Shell[index.html]
  Shell --> Entry[src/main.jsx]
  Entry --> App[src/App.jsx]
  App --> Search[Search.jsx]
  App --> Cards[MovieCard.jsx]
  App --> TMDB[TMDB REST API]
  App --> Appwrite[src/appwrite.js]
  App --> Local[localStorage/sessionStorage]
  Appwrite --> Database[Appwrite Database]
  App --> Images[TMDB image CDN]
  Vite[Vite build] --> Manifest[virtual:poster-manifest]
  Manifest --> Posters[public/newposters]
```

### Architectural style

The application is a modular monolith at the frontend level: one page, one main orchestration component, a few presentational components, and service modules for external systems. It is not a layered backend system and does not have a repository/domain/service architecture. This is appropriate for a small single-page project, but `App.jsx` is now large enough that extracting hooks and domain utilities would improve maintainability.

### Rendering model

- `createRoot` mounts a client-rendered React tree.
- `StrictMode` can intentionally invoke development lifecycle paths more than once; effects must therefore be idempotent.
- `HelmetProvider` allows `App` to set document title and social metadata.
- Vercel Analytics and Speed Insights are client integrations.
- The initial page is rendered with local poster assets, then TMDB/Appwrite data is fetched asynchronously.

## 5. Main User Flows

### Initial load

1. `main.jsx` mounts `App`.
2. Module initialization reads the generated poster manifest and prepares two shuffled poster rows.
3. `App` initializes empty/default state.
4. An effect loads the normalized watchlist from `localStorage`.
5. If watchlist sync is configured, hydration and queued-mutation flushing start.
6. Another effect loads recent searches from `localStorage`.
7. The debounced search term starts empty, so the app calls TMDB `discover/movie?sort_by=popularity.desc`.
8. A separate effect calls Appwrite for the top trending search documents.

### Search flow

```mermaid
sequenceDiagram
  participant U as User
  participant S as Search.jsx
  participant A as App
  participant T as TMDB
  participant W as Appwrite

  U->>S: Types query
  S->>A: setSearchTerm(value)
  A->>A: Wait 1000 ms via useDebounce
  A->>A: Abort previous request and increment request ID
  A->>T: GET /search/movie?query=encodedQuery
  T-->>A: results
  A->>A: Ignore response if ID is stale
  A->>A: setMoviesList(results)
  A->>W: Increment search count using first result
  A->>A: Persist normalized recent search
  A-->>U: Render cards
```

Important behavior:

- The input is controlled by `searchTerm`.
- `debouncedSearchTerm` is separate, so the UI can show a pending state while waiting.
- Whitespace is normalized and empty input returns to popular discovery results.
- The query is URL encoded.
- A failed request shows an error state and retry button.
- Search analytics failure does not replace successful movie results.

### Movie details flow

1. Clicking a movie-card poster opens the modal immediately.
2. If enough detail fields already exist, no second TMDB request is made.
3. Otherwise, `GET /movie/{id}` loads runtime, genres, backdrop, and synopsis data.
4. The previous detail request is aborted before starting a new one.
5. A request ID prevents an old response from overwriting a newer selection.
6. Escape and backdrop click close the modal; body scrolling is disabled while it is open.

### Watchlist flow

The watchlist is local-first:

1. A movie is normalized to a small stable shape.
2. Duplicate IDs are removed through a `Map`.
3. React state updates immediately, so the UI feels instant.
4. An effect writes the normalized list to `localStorage`.
5. If Appwrite sync is configured, an `add` or `remove` mutation is appended to a local queue.
6. The queue is flushed immediately when possible and retried on the browser `online` event.
7. On a later load, remote documents are fetched and merged into local state.

Current conflict rule: remote items are loaded first, then local items overwrite matching IDs. Local state therefore wins for same-ID conflicts during merge. There are no user accounts or server-side timestamps used for conflict resolution.

### Trending flow

Appwrite stores one document per search term with a count and the first result's movie/poster information. `getTrendingSearches` orders by descending count and limits the result to ten. Clicking a trending item fetches the TMDB movie detail to obtain an IMDb ID, then navigates a newly opened tab to IMDb.

### Random search flow

Candidate titles are weighted from three sources:

- Watchlist titles: weight 6.
- The first twenty current results: weight 3.
- A hard-coded fallback list: weight 1.

Recent searches and the current query are excluded. A session history prevents repeats until the candidate pool is exhausted. Selection is weighted using a random cursor.

## 6. Data Contracts

### TMDB movie shape used by the UI

The UI reads fields such as `id`, `title`, `poster_path`, `backdrop_path`, `overview`, `release_date`, `vote_average`, `original_language`, `genre_ids`, `genres`, `runtime`, `popularity`, and `imdb_id`. Search results usually contain the list-oriented fields; the detail endpoint supplies richer fields.

### Normalized local watchlist entry

```js
{
  id: Number,
  title: String,
  poster_path: String,
  release_date: String,
  vote_average: Number | null,
  overview: String,
  addedAt: ISOString
}
```

The normalizer accepts either `id` or `movie_id`, rejects invalid IDs, supplies defaults, and deduplicates by numeric movie ID.

### Appwrite search document

Expected attributes:

```text
searchTerm: string
count: integer
movie_id: integer
poster_url: string
```

### Appwrite watchlist document

Expected attributes from the README:

```text
device_key: string, required
movie_id: integer, required
payload: string, required
updated_at: string, required
```

The full movie object is serialized into `payload`. This is simple and flexible, but it is less queryable and less type-safe than storing individual movie attributes.

### Local storage keys

| Key | Contents |
| --- | --- |
| `movie-watchlist` | Normalized local movie array. |
| `movie-watchlist-device-key` | Anonymous browser/device identifier. |
| `movie-watchlist-sync-queue` | Ordered pending `add`/`remove` mutations. |
| `movie-recent-searches` | Up to eight normalized recent searches. |
| `movie-random-pick-history` | Session-scoped lower-case selected titles. |

## 7. External Services and Configuration

### TMDB

`api/tmdb.js` (Vercel) and the Vite dev middleware both read `VITE_API_KEY`/`TMDB_API_KEY` on the server and attach `Authorization: Bearer ...` themselves; the browser only sends `path` plus TMDB query params to `/api/tmdb`. `src/pages/HomePage.jsx` uses `tmdbFetch` for search, discovery and the trending-to-IMDb lookup, while `src/lib/poster.js` converts TMDB paths into `https://image.tmdb.org/t/p/...` URLs (with `srcset` variants).


### Appwrite

The Appwrite client is created only when enough environment variables exist. Search tracking requires project, database, collection, and endpoint. Watchlist synchronization requires project, database, watchlist collection, and endpoint. If configuration is incomplete, helper methods return safely or return empty data, allowing local-only operation.

### Vite environment security

Any `VITE_*` variable is exposed to client-side JavaScript. The TMDB bearer token is therefore not a server secret in this architecture. A production-grade design would proxy TMDB calls through a server or edge function, keep the TMDB credential server-side, add rate limiting, and validate requests there. The local `.env` contains a token-like credential and must remain ignored; if it has ever been committed or exposed, rotate it.

### Vercel

`vercel.json` gives poster files one-day caching with stale-while-revalidate and hashed `/assets` files one-year immutable caching. Vite's hashed asset names make the long cache safe for generated JS/CSS. No SPA rewrite is configured because the current app is a single root page without client-side routes.

## 8. Build-Time Poster Manifest

The custom plugin in `vite.config.js` registers `virtual:poster-manifest`. During module loading it reads `public/newposters`, filters image extensions, sorts filenames, and returns generated JavaScript such as `export default ["poster-a.jpg", ...]`. `App.jsx` imports this virtual module and builds the landing gallery from it.

When a poster is added or removed during development, `handleHotUpdate` sends a full reload. This avoids maintaining a manually edited asset index.

## 9. State and Effect Inventory

| State/ref | Purpose |
| --- | --- |
| `searchTerm` | Immediate controlled input value. |
| `debouncedSearchTerm` | Query that is allowed to trigger TMDB. |
| `moviesList` | Current discovery/search result list. |
| `trendingMovies` | Appwrite trending search documents. |
| `isLoading`, `errorMessage` | Search/discovery request status. |
| `selectedMovie`, `isDetailOpen` | Detail modal selection and visibility. |
| `detailLoading`, `detailError` | Detail request status. |
| `watchlist`, `isWatchlistHydrated` | Local-first saved movies and persistence guard. |
| `recentSearches` | Local search history. |
| `watchlistSort` | Current list sorting mode. |
| `watchlistToast` | Short-lived feedback message. |
| `detailRequestIdRef` | Stale detail-response guard. |
| `moviesRequestIdRef` | Stale search-response guard. |
| Abort controller refs | Cancel in-flight TMDB requests. |
| `randomPickHistoryRef` | Avoid repeated random choices in a session. |
| `isFlushingSyncQueueRef` | Prevent concurrent sync queue flushes. |

## 10. Performance Decisions

- Debouncing reduces TMDB calls while typing.
- Abort controllers cancel obsolete network work.
- Request IDs protect against races even if cancellation is too late.
- Lazy image loading is used for cards and most gallery images.
- `decoding="async"` avoids blocking layout on image decode.
- Skeleton cards preserve the grid shape during loading.
- `content-visibility: auto` is used on the movie library section.
- Vercel cache headers optimize static assets.
- The gallery duplicates its list to create a continuous animation.
- `prefers-reduced-motion` pauses poster movement.

Potential performance improvements: virtualize very large result lists, request only needed TMDB fields where supported, avoid logging in production, cache repeated TMDB responses, and move poster color extraction off the main thread if it becomes expensive.

## 11. Accessibility and UX Notes

Existing positive patterns:

- Search has `role="search"` and an accessible label.
- Loading/status text uses `aria-live`.
- Save buttons expose `aria-label` and `aria-pressed`.
- The detail panel uses dialog semantics and an accessible title/description.
- Escape closes the modal.
- Watchlist items support keyboard Enter/Space activation.
- Images have meaningful alt text or are explicitly decorative.
- Reduced-motion preference is respected for the marquee.

Gaps worth discussing in an interview:

- Modal focus is not trapped or restored to the triggering element.
- Some clickable trending items are `li` elements with mouse behavior rather than keyboard-native buttons.
- The watchlist item is a `div`-like list item with role emulation instead of a button.
- The newly opened trending tab can remain blank if TMDB returns no IMDb ID.
- The `Watch` action points to third-party streaming domains; this creates trust, legal, availability, and security concerns and should be reviewed before production.

## 12. Testing Strategy

Current repository validation consists of:

```text
npm run lint
npm run build
```

There are no unit, integration, end-to-end, or component tests in the repository. A useful testing plan would include:

1. Pure utility tests for normalization, poster URL fallback, deduplication, queue parsing, merge behavior, and weighted candidate exclusion.
2. Component tests for Search, MovieCard, loading/error states, modal close behavior, and watchlist toggle behavior.
3. Mocked API tests for aborts, stale responses, non-2xx responses, empty search results, and Appwrite failure degradation.
4. Browser tests for initial load, typing search, retry, localStorage persistence, offline queueing, online flush, keyboard modal use, and responsive layouts.
5. Accessibility checks for focus order, dialog focus management, labels, contrast, and reduced motion.

## 13. Known Risks and Bugs to Be Ready to Explain

### Resolved in the 2026-11 pass

- **Client-exposed TMDB credential** → the browser now only calls `/api/tmdb`; `VITE_API_KEY` is read exclusively in Node (SSG, dev proxy, sitemap). Verified by grepping the built bundles for the token (`0` matches).
- **Queue growth from repeated toggles** → `enqueueWatchlistMutation` collapses previous mutations for the same movie, so at most one queued operation exists per movie.
- **Duplicated/divergent watchlist logic** (home page vs movie page) → both use `src/lib/watchlist.js`, so `addedAt`, normalization and sync behave identically.
- **Duplicate `<title>` tags** → template title removed from `index.html`; each page emits exactly one title.
- **Missing crawlable internal links** → home page renders 120 static links and each movie page renders 12 "More like this" links.
- **Dead assets / 404s for `hero.png` / `hero-bg.png`** → removed references; the hero pattern is a CSS gradient and OG images use `/title.png`.
- **`npm run lint` failing** → Node globals override added; lint is green.

### High priority (still open)

- **Third-party watch/download links:** Movie cards and movie pages link to external streaming/download domains configured in `src/lib/watchLinks.js`. This is a trust/compliance risk; the module exists so the list can be reviewed, swapped or emptied in one place.
- **Anonymous device identity:** The generated device key is not authentication. Anyone who obtains it may be able to read that device's Appwrite watchlist, depending on collection permissions. A unique `device_key + movie_id` index is still recommended.
- **No test suite:** the project has no automated tests yet (see §12).

### Medium priority

- **Race in search analytics:** `updateSearchCount` is still a read-then-write; concurrent searches can lose increments.
- **Race in watchlist upsert:** `listDocuments` followed by create/update is not atomic; two tabs can create duplicate documents unless a unique index is enforced.
- **Remote deletion semantics:** An empty remote response does not clear local data (intentional local-first behaviour).
- **Payload schema drift:** JSON movie payloads can become incompatible as TMDB fields or normalization rules change.
- **Image URL trust:** Remote image URLs are placed into CSS background images and `img` sources. Current values mostly originate from TMDB, but a future user-controlled source would need validation.

### Lower priority / maintainability

- `HomePage.jsx` is still large (search, watchlist, dialog and SEO in one file); extracting the detail dialog into its own component would help.
- `VITE_APPWRITE_PROJECT_NAME` was removed from the documented env list because `appwrite.js` never used it.
- `Spin.jsx` depends on Flowbite for a small loading UI while most styling is custom/Tailwind; the dependency could be dropped.


## 14. Recommended Improvement Roadmap

### First pass: security and correctness

1. Rotate the currently local TMDB token if it has ever been exposed.
2. Move TMDB requests behind a Vercel serverless/edge function.
3. Remove or replace unreviewed third-party watch/download links.
4. Configure Appwrite permissions deliberately and replace the device key with authenticated users if cross-device privacy matters.
5. Add unique indexing or a server-side upsert function for `(device_key, movie_id)`.

### Second pass: structure and testability

1. Extract `useMovieSearch`, `useWatchlist`, `useMovieDetails`, and `useRecentSearches` hooks.
2. Move pure storage/normalization/queue functions into tested utility modules.
3. Create one shared poster URL helper.
4. Add API client modules for TMDB and Appwrite with typed response boundaries.
5. Add tests for pure functions first, then component and browser tests.

### Third pass: product quality

1. Add pagination or infinite scroll with an explicit result limit.
2. Add caching and stale-while-revalidate behavior for repeated searches.
3. Improve modal focus trapping and restore focus after close.
4. Add keyboard-native buttons for trending items and watchlist cards.
5. Add observability for API latency, error rates, and sync failures without logging sensitive values.

## 15. Interview Questions and Model Answers

### Architecture

**Q: Why use Vite and React here?**  
**A:** Vite provides fast development feedback and a small static production build, while React provides component rendering and hook-based state management. The application is a single-page client experience, so a client-rendered Vite app is a reasonable fit.

**Q: Is this a three-tier architecture?**  
**A:** Not strictly. It is a browser client that directly calls two external services. There is no custom backend tier. Appwrite is an external persistence service, not code in this repository.

**Q: What is the main architectural weakness?**  
**A:** `App.jsx` is the orchestration boundary for too many concerns. It works for the current scope, but custom hooks and service modules would make state transitions, testing, and future features easier.

### React and state

**Q: Why keep both raw and debounced search terms?**  
**A:** The raw value keeps the input responsive. The debounced value controls network traffic. Comparing them lets the UI communicate that a request is pending.

**Q: How does the app avoid stale search results?**  
**A:** Before each request it aborts the previous controller and increments a request ID. A response updates state only if its ID is still current. The ID check is important because aborting is cooperative and a response may already be resolving.

**Q: Why does the watchlist save effect have a hydration guard?**  
**A:** Without `isWatchlistHydrated`, the initial empty React state could be written to storage before the existing stored list is read, destroying user data. The guard ensures persistence starts after initialization.

**Q: Why use refs instead of state for request IDs and controllers?**  
**A:** They are mutable coordination values that should persist between renders but do not themselves need to trigger a render.

**Q: What does StrictMode change?**  
**A:** In development React may re-run certain lifecycle paths to expose unsafe side effects. Effects and external calls should tolerate repeated setup/cleanup. Production behavior does not include the same development double-invocation pattern.

### APIs and data

**Q: How does an empty query differ from a search query?**  
**A:** Empty input calls TMDB discover sorted by popularity; a non-empty normalized input calls the movie search endpoint with an encoded query.

**Q: Why is `response.ok` checked?**  
**A:** `fetch` resolves for HTTP error statuses. Checking `ok` converts non-2xx responses into the same application error path as network failures.

**Q: How is optional Appwrite configured?**  
**A:** Module-level booleans check whether required environment variables exist. The client is created only when a valid search-tracking or watchlist-sync configuration is present. Missing configuration causes safe no-op or empty-return behavior.

**Q: Why use a local sync queue?**  
**A:** It preserves user intent when Appwrite is unavailable or the browser is offline. Local UI state is immediate, and the ordered mutations can be retried later.

**Q: What consistency model does the watchlist have?**  
**A:** Local-first, eventually synchronized, best-effort consistency. It is not strongly consistent and has no authenticated multi-device conflict protocol.

### Security

**Q: Is `VITE_API_KEY` secret?**  
**A:** No. Vite statically exposes `VITE_*` variables to the client bundle. A bearer token in that variable can be extracted by anyone using the site. It should be restricted/rotated and ideally kept behind a server proxy.

**Q: Is the device key authentication?**  
**A:** No. It is an identifier, not proof of identity. It provides continuity for one browser but not confidentiality or account security.

**Q: What risks come from `window.open`?**  
**A:** The app uses `noopener,noreferrer` for card links, which helps isolate the opener. Trending navigation first opens a blank tab and later changes its location; it should also guard against a blocked/null popup and validate the destination.

### Performance and UX

**Q: What optimizations are already present?**  
**A:** Debouncing, cancellation, stale-response guards, lazy images, async decoding, skeletons, content visibility, static caching, and reduced-motion handling.

**Q: Why use skeletons?**  
**A:** They preserve the expected grid shape and communicate progress without shifting the page as much as a blank loading state.

**Q: What would you measure in production?**  
**A:** Search latency, TMDB error rate, Appwrite sync success/failure, queue length, modal detail latency, image failure rate, Core Web Vitals, and conversion from search to saved movie.

### Testing

**Q: What is missing from the current test strategy?**  
**A:** There are no automated tests beyond lint/build. The highest-value first tests cover pure normalizers and queue logic, then mocked request races and local persistence behavior.

**Q: How would you test request cancellation?**  
**A:** Mock two requests, resolve the older one after the newer one, and assert that only the newer result remains in `moviesList`. Also assert that the old signal was aborted.

**Q: How would you test offline synchronization?**  
**A:** Mock Appwrite failure, toggle a movie, assert local state and queue persistence, dispatch an `online` event after restoring the mock, and assert queued operations are sent and removed only after success.

## 16. Practical Commands

Run from the directory containing `package.json`:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

The default development URL is `http://localhost:5173`.

## 17. Interview Opening Statement

“This is a Vite-powered React movie discovery SPA. The browser queries TMDB for popular and searched movies, while Appwrite optionally records trending searches and synchronizes a watchlist. The watchlist is local-first: it normalizes and persists immediately in localStorage, queues remote mutations for retry, and merges remote data on startup. Search is controlled and debounced, and request IDs plus AbortController prevent stale responses. The main tradeoff is simplicity versus security: direct browser-to-TMDB access keeps the app small, but exposes the bearer token and provides no server-side rate limiting or authenticated user boundary.”
