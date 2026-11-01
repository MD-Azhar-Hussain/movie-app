/**
 * Post-build HTML fixes for the prerendered pages.
 *
 * `vite-react-ssg` injects the Helmet output at the very start of `<head>`,
 * which pushes `<meta charset>` past the first 1024 bytes. Chrome then has to
 * re-parse the document (Lighthouse's `charset` audit fails) and the late
 * charset can cause a re-layout. Moving a single charset declaration to the
 * first position inside `<head>` fixes both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getTmdbApiKey } from '../src/api/tmdb-ssg.js';

const distDir = path.resolve(process.cwd(), 'dist');

/**
 * Writes `dist/build-info.json` so a deployment can report what it actually
 * contains. This is the fastest way to answer "why is the popular-movies
 * dropdown / genre list missing on the deployed site?" — open
 * https://<site>/build-info.json and look at tmdbKeyPresent and the counts.
 */
const writeBuildInfo = () => {
  const readIfExists = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
  const count = (text, pattern) => (text.match(pattern) || []).length;

  const homeHtml = readIfExists(path.join(distDir, 'index.html'));
  const movieDir = path.join(distDir, 'movie');
  const genreDir = path.join(distDir, 'genre');

  const moviePages = fs.existsSync(movieDir)
    ? fs.readdirSync(movieDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
    : 0;

  const genreFiles = fs.existsSync(genreDir)
    ? fs.readdirSync(genreDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

  const genrePagesWithMovies = genreFiles.filter((entry) =>
    readIfExists(path.join(genreDir, entry.name, 'index.html')).includes('genre-movie-grid')
  ).length;

  const sitemapUrls = count(readIfExists(path.join(distDir, 'sitemap.xml')), /<loc>/g);
  const tmdbKeyPresent = Boolean(getTmdbApiKey());
  const popularMovieLinksOnHome = count(homeHtml, /href="\/movie\/\d+"/g);

  const problems = [];
  if (!tmdbKeyPresent) problems.push('VITE_API_KEY was missing at build time — TMDB data is not prerendered.');
  if (moviePages < 50) problems.push(`Only ${moviePages} movie pages were prerendered (expected ~200).`);
  if (genrePagesWithMovies !== 19) problems.push(`Only ${genrePagesWithMovies}/19 genre hubs contain movies.`);
  if (popularMovieLinksOnHome < 20) problems.push(`Home page has ${popularMovieLinksOnHome} movie links (expected 120).`);
  if (sitemapUrls < 20) problems.push(`sitemap.xml has ${sitemapUrls} URLs (expected 200+).`);

  const info = {
    builtAt: new Date().toISOString(),
    node: process.version,
    tmdbKeyPresent,
    moviePages,
    genrePages: genreFiles.length,
    genrePagesWithMovies,
    popularMovieLinksOnHome,
    genreLinksOnHome: count(homeHtml, /href="\/genre\/[a-z-]+"/g),
    sitemapUrls,
    problems,
  };

  fs.writeFileSync(path.join(distDir, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`, 'utf8');

  console.log(
    `[build-info] key=${tmdbKeyPresent} moviePages=${moviePages} genresWithMovies=${genrePagesWithMovies}/19 popularLinks=${popularMovieLinksOnHome} sitemapUrls=${sitemapUrls}`
  );
  for (const problem of problems) console.warn(`[build-info] ⚠ ${problem}`);
};

const walk = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
};

const charsetTag = '<meta charset="utf-8">';
let changed = 0;
let processed = 0;

for (const filePath of walk(distDir)) {
  processed += 1;
  const original = fs.readFileSync(filePath, 'utf8');

  let html = original
    // Drop every existing charset declaration (any casing/quoting).
    .replace(/<meta[^>]+charset[^>]*>/gi, '')
    // Re-insert exactly one, as the first child of <head>.
    .replace(/<head([^>]*)>/i, (match, attributes) => `<head${attributes}>${charsetTag}`);

  // Collapse the whitespace the removal may have left behind.
  html = html.replace(/(<head[^>]*>\s*)\s+/i, '$1');

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    changed += 1;
  }
}

console.log(`[html] charset normalised in ${changed}/${processed} prerendered pages`);

writeBuildInfo();
