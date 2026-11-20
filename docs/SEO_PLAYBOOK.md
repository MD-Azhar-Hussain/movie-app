# SEO Playbook — a build spec any AI agent can follow

> **Purpose:** a project-agnostic, executable specification for making a website indexable,
> rankable and Lighthouse-perfect (100 SEO / 100 Accessibility / 100 Best Practices / 95+
> Performance). Written for an AI agent or a developer who has never seen the codebase.
>
> **Scope:** web apps, marketing sites, docs, e-commerce, blogs — anything served over HTTP.
> Framework examples use React/Vite/Next/Vercel because that is the reference implementation,
> but every rule is stated so it can be mapped to any stack.
>
> **Companion:** `docs/seo.md` is the project-specific compliance map for *this* repo. This
> file is the general playbook. When they disagree, this file wins.

---

## 0. How an agent should use this document

### 0.1 Work order (do not skip ahead)

| # | Phase | Why first |
| --- | --- | --- |
| 0 | Baseline audit (§2) | You cannot claim improvement without a "before" |
| 1 | Crawlability & indexing (§3) | A perfect page nobody can crawl scores nothing |
| 2 | Rendering strategy (§4) | Determines whether content even exists in the HTML |
| 3 | Metadata (§5) | Cheapest, highest-leverage per-page win |
| 4 | Structured data (§6) | Rich results + machine comprehension |
| 5 | Information architecture (§7) | Distributes authority; fixes orphan pages |
| 6 | Content & intent (§8) | What actually ranks |
| 7 | Performance / CWV (§9) | Ranking + UX tiebreaker |
| 8 | Deployment hygiene (§10) | Wrong headers/status codes silently kill everything above |
| 9 | Verification & CI (§11) | Prevents regression on the next commit |

### 0.2 Rules of engagement (non-negotiable for an agent)

1. **Never invent content, ratings, dates, authors or review counts.** Only emit data you can
   read from the codebase or an API response. Fabricated structured data is a manual-action risk.
2. **Never claim a fix without reading the built output.** Verify against the rendered HTML/HTTP
   response, not the source component.
3. **Never ship an audit that blocks deploys on day one.** Warn first, gate later (§11.3).
4. **Prefer one source of truth.** Page copy, canonical path and query must live in one module
   that the page, the sitemap, `llms.txt` and the audit all read (§7.4).
5. **Change one phase at a time and re-measure.** Batched changes make regressions unattributable.
6. **When the brief says "100 SEO", clarify which 100.** Lighthouse SEO (§1.1) is a checklist, not
   a ranking guarantee. Deliver both: the score *and* the fundamentals behind it.
7. **Report honestly.** If a build shipped degraded output (missing API key, dead upstream,
   throttling), say so and point at the diagnostic artifact (§10.4).

### 0.3 Definition of Done (the gate an agent must pass before saying "done")

- [ ] `Lighthouse SEO = 100`, Accessibility = 100, Best Practices = 100 (mobile **and** desktop)
- [ ] Performance ≥ 90 mobile / ≥ 98 desktop on a throttled run (Slow 4G, 4× CPU)
- [ ] Zero `4xx`/`5xx` on any URL present in `sitemap.xml`
- [ ] Every indexable page: exactly one `<title>`, one `<meta name="description">`, one `<h1>`,
      one absolute self-referencing `<link rel="canonical">`
- [ ] `robots.txt` allows crawling and points at the sitemap; sitemap parses and lists real pages
- [ ] Structured data valid on every template that has one (0 errors in Rich Results Test / schema validator)
- [ ] 404 returns HTTP 404 (not 200) with `noindex`
- [ ] No client-only text that a crawler needs (verify by disabling JavaScript)
- [ ] Omni-route audit script exists and passes (§11)
- [ ] Deployed artifact self-reports its commit + page counts (§10.4)

---

## 1. What "100 SEO" really means

### 1.1 The Lighthouse SEO score is only these audit rules

Scoring is binary per audit; ~8 audits are weighted. Hit all of them and you get 100:

| Lighthouse audit | Requirement |
| --- | --- |
| `document-title` | Non-empty `<title>` |
| `meta-description` | `<meta name="description">` present |
| `link-text` | Anchor text is descriptive (no "click here", "read more") |
| `crawlable-anchors` | Links are `<a href>` — not `<div onclick>` / `<span role=link>` |
| `is-crawlable` | Page not blocked by `robots.txt` or `noindex` |
| `robots-txt` | `robots.txt` is valid and not blocking the page |
| `image-alt` | Every `<img>` has `alt` |
| `hreflang` | `hreflang` values are valid (if present) |
| `canonical` | Valid canonical (not an error page, not cross-origin nonsense) |
| `font-size`, `plugins`, `tap-targets` | Readability / mobile-friendliness checks |

> That is a **hygiene score**. It does not measure ranking. Deliver §3–§9 too.

### 1.2 The real ranking surface (what the score does not tell you)

| Pillar | Practical test |
| --- | --- |
| Indexability | Is the URL in the sitemap, crawlable, 200, canonical-clean, unique? |
| Intent match | Does the page fully answer the query implied by its title? |
| Internal links | Can a crawler reach it in ≤3 clicks from the home page? |
| Content depth | Is there enough first-hand substance to beat the current top 10? |
| Experience | Do CWV pass *in the field* (CrUX), not just in the lab? |
| Trust (E-E-A-T) | Author/entity signals, sources, contact, no deceptive patterns |

---

## 2. Phase 0 — Baseline audit

Run this before touching anything and save the output; every later claim refers back to it.

```bash
# 1. Build and serve the real artifact (never measure the dev server)
npm run build && npm run preview

# 2. Lab measurement, both form factors
npx lighthouse http://localhost:4173/ --preset=desktop --chrome-flags="--headless=new"
npx lighthouse http://localhost:4173/ --chrome-flags="--headless=new"

# 3. What a crawler actually receives (no JavaScript)
curl -s http://localhost:4173/ | grep -o '<title>[^<]*</title>'
curl -sI http://localhost:4173/some/deep/page        # status code matters
curl -s http://localhost:4173/ | grep -c 'application/ld+json'

# 4. Machine surface
curl -s http://localhost:4173/robots.txt
curl -s http://localhost:4173/sitemap.xml | grep -c '<loc>'
```

Record a baseline table: `route | status | title | description | canonical | h1 | json-ld types |
images-without-alt`, plus: page count, prerendered vs client-only routes, sitemap URL count,
404 behaviour, indexable/noindex split, CWV numbers, third-party scripts, total JS KB, largest image.

**The baseline is the only thing that proves you improved anything.** Keep it in the PR or the repo.

---

## 3. Phase 1 — Crawlability & indexing

### 3.1 `robots.txt` — allow what you want indexed

```
# Minimal correct file
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Rules:

- **One absolute `Sitemap:` line per sitemap.** Full URL, with protocol.
- `Disallow` only blocks *crawling*, never indexing. To remove a page from the index use `noindex`
  — and allow crawling of it so the crawler can actually see the directive.
- Do **not** `Disallow: /api/` when pages render content client-side from that API — a blocked API
  is an empty page to Googlebot.
- Never block the CSS, JS, fonts or images the page needs to render.
- Keep `/admin`, `/cart`, `/checkout`, `/search?q=` out of the index with `noindex`, not robots.
- Serve `text/plain` at `/robots.txt`, HTTP 200, no redirect.

```
# Multi-environment template
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /preview/

Sitemap: https://example.com/sitemap.xml
```

### 3.2 `sitemap.xml` — generated, never hand-maintained

Hard requirements:

- Generated **from the build output** (pages that actually exist), never from a wish-list.
- Canonical, 200-status, `index`able URLs only. Never 404s, redirects or `noindex` pages.
- Absolute URLs with the production origin, XML-escaped (`&` → `&amp;`).
- `<lastmod>` in W3C form (`2026-11-02` or full ISO-8601) and only when it is accurate — a
  `lastmod` that changes on every build teaches Google to ignore the field entirely.
- No duplicate `<loc>` values.
- ≤ 50,000 URLs and ≤ 50 MB uncompressed per file; otherwise split with a sitemap index.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/widgets/blue</loc>
    <lastmod>2026-11-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>https://cdn.example.com/widgets/blue-1200.jpg</image:loc>
      <image:title>Blue widget, front view</image:title>
    </image:image>
  </url>
</urlset>
```

Sitemap index (recommended above ~10k URLs):

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc><lastmod>2026-11-02</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-products.xml</loc><lastmod>2026-11-02</lastmod></sitemap>
</sitemapindex>
```

Priority guidance (relative, within one file): home `1.0`; primary hubs `0.9`; detail pages
`0.6–0.8`; legal/utility `0.3`. `changefreq` is a hint — never fake `hourly`.

**Verification:** `count(<loc>)` must equal the number of prerendered indexable routes. If they
differ, the generator is lying about the build — treat that as a bug, not a warning.

### 3.3 Canonicals

- Every indexable page emits **one absolute, self-referencing** canonical using the production origin.
- Two canonicals on a page = no canonical.
- A canonical must never point at a `noindex` page, a redirect, a 404, or a different-language page
  unless consolidation is the intent.
- Query/filter/sort/UTM variants canonicalise to the clean URL.
- Paginated listings self-canonicalise per page (`?page=2` is its own canonical), not all to page 1.
- Pick a trailing-slash policy and enforce it with a 301 everywhere (`/x/` → `/x`).


### 3.4 Status codes (the silent killer)

| Situation | Correct response |
| --- | --- |
| Page exists | `200` |
| Page moved permanently | `301` to the new URL (single hop, no chains) |
| Temporary move / maintenance | `302` or `307` |
| Page intentionally deleted | `410` (faster removal than 404) |
| Page never existed | `404` |
| Site overloaded / temporary outage | `503` + `Retry-After` (Google retries; 404 tells it to drop the URL) |
| SPA route that matched no page | `404` — **never** `200` with a "not found" body (soft 404) |

**Soft-404 rule:** an unknown URL must not render the home page, a generic shell, or any page that
returns `200`. Serve a real 404 page *with* a 404 status code.

### 3.5 `noindex` discipline

| Page type | Directive |
| --- | --- |
| Money/content pages | `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` |
| Internal search results (`?q=`) | `noindex, follow` |
| 404, error, loading, empty states | `noindex, follow` |
| Thank-you / checkout / account | `noindex, nofollow` |
| Staging/preview deployments | `noindex` sitewide **and** platform protection |

`X-Robots-Tag` header equivalents are useful for non-HTML (PDF, JSON, images).

### 3.6 hreflang (only if you ship multiple languages)

Reciprocal, absolute, and self-referencing:

```html
<link rel="alternate" hreflang="en" href="https://example.com/en/page" />
<link rel="alternate" hreflang="de" href="https://example.com/de/page" />
<link rel="alternate" hreflang="x-default" href="https://example.com/page" />
```

Every cluster must link to every member *and* itself, or the whole cluster is ignored.

### 3.7 URL design

- Lowercase, hyphenated, ASCII, no parameters for primary content.
- Stable: never change a live URL without a 301 map.
- Depth is fine if the path describes hierarchy: `/genres/science-fiction/`.
- No session IDs, no `index.php?cat=3&id=9`, no dates that imply staleness unless intentional.

---

## 4. Phase 2 — Rendering strategy

### 4.1 Decision table

| Content type | Strategy | Why |
| --- | --- | --- |
| Marketing / landing pages | SSG (static HTML at build) | Fastest LCP, zero JS required to read |
| Large content catalog (products, articles, movies, docs) | SSG for the top N + SSR/ISR fallback | Indexable without shipping a browser to the crawler |
| Dashboards, account pages | CSR (behind `noindex` anyway) | No indexing requirement |
| Anything with unique title/description | Must exist in the initial HTML | SEO tags discovered only after JS are unreliable |

### 4.2 Non-negotiables

1. **The first HTML response must contain** the `<title>`, description, canonical, `<h1>`, main body
   text and links. Test with JavaScript disabled.
2. **A router-level 404 must not return 200** (§3.4).
3. **Do not render "Loading…" as preredered content.** If a data fetch failed at build time, render
   the explicit empty/error state with `noindex` — never a spinner with no `<h1>`.
4. **Hydration must not change the DOM structure** of above-the-fold content (see §9.3, CLS).
5. **Keep loader/state data small.** Serialising the whole store into the HTML bloats LCP.
6. **Never fs-read at render time on the edge** — resolve data at build time or via a cached API.

### 4.3 Prerender budget

Prerendering is the highest-value SEO lever and also the slowest build step. Budget it:

- Prerender: home, all taxonomy/hub pages, the top N detail pages by demand (start at 200–500),
  and every page linked from the primary navigation.
- Everything else: SSR on request or client-render with a server-rendered shell — still indexable,
  just not pre-warmed.
- Measure the build: if prerendering 5k pages takes 30 min, cut N and add a sitemap-priority ladder
  instead of prerendering the tail.


---

## 5. Phase 3 — Metadata templates

### 5.1 Title

Formulas (pick per template, keep the primary keyword first):

| Template | Formula | Target length |
| --- | --- | --- |
| Home | `Brand | Primary value proposition` | 45–60 chars |
| Category/hub | `Best <plural keyword> <qualifier> - Brand` | 45–60 |
| Detail | `<Item name> (<year/qualifier>) - Brand` | 40–60 |
| Comparison | `<A> vs <B>: <outcome> - Brand` | 45–60 |
| Docs article | `<Task you can complete> - Brand Docs` | 40–60 |

Rules: one `<title>` per page, unique across the site, no keyword stuffing, no all-caps, brand
last (except the home page). Truncate the *base* string, never the brand.

```js
const buildTitle = (primary, { suffix = 'Brand', maxLength = 60 } = {}) => {
  const base = String(primary).replace(/\s+/g, ' ').trim();
  const withSuffix = `${base} - ${suffix}`;
  if (withSuffix.length <= maxLength) return withSuffix;
  return `${base.slice(0, maxLength - suffix.length - 6).trimEnd()}...`;
};
```

### 5.2 Meta description

- 120–158 characters; unique per page; written for click-through, not for ranking.
- Include the primary entity, one differentiator, and an implicit call to action.
- Never duplicate the title verbatim. Never leave it empty. Never auto-truncate mid-word.
- Do **not** put prices/ratings here unless they are real and current.

```js
const truncate = (text, max = 155) =>
  text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
```

### 5.3 Open Graph + Twitter

```html
<meta property="og:site_name" content="Brand" />
<meta property="og:type" content="website" />          <!-- or article / video.movie / product -->
<meta property="og:title" content="…" />
<meta property="og:description" content="…" />
<meta property="og:url" content="https://example.com/page" />
<meta property="og:image" content="https://example.com/og/page.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="…" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="…" />
<meta name="twitter:description" content="…" />
<meta name="twitter:image" content="…" />
```

Image spec: **1200×630**, PNG/JPG, < 300 KB, absolute URL, readable at 300 px wide, no critical
text within 60 px of any edge. Generate them at build time rather than reusing a logo
(a 200×200 logo renders as a thumbnail and loses every large card).

### 5.4 Everything else worth emitting

```html
<html lang="en">
  <meta charset="utf-8">                     <!-- first 1024 bytes, before any big meta block -->
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b0b12">
  <link rel="icon" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="canonical" href="https://example.com/page">
</head>
```

### 5.5 Metadata engineering rules

- **One component/helper renders the whole head.** Hand-written heads drift (this is how `og:image`
  went missing on an entire page type in the reference project).
- Escape `"`, `<`, `&` in attribute values; never interpolate raw user/database text into `content=`.
- Assert uniqueness in CI: no two pages may share a `<title>` or canonical (§11.2).
- Keep `<meta charset>` first — if the prerenderer injects a big meta block before it, the browser
  re-parses the document and Lighthouse's `charset` audit fails.


---

## 6. Phase 4 — Structured data (JSON-LD)

### 6.1 Pick types by template (one primary type per page)

| Page template | Primary type | Supporting types |
| --- | --- | --- |
| Home | `WebSite` (+ `SearchAction`) | `Organization` |
| Article / blog post | `Article` or `NewsArticle` | `BreadcrumbList`, `Person` (author) |
| Product detail | `Product` | `Offer`, `AggregateRating`, `BreadcrumbList` |
| Movie / TV page | `Movie` / `TVSeries` | `VideoObject` (trailer), `BreadcrumbList` |
| List / category / hub | `CollectionPage` | `ItemList` of the items, `BreadcrumbList` |
| FAQ section | `FAQPage` | — |
| Docs / how-to | `HowTo` / `TechArticle` | `BreadcrumbList` |
| Local business | `LocalBusiness` | `OpeningHoursSpecification`, `GeoCoordinates` |
| Software / app | `SoftwareApplication` | `AggregateRating`, `Offer` |

### 6.2 Required properties that actually matter

| Type | Must have | Optional but valuable |
| --- | --- | --- |
| `Movie` | `name`, `url` | `image`, `description`, `datePublished`, `duration`, `genre`, `director`, `actor`, `aggregateRating`, `trailer` |
| `Article` | `headline`, `image`, `datePublished`, `author`, `publisher` | `dateModified`, `mainEntityOfPage` |
| `Product` | `name`, `image`, `offers` | `brand`, `sku`, `aggregateRating`, `review` |
| `VideoObject` | `name`, `description`, `thumbnailUrl`, `uploadDate` | `duration`, `contentUrl`, `embedUrl` |
| `BreadcrumbList` | `itemListElement[].position`, `.name`, `.item` | — |
| `FAQPage` | `mainEntity[].name`, `.acceptedAnswer.text` | — |
| `Organization` | `name`, `url`, `logo` | `sameAs`, `contactPoint` |
| `ItemList` | `itemListElement[]` | `numberOfItems`, `itemListOrder` |

If a required property is unknowable, **omit the whole node** rather than emitting a half-empty one.

### 6.3 The `@graph` + `@id` pattern (preferred)

One script, shared identifiers, so references resolve instead of duplicating disconnected objects:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://example.com/#website", "url": "https://example.com/",
      "name": "Brand", "publisher": { "@id": "https://example.com/#organization" } },
    { "@type": "Organization", "@id": "https://example.com/#organization", "name": "Brand",
      "url": "https://example.com/", "logo": { "@type": "ImageObject",
      "url": "https://example.com/logo.png", "width": 512, "height": 512 } },
    { "@type": "Movie", "@id": "https://example.com/movie/550#movie",
      "name": "Fight Club", "url": "https://example.com/movie/550",
      "sameAs": ["https://www.themoviedb.org/movie/550"],
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://example.com/movie/550" },
      "isPartOf": { "@id": "https://example.com/#website" } }
  ]
}
```

### 6.4 Rules

- JSON-LD only. Microdata/RDFa is legacy noise for new work.
- The markup must **match visible content** — a rating in JSON-LD that is not on the page is a
  violation; inventing `aggregateRating` is a manual-action risk.
- Escape `<` in the JSON (`JSON.stringify(x).replace(/</g, '\\u003c')`) so a title containing
  `</script>` cannot break out of the block.
- `datePublished`/`dateModified` must be ISO-8601 (`2026-11-02T10:00:00+00:00`).
- `aggregateRating`: `ratingValue` inside `worstRating..bestRating`, `ratingCount` ≥ 1.
- One `FAQPage` per page, and only if the Q&A is visible on that page.
- Do not put `Organization` and `WebSite` on every page *and* also a second copy in a footer
  component — duplicate nodes at different `@id`s dilute and confuse.
- Validate with the Rich Results Test **and** validator.schema.org (strict types) before shipping;
  keep the output in the PR description.

### 6.5 Rich-result eligibility cheat sheet

`Article` (Top stories), `Product` (merchant listings + reviews), `Movie` (movie carousel),
`Recipe`, `Event`, `FAQPage` (limited to authoritative sites), `HowTo` (mobile), `BreadcrumbList`
(URL breadcrumb in the SERP), `VideoObject` (video thumbnail), `SoftwareApplication`
(app rating), `Organization` (knowledge panel input), `Sitelinks search box` via `WebSite` +
`SearchAction`.


---

## 7. Phase 5 — Information architecture & internal linking

### 7.1 Shape

```
Home
├── Hubs (category / genre / topic)         ← high internal PageRank, unique copy each
│   ├── Detail pages (top N prerendered)
│   └── Related hubs (siblings, cross-linked)
├── Curated/collection lists                ← "best X of <year>", "top rated", comparisons
└── Utility (about, contact, legal, 404)
```

### 7.2 Hard rules

- **Click depth ≤ 3** from home to any page you want ranked. Audit it: crawl the built site and
  compute distance.
- **No orphan pages.** Every prerendered URL must be linked from at least one other page.
- Every page links back **up** (breadcrumb) and **sideways** (siblings/related).
- Anchor text = the target's topic in natural language. Never "click here", never a raw URL,
  never 40 identical "learn more" links.
- Real `<a href>` elements. `onClick` navigation is invisible to crawlers and fails Lighthouse's
  `crawlable-anchors`.
- Collapsible navigation is fine — `<details>`/`<summary>` keeps anchors in the HTML. Tabs driven
  by JS that unmount content are not.

### 7.3 Link inventory pattern (crawl surface without clutter)

Render link groups as native disclosures so crawlers see everything while humans see a tidy page:

```jsx
<details className="link-dropdown">
  <summary>Browse all 243 pages</summary>
  <nav aria-label="All pages">
    <ul>{pages.map((p) => <li key={p.path}><a href={p.path}>{p.title}</a></li>)}</ul>
  </nav>
</details>
```

### 7.4 One source of truth for page definitions

If the sitemap, the `llms.txt`, the nav and the page disagree about which pages exist or what they
are called, you get orphan pages and stale metadata. Define every generated page **once**:

```js
// src/lib/collections.js — imported by the route table, the page, the sitemap, llms.txt, the audit
export const COLLECTIONS = [
  { path: '/top-rated', heading: 'Top Rated Movies of All Time', tmdbPath: '/movie/top_rated?page=1' },
  ...
];
```

### 7.5 Distribution rules

- Home page: link to every hub (≤ 20 links above the fold is a good target).
- Hub pages: link to their details (20–40) and to sibling hubs.
- Detail pages: link up to their hub, sideways to 8–12 related details.
- Footer: link the hub index, the newest/most valuable lists, and legal pages.
- Keep `<nav>` regions labelled (`aria-label`) — helps accessibility scoring and crawler semantics.

---

## 8. Phase 6 — Content, intent and E-E-A-T

### 8.1 One page, one intent

| Intent | Page type | The test |
| --- | --- | --- |
| Navigational | Home, hub | Does the URL predict the content? |
| Informational | Article, docs, FAQ | Does it answer the question in the first 100 words? |
| Commercial | Comparison, "best X", pricing | Is the comparison honest and specific? |
| Transactional | Product, signup | Is the price/CTA above the fold? |

Do not mix intents on one URL. A "best of" list that also tries to be a product page ranks for neither.

### 8.2 Direct-answer block

Put a self-contained, extractable sentence directly under the `<h1>`:

> *Film Point* — "Right now the most popular action movie is **The Dark Knight (2008)**, rated
> 8.5/10 by TMDB users."

That single sentence wins featured snippets and AI answer engines, and forces you to actually know
the answer.

### 8.3 Thin / duplicate content thresholds

| Signal | Action |
| --- | --- |
| < 300 words of unique body text on an indexable page | Add substance or `noindex` it |
| Templated pages differing only by a name | Add unique data (specs, ratings, FAQ, comparison) or do not index |
| Same content, two URLs | 301 or canonical — never leave both indexable |
| Empty state rendered at build time | Do not prerender it as indexable; render an honest `noindex` empty state |
| Paginated near-duplicate listings | Self-canonical, `noindex` the deep pages if they are worthless |

### 8.4 E-E-A-T signals that are cheap to add

- Named author with a bio and `sameAs` links (`Person` schema) on articles.
- A real `/about` and `/contact` page, linked in the footer.
- Sources/citations for factual claims; a "last updated" date that is accurate.
- Clear disclosure for affiliate or third-party links.
- No deceptive interstitials, no auto-playing audio, no cookie-wall-before-content.

### 8.5 AI/answer-engine optimization (2026 reality)

- Prefer short factual sentences and tables — they are what gets quoted.
- Emit `llms.txt` at the origin root: a plain-text inventory of the site's canonical pages grouped by
  type, generated from the build (never hand-maintained).
- Keep JSON-LD and the visible text consistent; AI crawlers cross-check.
- Allow `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended` in `robots.txt` unless you have a
  licensing reason not to.


---

## 9. Phase 7 — Core Web Vitals & performance budget

### 9.1 Thresholds to target

| Metric | Good (field) | Ship target (lab, Slow 4G / 4× CPU) |
| --- | --- | --- |
| LCP | ≤ 2.5 s | ≤ 1.5 s |
| INP | ≤ 200 ms | equivalent TBT ≤ 100 ms |
| CLS | ≤ 0.1 | ≤ 0.05 |
| FCP | — | ≤ 1.2 s |
| TBT | — | ≤ 100 ms |
| Total JS (compressed) | — | ≤ 200 KB for a content page |
| First-load image weight | — | ≤ 300 KB |
| Fonts | — | ≤ 2 families, ≤ 4 files, preloaded, `font-display: swap` |

Score translation (Lighthouse 10+): a 100 needs LCP ≤ ~1.2 s, TBT ≤ ~50 ms, CLS < 0.02 on mobile
emulation. Anything at 98 is usually TBT/JS-bound.

### 9.2 LCP

- One LCP candidate per page. The hero image/heading must **not** be `loading="lazy"`.
- `fetchpriority="high"` on the hero image; `<link rel="preload" as="image" href="…" fetchpriority="high">`
  when it is a CSS background.
- Never hide the LCP element behind hydration.
- `preconnect` to the image/API origins you actually use in the first 200 ms; `dns-prefetch` as a
  cheap fallback. Do not preconnect to 8 origins — it delays the critical ones.
- Serve modern formats (`avif` → `webp` → `jpg` fallback) at the rendered size via `srcset`/`sizes`.

### 9.3 CLS

- Width/height (or `aspect-ratio`) on **every** media element, including avatars and icons.
- Skeletons/placeholders must occupy the **same box** as the content that replaces them (mismatched
  skeleton→content sizes were the single largest CLS source in the reference project: 0.516 → 0.049
  came from fixing exactly this).
- Reserve space for banners, cookie bars, ads and the sticky header.
- `font-display: swap` **plus** metric-matched fallbacks (`size-adjust`/`ascent-override`) to stop
  font-swap shifts.
- Never inject above-the-fold DOM after paint (toasts, "new" ribbons, late-loaded nav).

### 9.4 INP / TBT

- Ship less JS to the initial route: route-level code splitting, `import()` for modals/charts.
- No third-party script before first interaction that is not needed for paint (tag managers, chat
  widgets, A/B tools) — load them on `requestIdleCallback` or after the first input.
- Keep hydration cheap: memoise, avoid re-rendering large lists on every keystroke, debounce search.
- Long tasks: break work into `requestIdleCallback`/`scheduler.yield` chunks.

### 9.5 Fonts

```html
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
```

Self-host (removes a DNS+TLS round trip), subset to `latin`, `unicode-range` per subset, `swap`.

### 9.6 Measurement discipline

- Lab (Lighthouse) = development guardrail. Field (CrUX / RUM) = truth. Never claim Core Web Vitals
  pass from lab data alone; state which you measured.
- Localhost has no latency — if you report Speed Index from localhost, say so.
- Re-run mobile **and** desktop; a desktop 100 hides a mobile TBT problem.


---

## 10. Phase 8 — Deployment & HTTP hygiene

### 10.1 Cache headers (by asset class)

| Path | Header |
| --- | --- |
| Hashed assets (`/assets/*`) | `public, max-age=31536000, immutable` |
| Fonts, `/images/*` | `public, max-age=31536000, immutable` |
| HTML | `public, max-age=0, s-maxage=600, stale-while-revalidate=86400` |
| `sitemap.xml`, `robots.txt`, `llms.txt` | `public, max-age=3600, s-maxage=3600` |
| API responses | `s-maxage` + `stale-while-revalidate`, never `immutable` |
| Any diagnostics endpoint | `no-store` |

### 10.2 Security headers (also scored by Lighthouse Best Practices)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
Cross-Origin-Opener-Policy: same-origin-allow-popups
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 10.3 Routing rules

- `cleanUrls` / trailing-slash policy consistent with canonicals and sitemap.
- SPA rewrites only for routes the app really handles; unknown paths must 404, not rewrite to `/`.
- Serving `/build/x` as `/x`: make sure the prerendered `x/index.html` is preferred over the SPA shell
  (filesystem first, rewrite second) — otherwise every page becomes the same generic shell.
- Force HTTPS and a single canonical host (`www` → apex or the reverse), 301.

### 10.4 Stale-deployment detection (the artifact that ends "it works locally")

Ship a build report into the output and expose it:

```json
// /build-info.json  (generated at build time, noindex, no-store)
{
  "builtAt": "2026-11-02T01:14:35.521Z",
  "commit": "c434c61",
  "branch": "main",
  "commitSubject": "feat: …",
  "siteUrl": "https://example.com",
  "pageCounts": { "movies": 200, "genres": 19 },
  "problems": []
}
```

Rules:

- Report the **commit sha**, so anyone can prove whether production is current.
- Report **page counts** and an explicit `problems[]` array for degraded builds.
- Mark it `noindex` + `no-store`; never expose secrets (booleans for key presence only).
- Also expose a runtime twin (`/api/build-info`) that works even if the static file is missing.
- Serve it in `dev`/`preview` too, so it never 404s during development.

### 10.5 Build failure policy

A build that hard-fails on a missing secret leaves the **previous** deployment live — which looks
like "my fixes did nothing". Prefer: **warn loudly, publish, and report the problem in
`/build-info.json`**. Offer an opt-in strict mode (`STRICT_*=1`) for teams that want the gate.

Never make a *SEO audit* fail the deploy by default (`SEO_AUDIT_STRICT` opt-in) — same reasoning.

### 10.6 Environments

- Staging/preview: `noindex` sitewide + platform deployment protection **on**.
- Production: protection **off** for crawlers, `noindex` removed, sitemap submitted.
- Never share a canonical origin between staging and production.


---

## 11. Phase 9 — Verification & CI guardrails

### 11.1 Two scripts every project should have

| Script | Reads | Purpose |
| --- | --- | --- |
| `seo:audit` | the **build output** (`dist/`) | Catch regressions in HTML/metadata/schema before deploy |
| `verify:deploy` | the **live origin** | Prove production is current and healthy |

Both must print a per-check report and a final verdict. Neither may require a browser.

### 11.2 What `seo:audit` must check (spec)

For every HTML file in the output:

- exactly one `<title>`; length 10–65
- `<meta name="description">` present; length 50–175
- exactly one `<h1>`
- exactly one absolute `rel=canonical`, matching the page URL; **no canonical shared by two pages**
- `<html lang>` present; `<meta charset>` within the first 1024 bytes
- `robots` meta present; `noindex` only on non-indexable templates
- `og:image` + `og:title` + `twitter:card` present
- every `<img>` has `alt` (empty `alt` allowed only for decorative images)
- every `application/ld+json` block parses

Across the output:

- `sitemap.xml` lists exactly the prerendered indexable pages; no duplicates; image entries present
- every sitemap `<loc>` maps to a file that exists
- `robots.txt` has the correct absolute `Sitemap:` line and does not block everything
- `404.html` exists, is `noindex`, and carries a title/description
- `build-info.json`, `llms.txt`, social image exist
- exit non-zero **only** in strict mode; otherwise print errors loudly

```js
// skeleton — adapt the file walk to your output directory
for (const file of walk(dist)) {
  const html = read(file);
  const url = urlFor(file);
  if (count(html, /<title[\s>]/g) !== 1) fail(url, 'expected exactly one <title>');
  if (!/<link[^>]+rel="canonical"[^>]+href="https?:\/\//i.test(html)) fail(url, 'missing absolute canonical');
  if ((html.match(/<h1\b/g) || []).length !== 1) fail(url, 'expected exactly one <h1>');
  for (const m of html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) fail(url, '<img> without alt');
}
```

### 11.3 What `verify:deploy` must check (spec)

```
GET /build-info.json     200 + commit matches local HEAD + problems[] empty
GET /api/build-info      200 + environment + commit
GET /api/health          200 + required secrets present (booleans)
GET /robots.txt          200 + Sitemap directive
GET /sitemap.xml         200 + URL count sane
GET /, /hub, /list, /detail/1   200 + canonical present
GET /llms.txt            200 + non-trivial size
```

Print `OK`/`FAIL` per line and exit non-zero on failure. When `build-info` is the only failure, say
it plainly: *the live deployment predates the current build*.

### 11.4 Lighthouse CI budgets

```jsonc
// lighthouserc.json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:seo": ["error", { "minScore": 1 }],
        "categories:accessibility": ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:performance": ["warn", { "minScore": 0.9 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 200 }]
      }
    }
  }
}
```

### 11.5 Search-engine setup (manual, cannot be automated)

1. Verify the property in **Google Search Console** (DNS TXT or an HTML file) and add
   **Bing Webmaster Tools** (import from GSC).
2. Submit `sitemap.xml` in both; request indexing for the home page and each new hub.
3. Watch **Pages → Why pages aren't indexed** weekly; every row is a real bug (soft 404, duplicate
   canonical, crawled-not-indexed = thin content).
4. Watch **Core Web Vitals** (field data) and **Enhancements** (structured-data errors).
5. Set a reminder to review **Performance → Queries** and build pages for the near-miss queries.


---

## 12. Per-release checklist (paste into the PR template)

```markdown
- [ ] New route(s) added to the route table, the SSG/SSR list, the sitemap and the link inventory
- [ ] Unique title (≤60) + description (120–158) + one H1 for every new template
- [ ] Canonical is absolute and self-referencing; trailing-slash policy respected
- [ ] `og:image` present and 1200×630; `twitter:card` present
- [ ] Structured data validates; matches visible content
- [ ] Internal link from an existing page to the new page (no orphans)
- [ ] `noindex` on any page that is empty/thin/duplicated
- [ ] `npm run seo:audit` → 0 errors
- [ ] Lighthouse mobile: SEO/A11y/BP = 100; Performance ≥ 90
- [ ] CLS unchanged or better; no new lazy-loaded above-the-fold image
- [ ] `npm run verify:deploy` after deploy → all OK, commit matches
```

## 13. Pre-launch checklist (once per project)

```markdown
Content & IA
- [ ] One intent per URL; ≤3 clicks from home to every money page
- [ ] Direct-answer sentence under each key H1
- [ ] No thin (<300 words unique) indexable pages
- [ ] Unique title + description on 100% of pages

Technical
- [ ] Content present in the initial HTML (JS disabled test)
- [ ] 404 → HTTP 404 + noindex; 410 for deleted; 503 + Retry-After for outages
- [ ] robots.txt allows crawl, points at sitemap; staging is noindex
- [ ] sitemap.xml generated from build output; no 404/redirect/noindex URLs
- [ ] Absolute self-canonicals; one per page; no cross-page duplicates
- [ ] JSON-LD valid on every template; `@graph` + shared `@id`s
- [ ] Social card 1200×630 <300KB; favicons 16/32/180
- [ ] `llms.txt` generated
- [ ] Security + cache headers; HTTPS + single canonical host
- [ ] `/build-info.json` (or equivalent) reports commit + counts + problems

Performance
- [ ] LCP ≤ 1.5s lab / ≤ 2.5s field; CLS ≤ 0.05; TBT ≤ 100ms; INP ≤ 200ms
- [ ] Hero image not lazy; `fetchpriority=high`; modern formats; width/height on all media
- [ ] Fonts self-hosted, preloaded, `swap`, ≤2 families
- [ ] Third-party JS deferred past first paint
- [ ] Page weight budget documented and enforced

Observability
- [ ] GSC + Bing verified, sitemap submitted, indexing requested for hubs
- [ ] `seo:audit` wired into build; `verify:deploy` run after every release
- [ ] Uptime/perf alerting on the sitemap and home page
```

## 14. Anti-patterns that lose points (or get you deindexed)

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| Client-only rendering of primary content | Crawler sees an empty shell | SSG/SSR (§4) |
| Soft 404 (unknown URL → 200 home page) | Duplicate content + wasted crawl budget | Real 404 status (§3.4) |
| `Disallow` + `noindex` on the same URL | Crawler can never see the `noindex` | Keep it crawlable, use `noindex` (§3.1) |
| Multiple/no canonicals; canonicals to page 1 for pagination | Wipes out deep pages | Self-canonical per page (§3.3) |
| `loading="lazy"` on the hero image | Delays LCP by a full network hop | `eager` + `fetchpriority=high` (§9.2) |
| Skeleton smaller than the content it replaces | Large CLS | Identical box (§9.3) |
| 200×200 `og:image` | Thumbnail-only social cards | 1200×630 at build time (§5.3) |
| Title/description duplicated across 500 pages | Same as having none | Template + unique data (§5) |
| JSON-LD that does not match the page | Manual action risk | Emit only visible facts (§6.4) |
| Hand-maintained sitemap | Drifts; lists 404s | Generate from build (§3.2) |
| Build hard-fails on a missing secret | Stale deployment stays live, silently | Warn + report (§10.5) |
| `id="root"` with 5 MB of inline state | Bloats LCP, blocks parsing | Trim loader data (§9.4) |
| Blocking `/api/` while rendering from it | Empty pages for Googlebot | Allow it or SSR (§3.1) |
| Interstitials before content | Mobile-unfriendly penalty | Inline banners (§8.4) |

## 15. Reference implementation map (this repository)

| Playbook section | File |
| --- | --- |
| §3.1–3.3 robots/sitemap/canonical | `scripts/generate-sitemap.js`, `src/components/SeoHead.jsx` |
| §4 rendering strategy | `vite.config.js` (`ssgOptions.includedRoutes`), `src/routes.jsx` |
| §5 metadata | `src/components/SeoHead.jsx`, `src/lib/seo.js`, `scripts/generate-og-image.mjs` |
| §6 structured data | `src/lib/schema.js`, `src/components/JsonLd.jsx`, `MovieSchema`, `SiteSchema`, `FaqSchema`, `BreadcrumbSchema` |
| §7 IA & links | `src/components/{GenreLinks,PopularLinks,CollectionLinks,MovieLinkGrid}.jsx`, `src/lib/collections.js` |
| §8 content | `src/pages/{GenrePage,CollectionPage,GenresIndexPage,MovieDetails}.jsx` |
| §9 performance | `src/index.css`, `src/components/MovieCard.jsx`, `index.html` |
| §10 deployment | `vercel.json`, `scripts/build-info.mjs`, `api/{build-info,health,tmdb}.js` |
| §11 verification | `scripts/seo-audit.mjs`, `scripts/verify-deploy.mjs`, `scripts/mock-tmdb-server.mjs` |
| Project-specific map | `docs/seo.md` |


---

## Appendix A — Head snippet to copy

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Primary keyword first - Brand</title>
    <meta name="description" content="120-158 character summary with the entity, the differentiator and an implicit CTA.">
    <link rel="canonical" href="https://example.com/page">
    <link rel="alternate" hreflang="en" href="https://example.com/page">
    <link rel="alternate" hreflang="x-default" href="https://example.com/page">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta property="og:site_name" content="Brand">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Primary keyword first - Brand">
    <meta property="og:description" content="120-158 character summary.">
    <meta property="og:url" content="https://example.com/page">
    <meta property="og:image" content="https://example.com/og/page.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Describe the image for screen readers and social">
    <meta property="og:locale" content="en_US">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="preconnect" href="https://cdn.example.com" crossorigin>
    <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  </head>
  <body>
    <h1>The page's single primary heading</h1>
    <p>Direct answer in the first 100 words.</p>
    <img src="/hero.avif" alt="Descriptive alt" width="1200" height="630" fetchpriority="high" decoding="async">
  </body>
</html>
```

## Appendix B — JSON-LD starter graph

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://example.com/#website",
      "url": "https://example.com/", "name": "Brand", "inLanguage": "en",
      "publisher": { "@id": "https://example.com/#organization" },
      "potentialAction": { "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://example.com/search?q={q}" },
        "query-input": "required name=q" } },
    { "@type": "Organization", "@id": "https://example.com/#organization",
      "name": "Brand", "url": "https://example.com/",
      "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png", "width": 512, "height": 512 },
      "sameAs": ["https://github.com/brand", "https://x.com/brand"] },
    { "@type": "BreadcrumbList", "@id": "https://example.com/page#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
        { "@type": "ListItem", "position": 2, "name": "Page", "item": "https://example.com/page" }
      ] },
    { "@type": "WebPage", "@id": "https://example.com/page",
      "url": "https://example.com/page", "name": "Page title",
      "isPartOf": { "@id": "https://example.com/#website" },
      "breadcrumb": { "@id": "https://example.com/page#breadcrumb" } }
  ]
}
```

## Appendix C — Cache/headers block (Vercel `vercel.json` shape)

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "redirects": [{ "source": "/old-path", "destination": "/new-path", "permanent": true }],
  "rewrites": [{ "source": "/app/:path*", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]},
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]},
    { "source": "/sitemap.xml", "headers": [
      { "key": "Content-Type", "value": "application/xml" },
      { "key": "Cache-Control", "value": "public, max-age=3600, s-maxage=3600" }
    ]}
  ]
}
```

## Appendix D — Agent self-check before reporting "done"

Answer every line with a yes, quoting the evidence (file, URL, or command output):

1. What is the page count, and does `sitemap.xml` list exactly the indexable subset?
2. Which routes are prerendered, and which fall back to SSR/CSR? Why?
3. Show one real page's `<title>`, description, canonical and `<h1>` from the **built** output.
4. Which JSON-LD types exist, on which template, and did they validate?
5. What is the click depth from home to the deepest money page?
6. Which pages are `noindex`, and why is each one correct?
7. What are the mobile Lighthouse numbers (SEO, A11y, BP, Performance) **and** the CWV metrics?
8. What happens on an unknown URL — status code and body?
9. What does `/build-info.json` say right now, and does its commit match `HEAD`?
10. What is still broken, degraded or unverified? (Never answer "nothing".)

> **If you cannot answer 1–10 with evidence, the work is not done.**

