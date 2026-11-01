# Copilot Instructions for FilmPoint

## Project overview
- Statically prerendered React app built with Vite + `vite-react-ssg`. Entry wiring is `src/main.jsx` (`ViteReactSSG({ routes })`), routes live in `src/routes.jsx`.
- Page composition: `src/App.jsx` is the layout shell (`<Outlet />`), `src/pages/HomePage.jsx` is the discovery UI, `src/pages/MovieDetails.jsx` is the prerendered `/movie/:id` page.
- App data flow:
  - The browser always calls TMDB through the same-origin `/api/tmdb` proxy (`src/api/tmdbProxy.js` → `api/tmdb.js` on Vercel, Vite middleware in dev).
  - During SSR/SSG the loader uses `src/api/tmdbServer.js` (gate imports behind `import.meta.env.SSR` so `VITE_API_KEY` never reaches the client bundle).
  - Trending searches and watchlist sync use Appwrite via `src/appwrite.js`.
  - Build-time popular-movie data comes from `src/api/tmdb-ssg.js` (SSG routes, `PopularLinks`, sitemap).
- Shared modules: `src/lib/poster.js` (TMDB images), `src/lib/seo.js` (canonical/OG), `src/lib/watchlist.js` (single watchlist store + offline queue), `src/lib/watchLinks.js` (external provider links), `src/hooks/useDebounce.js`.

## External services & env vars
- TMDB: `VITE_API_KEY` (bearer, server-side only) plus `TMDB_API_KEY` for the Vercel function.
- Appwrite (optional): `VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_DATABASE_ID`, `VITE_APPWRITE_COLLECTION_ID`, `VITE_APPWRITE_ENDPOINT`, optional `VITE_APPWRITE_WATCHLIST_COLLECTION_ID`.
- `VITE_SITE_URL` drives canonical URLs, OG tags and the sitemap origin.

## Key patterns & conventions
- Search is debounced with `useDebounce` (1000 ms) in `HomePage`; never call TMDB directly from components.
- Use `src/lib/poster.js` for every TMDB image URL (it handles w342/w500/w780, `srcset` and the `no-movie.png` fallback).
- Use `src/lib/watchlist.js` for all watchlist reads/writes so local storage, sync queue and Appwrite stay consistent.
- SEO: every page renders one `<Head>` block with title, description, canonical and OG tags; add JSON-LD via `MovieSchema` / `BreadcrumbSchema` / `SiteSchema`.

## Developer workflows
- Install dependencies: `npm install`
- Run dev server: `npm run dev` (Vite, http://localhost:5173, includes the `/api/tmdb` dev proxy)
- Build (prerender + sitemap): `npm run build`
- Lint: `npm run lint`
- Preview build: `npm run preview`

## Files to reference
- Routing and loaders: `src/routes.jsx`
- Discovery UI and watchlist orchestration: `src/pages/HomePage.jsx`
- Prerendered movie page: `src/pages/MovieDetails.jsx`
- TMDB request path: `src/api/tmdbProxy.js`, `api/tmdb.js`, `src/api/tmdbServer.js`
- Appwrite integration: `src/appwrite.js`
- SEO helpers and structured data: `src/lib/seo.js`, `src/components/*Schema.jsx`
- Setup and deployment notes: `README.md`

