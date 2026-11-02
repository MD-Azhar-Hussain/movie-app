import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPopularMovieSummaries } from '../src/api/tmdb-ssg.js';
import { GENRES } from '../src/lib/genres.js';
import {
  COLLECTIONS,
  GENRES_INDEX_PATH,
  TOP_RATED_PATH,
} from '../src/lib/collections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SITE_URL = (process.env.SITE_URL || 'https://filmpoint.vercel.app').replace(/\/+$/, '');

// Keep in sync with POPULAR_MOVIE_COUNT in vite.config.js
const POPULAR_MOVIE_COUNT = 200;

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * Reads the Open Graph image and title that the prerendered page already
 * advertises, so the sitemap can include image metadata without another TMDB
 * call and without drifting from the page itself.
 */
const readPageSeo = (pathname) => {
  try {
    const htmlPath = path.resolve(projectRoot, 'dist', ...pathname.split('/').filter(Boolean), 'index.html');
    if (!fs.existsSync(htmlPath)) return {};

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const image = html.match(/property="og:image" content="(https:\/\/image\.tmdb\.org[^"]+)"/);
    const title = html.match(/property="og:title" content="([^"]+)"/);

    return {
      image: image ? image[1] : null,
      title: title ? title[1].replace(/\s+-\s+Film Point$/, '') : null,
    };
  } catch {
    return {};
  }
};

async function collectMovieIds() {
  // 1. Preferred: the prerendered pages themselves (no network, always current).
  const distMovieDir = path.resolve(projectRoot, 'dist', 'movie');
  if (fs.existsSync(distMovieDir)) {
    const ids = fs
      .readdirSync(distMovieDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map((entry) => Number(entry.name));

    if (ids.length > 0) return { ids, source: 'dist/movie' };
  }

  // 2. Fallback: ask TMDB (fresh checkout, dist not built yet).
  try {
    const movies = await fetchPopularMovieSummaries(POPULAR_MOVIE_COUNT);
    if (movies.length > 0) return { ids: movies.map((movie) => movie.id), source: 'TMDB' };
  } catch (error) {
    console.warn('[Sitemap] TMDB lookup failed:', error.message);
  }

  // 3. Last resort: keep the URLs already in the published sitemap.
  const existingSitemapPath = path.resolve(projectRoot, 'public', 'sitemap.xml');
  if (fs.existsSync(existingSitemapPath)) {
    const existing = fs.readFileSync(existingSitemapPath, 'utf-8');
    const ids = [...existing.matchAll(/\/movie\/(\d+)</g)].map((match) => Number(match[1]));
    if (ids.length > 0) return { ids: [...new Set(ids)], source: 'existing sitemap' };
  }

  return { ids: [], source: 'none' };
}


async function generateSitemap() {
  console.log('[Sitemap] Starting sitemap.xml generation...');
  const today = new Date().toISOString().split('T')[0];

  const { ids: movieIds, source } = await collectMovieIds();
  console.log(`[Sitemap] Using ${movieIds.length} movie URLs from ${source}.`);

  if (movieIds.length === 0) {
    // Still publish a valid sitemap (home + hubs) instead of returning a 404:
    // the crawler gets the pages that do exist, and the warning is visible in
    // the build log.
    console.warn(
      '[Sitemap] No movie URLs resolved. Writing the home + hub URLs only — check VITE_API_KEY in the build environment.'
    );
  }

  const homeSeo = readPageSeo('/');

  const staticUrls = [
    {
      loc: `${SITE_URL}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: '1.0',
      image: homeSeo.image,
      imageTitle: homeSeo.title,
    },
    {
      loc: `${SITE_URL}${GENRES_INDEX_PATH}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.9',
      image: readPageSeo(GENRES_INDEX_PATH).image,
      imageTitle: 'Browse movies by genre',
    },
  ];

  // Curated lists (top rated, release years, decades): distinct search intent,
  // so they sit just below the home page in priority.
  const collectionUrls = COLLECTIONS.map((collection) => {
    const seo = readPageSeo(collection.path);

    return {
      loc: `${SITE_URL}${collection.path}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: collection.path === TOP_RATED_PATH ? '0.9' : '0.8',
      image: seo.image,
      imageTitle: seo.title || collection.heading,
    };
  });

  const genreUrls = GENRES.map((genre) => {
    const seo = readPageSeo(`/genre/${genre.slug}`);

    return {
      loc: `${SITE_URL}/genre/${genre.slug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.7',
      image: seo.image,
      imageTitle: seo.title,
    };
  });

  const movieUrls = movieIds.map((id) => {
    const seo = readPageSeo(`/movie/${id}`);

    return {
      loc: `${SITE_URL}/movie/${id}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.6',
      image: seo.image,
      imageTitle: seo.title,
    };
  });

  const allUrls = [...staticUrls, ...collectionUrls, ...genreUrls, ...movieUrls];
  const hasImages = allUrls.some((url) => url.image);

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"${hasImages ? '\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>${
      url.image
        ? `
    <image:image>
      <image:loc>${escapeXml(url.image)}</image:loc>${
        url.imageTitle ? `\n      <image:title>${escapeXml(url.imageTitle)}</image:title>` : ''
      }
    </image:image>`
        : ''
    }
  </url>`
  )
  .join('\n')}
</urlset>
`;

  // Write to public/ so the file is versioned with the repo.
  const publicDir = path.resolve(projectRoot, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(path.resolve(publicDir, 'sitemap.xml'), sitemapXml.trim(), 'utf-8');
  console.log(`[Sitemap] Written to ${path.resolve(publicDir, 'sitemap.xml')}`);

  // Copy into dist/ when it exists so the deployed build is always current.
  const distDir = path.resolve(projectRoot, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.resolve(distDir, 'sitemap.xml'), sitemapXml.trim(), 'utf-8');
    console.log(`[Sitemap] Written to ${path.resolve(distDir, 'sitemap.xml')}`);
  }

  // Keep robots.txt's Sitemap directive pointing at the deployed origin, in
  // both the source folder and the build output (public/ is copied into dist/
  // before this script runs, so dist needs its own write).
  //
  // `/api/` is intentionally crawlable: movie and genre pages render their
  // content client-side after hydration, and blocking the proxy made Googlebot
  // see an empty page. The proxy returns metadata only — no user content.
  const robotsContent = [
    '# robots.txt for Film Point',
    '# Content is prerendered; /api/ is a read-only TMDB proxy used after hydration.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `# Page inventory for AI assistants: ${SITE_URL}/llms.txt`,
    '',
  ].join('\n');
  fs.writeFileSync(path.resolve(publicDir, 'robots.txt'), robotsContent, 'utf-8');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.resolve(distDir, 'robots.txt'), robotsContent, 'utf-8');
  }

  console.log(`[Sitemap] Successfully indexed ${allUrls.length} total URLs.`);
}

generateSitemap();

