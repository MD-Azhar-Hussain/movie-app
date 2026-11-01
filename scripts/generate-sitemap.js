import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPopularMovieSummaries } from '../src/api/tmdb-ssg.js';
import { GENRES } from '../src/lib/genres.js';


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
 * Reuses the poster URL that is already in the prerendered page's og:image tag
 * so the sitemap can advertise images without another TMDB call.
 */
const readPosterImage = (projectRoot, movieId) => {
  try {
    const htmlPath = path.resolve(projectRoot, 'dist', 'movie', String(movieId), 'index.html');
    if (!fs.existsSync(htmlPath)) return null;

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const match = html.match(/property="og:image" content="(https:\/\/image\.tmdb\.org[^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};


async function collectMovieIds(projectRoot) {
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

  const { ids: movieIds, source } = await collectMovieIds(projectRoot);
  console.log(`[Sitemap] Using ${movieIds.length} movie URLs from ${source}.`);

  if (movieIds.length === 0) {
    console.warn('[Sitemap] No movie URLs could be resolved. Keeping the existing sitemap untouched.');
    return;
  }

  const staticUrls = [
    { loc: `${SITE_URL}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
  ];

  const genreUrls = GENRES.map((genre) => ({
    loc: `${SITE_URL}/genre/${genre.slug}`,
    lastmod: today,
    changefreq: 'weekly',
    priority: '0.7',
  }));

  const movieUrls = movieIds.map((id) => ({
    loc: `${SITE_URL}/movie/${id}`,
    lastmod: today,
    changefreq: 'weekly',
    priority: '0.8',
    image: readPosterImage(projectRoot, id),
  }));

  const allUrls = [...staticUrls, ...genreUrls, ...movieUrls];
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
      <image:loc>${escapeXml(url.image)}</image:loc>
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

  // Keep robots.txt's Sitemap directive pointing at the deployed origin.
  const robotsPath = path.resolve(publicDir, 'robots.txt');
  const robotsContent = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(robotsPath, robotsContent, 'utf-8');

  console.log(`[Sitemap] Successfully indexed ${allUrls.length} total URLs.`);
}

generateSitemap();

