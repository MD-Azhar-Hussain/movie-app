import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPopularMovieIds } from '../src/api/tmdb-ssg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SITE_URL = process.env.SITE_URL || 'https://filmpoint.vercel.app';

async function generateSitemap() {
  console.log('[Sitemap] Starting sitemap.xml generation...');
  const today = new Date().toISOString().split('T')[0];

  let movieIds = [];
  try {
    movieIds = await fetchPopularMovieIds(100);
  } catch (err) {
    console.error('[Sitemap] Error fetching movie IDs:', err.message);
  }

  const staticUrls = [
    {
      loc: `${SITE_URL}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: '1.0',
    },
  ];

  const movieUrls = movieIds.map((id) => ({
    loc: `${SITE_URL}/movie/${id}`,
    lastmod: today,
    changefreq: 'weekly',
    priority: '0.8',
  }));

  const allUrls = [...staticUrls, ...movieUrls];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  // Write to public/
  const publicDir = path.resolve(projectRoot, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicPath = path.resolve(publicDir, 'sitemap.xml');
  fs.writeFileSync(publicPath, sitemapXml.trim(), 'utf-8');
  console.log(`[Sitemap] Written to ${publicPath}`);

  // Also write directly to dist/ if dist exists (for immediate post-build deploy)
  const distDir = path.resolve(projectRoot, 'dist');
  if (fs.existsSync(distDir)) {
    const distPath = path.resolve(distDir, 'sitemap.xml');
    fs.writeFileSync(distPath, sitemapXml.trim(), 'utf-8');
    console.log(`[Sitemap] Written to ${distPath}`);
  }

  console.log(`[Sitemap] Successfully indexed ${allUrls.length} total URLs.`);
}

generateSitemap();
