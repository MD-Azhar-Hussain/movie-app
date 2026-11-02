/**
 * Post-build SEO audit.
 *
 * Every SEO change is only worth the HTML that ships, so this script re-reads
 * `dist/` and checks the rules that actually affect indexing:
 *
 *   - one <title>, one <meta description>, one <h1> per page
 *   - an absolute <link rel="canonical"> that matches the page URL
 *   - og:image / twitter:card / robots directives
 *   - <html lang>, charset inside the first 1024 bytes
 *   - every <img> has an alt attribute
 *   - every JSON-LD block is valid JSON
 *   - sitemap.xml lists exactly the pages that exist, with no duplicates
 *   - build-info.json, llms.txt and robots.txt exist and agree with the output
 *
 * Run standalone with `npm run seo:audit`. It is wired into `npm run build` in
 * non-fatal mode: a regression is printed loudly but does not block a deploy
 * (the point of the audit is to surface problems, not to freeze production).
 * Set SEO_AUDIT_STRICT=1 to make errors exit non-zero.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://filmpoint.vercel.app').replace(/\/+$/, '');
const STRICT = process.env.SEO_AUDIT_STRICT === '1';

const errors = [];
const warnings = [];

const addError = (page, message) => errors.push(`${page}: ${message}`);
const addWarning = (page, message) => warnings.push(`${page}: ${message}`);

const walk = (directory) => {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
};

/** Maps dist/.../index.html back to the URL a crawler would request. */
const pageUrlFor = (filePath) => {
  const relative = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (relative === 'index.html') return '/';
  if (relative === '404.html') return '/404.html';
  return `/${relative.replace(/\/?index\.html$/, '')}`;
};

const decodeEntities = (value) =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

const metaContent = (html, attribute, key) => {
  const patterns = [
    new RegExp(`<meta[^>]*${attribute}="${key}"[^>]*content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attribute}="${key}"`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]);
  }
  return null;
};

const canonicalIndex = new Map();

const auditPage = (filePath) => {
  const url = pageUrlFor(filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const isNotFoundPage = url === '/404.html';

  // Search-console verification files are not real pages.
  if (/^\/google[a-z0-9]+\.html$/i.test(url)) return { url, title: 'verification', description: '' };

  const titles = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((match) =>
    decodeEntities(match[1].trim())
  );
  if (titles.length === 0) addError(url, 'missing <title>');
  if (titles.length > 1) addError(url, `has ${titles.length} <title> tags`);
  const title = titles[0] || '';
  if (title.length > 0 && title.length < 10) addWarning(url, `title is very short (${title.length} chars)`);
  if (title.length > 65) addWarning(url, `title is ${title.length} chars (Google truncates around 60)`);

  const description = metaContent(html, 'name', 'description');
  if (!description) addError(url, 'missing meta description');
  if (description && description.length < 50) addWarning(url, `meta description is ${description.length} chars`);
  if (description && description.length > 175) addWarning(url, `meta description is ${description.length} chars`);

  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i);
  if (!canonical) {
    // A 404 must not carry a canonical: it would point the missing URL at a
    // real page and turn a hard 404 into a soft one.
    if (!isNotFoundPage) addError(url, 'missing canonical');
  } else {
    const href = decodeEntities(canonical[1]);
    if (!href.startsWith('http')) addError(url, `canonical is not absolute (${href})`);
    const expected = `${SITE_URL}${url === '/' ? '/' : url}`;
    if (href !== expected) addWarning(url, `canonical ${href} does not match page ${expected}`);
    if (!canonicalIndex.has(href)) canonicalIndex.set(href, []);
    canonicalIndex.get(href).push(url);
  }

  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count === 0) addError(url, 'missing <h1>');
  if (h1Count > 1) addError(url, `has ${h1Count} <h1> tags`);

  if (!/<html[^>]*\blang="/i.test(html)) addError(url, '<html> has no lang attribute');

  const charsetIndex = html.search(/<meta[^>]+charset/i);
  if (charsetIndex === -1) addError(url, 'missing <meta charset>');
  else if (charsetIndex > 1024) {
    addError(url, `<meta charset> appears at byte ${charsetIndex} (must be in the first 1024)`);
  }

  const robots = metaContent(html, 'name', 'robots');
  if (!robots) addError(url, 'missing robots meta');
  if (!isNotFoundPage && robots && robots.includes('noindex')) {
    addWarning(url, `indexable page is marked noindex ("${robots}") — it probably failed to prerender`);
  }

  if (!metaContent(html, 'property', 'og:image')) addError(url, 'missing og:image');
  if (metaContent(html, 'property', 'og:title') === null) addWarning(url, 'missing og:title');
  if (!/name="twitter:card"/i.test(html)) addWarning(url, 'missing twitter:card');

  const imagesWithoutAlt = [...html.matchAll(/<img\b[^>]*>/gi)].filter((match) => !/\balt=/.test(match[0]));
  if (imagesWithoutAlt.length > 0) {
    addError(url, `${imagesWithoutAlt.length} <img> without an alt attribute`);
  }

  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      addError(url, `invalid JSON-LD (${error.message})`);
    }
  }

  return { url, title, description };
};

const auditSitemap = (pages) => {
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    addError('sitemap.xml', 'file is missing');
    return;
  }

  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeEntities(match[1]));

  if (locs.length === 0) addError('sitemap.xml', 'has no <loc> entries');

  const duplicates = locs.filter((loc, index) => locs.indexOf(loc) !== index);
  if (duplicates.length > 0) {
    addError('sitemap.xml', `has ${duplicates.length} duplicate URL(s): ${duplicates.slice(0, 3).join(', ')}`);
  }

  const pageUrls = new Set(
    pages
      .map((page) => page.url)
      .filter((url) => url !== '/404.html' && !/^\/google[a-z0-9]+\.html$/i.test(url))
  );
  const missingFromSitemap = [...pageUrls].filter(
    (url) => !locs.includes(`${SITE_URL}${url === '/' ? '/' : url}`)
  );
  if (missingFromSitemap.length > 0) {
    addWarning(
      'sitemap.xml',
      `${missingFromSitemap.length} prerendered page(s) are not listed (e.g. ${missingFromSitemap
        .slice(0, 3)
        .join(', ')})`
    );
  }

  if (!/xmlns:image=/.test(xml)) addWarning('sitemap.xml', 'no image entries — posters will not be indexed');
};

const auditStaticFiles = () => {
  const buildInfoPath = path.join(distDir, 'build-info.json');
  if (!fs.existsSync(buildInfoPath)) {
    addError('build-info.json', 'file is missing — the deployment cannot self-diagnose');
  } else {
    try {
      const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      if (!info.commit) addWarning('build-info.json', 'has no commit sha');
      for (const problem of info.problems || []) addWarning('build-info.json', problem);
    } catch (error) {
      addError('build-info.json', `is not valid JSON (${error.message})`);
    }
  }

  const llmsPath = path.join(distDir, 'llms.txt');
  if (!fs.existsSync(llmsPath)) addError('llms.txt', 'file is missing');
  else if (fs.readFileSync(llmsPath, 'utf8').length < 500) addWarning('llms.txt', 'looks truncated');

  const robotsPath = path.join(distDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    addError('robots.txt', 'file is missing');
  } else {
    const robots = fs.readFileSync(robotsPath, 'utf8');
    if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
      addError('robots.txt', `Sitemap directive does not point at ${SITE_URL}/sitemap.xml`);
    }
    if (/^Disallow:\s*\/\s*$/m.test(robots)) addError('robots.txt', 'blocks the entire site');
  }

  if (!fs.existsSync(path.join(distDir, 'og-default.png'))) {
    addError('og-default.png', 'social preview image is missing');
  }
};

const main = () => {
  if (!fs.existsSync(distDir)) {
    console.error('[seo] dist/ does not exist — run `npm run build` first.');
    process.exit(STRICT ? 1 : 0);
  }

  const pages = walk(distDir).map(auditPage);

  auditSitemap(pages);
  auditStaticFiles();

  for (const [canonical, urls] of canonicalIndex) {
    if (urls.length > 1) {
      addError('canonical', `${canonical} is claimed by ${urls.length} pages: ${urls.join(', ')}`);
    }
  }

  const indexable = pages.filter((page) => page.url !== '/404.html').length;
  console.log(
    `[seo] Audited ${pages.length} HTML pages (${indexable} indexable): ` +
      `${errors.length} error(s), ${warnings.length} warning(s).`
  );
  for (const error of errors.slice(0, 40)) console.error(`[seo] x ${error}`);
  if (errors.length > 40) console.error(`[seo] ... ${errors.length - 40} more error(s)`);
  for (const warning of warnings.slice(0, 25)) console.warn(`[seo] ! ${warning}`);
  if (warnings.length > 25) console.warn(`[seo] ... ${warnings.length - 25} more warning(s)`);

  if (errors.length > 0 && STRICT) {
    console.error('[seo] SEO_AUDIT_STRICT=1 — failing because of the errors above.');
    process.exit(1);
  }

  if (errors.length === 0) console.log('[seo] No blocking issues found.');
};

main();
