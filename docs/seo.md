# SEO compliance map — Google SEO Starter Guide

Implementation status for every recommendation in
[Google's SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
Legend: **Auto** = handled by code/build · **Manual** = one-time action outside the repo · **N/A** = does not apply.

## 1. Help Google find your content

| Recommendation | Implementation | Status |
| --- | --- | --- |
| Submit a sitemap | `scripts/generate-sitemap.js` writes `sitemap.xml` (home + 19 genre hubs + prerendered movies, with `lastmod` and `<image:image>` posters) into `dist/`; `robots.txt` points at it | **Auto** |
| Submit it in Search Console | Not possible from code — submit `https://filmpoint.vercel.app/sitemap.xml` in GSC + Bing | **Manual** |
| Offer crawlable links | Prerendered HTML contains 120 movie links + 19 genre links (home), 12 "More like this" + 19 genre links (movie pages), 20 movie links + 18 genre links (genre hubs) | **Auto** |
| Keep links discoverable, not JS-only | Links live in `<details>` disclosures, which still render in the HTML source | **Auto** |
| `robots.txt` | `public/robots.txt` — `Allow: /`, `Disallow: /api/`, sitemap directive; regenerated with the deploy origin | **Auto** |
| Don't block resources Google needs | No `Disallow` on CSS/JS/images; no `X-Robots-Tag` | **Auto** |
| HTTPS | Served by Vercel with automatic TLS | **Auto** |

## 2. Tell Google which pages are important

| Recommendation | Implementation | Status |
| --- | --- | --- |
| `rel="canonical"` | Every route emits an absolute self-canonical (home, genre hubs, movie pages) | **Auto** |
| Internal search results must not be indexed | `/?q=…` renders `noindex, follow`; `/` keeps `index, follow, max-image-preview:large`. Canonical is always the bare origin, so search state never creates duplicates | **Auto** |
| `noindex` where appropriate | 404 route, loading and movie-error states are `noindex, follow` | **Auto** |
| Sitemap contains only real pages | Every sitemap URL is a prerendered page | **Auto** |

## 3. Organize your site

| Recommendation | Implementation | Status |
| --- | --- | --- |
| Logical URLs | `/`, `/genre/action`, `/genre/science-fiction`, `/movie/27205` (stable IMDb-style IDs) | **Auto** |
| Breadcrumbs | Movie pages: visible `Home › Action movies › Title` + `BreadcrumbList` JSON-LD. Genre hubs: `Home › Genre` + JSON-LD | **Auto** |
| Simple navigation | Footer nav (Discover / Watchlist / Trending / Genres), genre + popular-movie dropdowns, genre cross-links, "More like this" | **Auto** |
| One topic per page | `/` discovery, `/genre/:slug` genre intent, `/movie/:id` single film | **Auto** |

## 4. Make your site interesting and useful

| Recommendation | Implementation | Status |
| --- | --- | --- |
| People-first, unique content | Genre hubs have hand-written intros + an "instant answer"; movie pages add quick facts and a 6-question FAQ on top of TMDB data | **Auto** |
| Answer the main question early | One-sentence answer under every movie H1 and in every genre hero | **Auto** |
| Topical depth | 19 genre hubs × 20 ranked films + 12 recommendations per movie | **Auto** |
| E-E-A-T signals | Owner/author info, disclaimer footer, TMDB attribution, "not affiliated" statement, transparent local-storage note | **Auto** |
| Freshness | `lastmod` on every sitemap URL, regenerated each build | **Auto** |
| Editorial review, backlinks, brand mentions | Off-page work — see §8 | **Manual** |

## 5. Influence how your site looks in Search

| Recommendation | Implementation | Status |
| --- | --- | --- |
| Unique `<title>`, keyword first | `buildTitle()` caps at 60 chars; exactly one `<title>` per page (verified) | **Auto** |
| Meta description | Unique, trimmed to ~155 chars per route | **Auto** |
| Structured data | `Movie`, `FAQPage`, `BreadcrumbList`, `CollectionPage` + `ItemList`, `WebSite` + `SearchAction`, `Organization` | **Auto** |
| Sitelinks search box | `WebSite.potentialAction` targets `/?q={search_term_string}` — and `?q=` genuinely performs the search | **Auto** |
| Favicon | `/title.png` (+ apple-touch-icon) | **Auto** |

## 6. Images

| Recommendation | Implementation | Status |
| --- | --- | --- |
| Descriptive `alt` text | Every content image has descriptive alt; decorative icons use `alt=""` | **Auto** |
| Crawlable image URLs | TMDB CDN and local `/newposters/*` are not blocked | **Auto** |
| Image sitemap | `<image:image><image:loc>` entries per movie poster | **Auto** |
| Related images grouped | Poster + backdrop both referenced per movie page | **Auto** |
| Prevent layout shift | `width`/`height` + `aspect-ratio` + `srcset` + `fetchPriority` on the LCP poster | **Auto** |

## 7. Videos

| Recommendation | Implementation | Status |
| --- | --- | --- |
| `VideoObject` with required fields | Trailer schema emits `name`, `description`, `thumbnailUrl`, `uploadDate`, `embedUrl`, `contentUrl`; omitted entirely when those cannot be supplied | **Auto** |
| Video sitemap | **N/A** — trailers are third-party YouTube embeds, not hosted files | **N/A** |

## 8. Promote your website

| Recommendation | Implementation | Status |
| --- | --- | --- |
| Build links / brand mentions | Out of scope for code — genre-hub editorial upgrades + "movies like X" pages are the linkable assets | **Manual** |
| Share on social / communities | Out of scope for code | **Manual** |
| No over-promotion, paid links, link schemes | Nothing automated; no cloaking, doorway pages or link exchanges | **Auto** |

## 9. Things to avoid

| Anti-pattern | Status |
| --- | --- |
| Keyword stuffing | **Avoided** — copy is authored per page, no repetition loops |
| Hidden text / sneaky links | **Avoided** — collapsed content is labelled UI; links are genuine navigation |
| Cloaking or doorway pages | **Avoided** — prerendered HTML matches what users see |
| Duplicate content | **Avoided** — canonical on every page, `?q=` noindex, no homepage soft-404 |
| Auto-generated gibberish | **Avoided** — copy is authored; TMDB supplies film metadata only |
| Soft 404s | **Avoided** — real `404.html` + `noindex` 404 route |

## Manual, one-time (outside the repo)

1. Set `TMDB_API_KEY`, `VITE_API_KEY`, `VITE_SITE_URL` in Vercel (Production + Preview).
2. Submit `sitemap.xml` in **Google Search Console** and **Bing Webmaster Tools**; request indexing for `/`.
3. Confirm Vercel **Deployment Protection** is off for Production (otherwise crawlers hit a login wall).
4. Re-check with **Rich Results Test** (Movie/FAQ), **PageSpeed Insights**, and **URL Inspection** on a movie page.
5. Start the off-page work: genre-hub editorial upgrades, "movies like X" pages, outreach for links.

## Automated guardrails

`npm run build` fails the deploy if prerendering breaks, and these are checked in `dist/`:

- exactly one `<title>` per page, ≤ 60 characters
- absolute canonical + `hreflang` on every route
- `?q=` pages `noindex`
- sitemap generated from the pages that actually exist (`dist/movie/*`, `dist/genre/*`)
- every JSON-LD block is valid JSON with the expected `@type`

