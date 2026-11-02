/**
 * Build diagnostics (`dist/build-info.json`).
 *
 * The deployed site is the only place some problems show up, and "why is the
 * movie dropdown empty / why does /build-info.json 404?" was impossible to
 * answer from a browser. This module writes a small JSON file into the build
 * output that records **what the deployment actually contains**:
 *
 *   { "commit": "2e6af0f", "tmdbKeyPresent": true, "moviePages": 148, ... }
 *
 * It is used by `scripts/postprocess-html.mjs`, served live by the Vite
 * dev/preview middleware and mirrored by `api/build-info.js`, so the file is
 * never a mystery 404 again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { getTmdbApiKey } from '../src/api/tmdb-ssg.js';
import { GENRES } from '../src/lib/genres.js';
import { COLLECTIONS } from '../src/lib/collections.js';

export const BUILD_INFO_FILENAME = 'build-info.json';

const readIfExists = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const countDirectories = (directory) => {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
};

/** Reads a git value without ever throwing (Vercel checkouts are shallow, CI may not have git). */
const gitValue = (args) => {
  try {
    const result = spawnSync('git', args, { encoding: 'utf8', timeout: 5000 });
    if (result.status !== 0 || !result.stdout) return null;
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
};

const getGitMetadata = () => {
  const commit =
    (process.env.VERCEL_GIT_COMMIT_SHA || gitValue(['rev-parse', 'HEAD']) || '').slice(0, 7) || null;
  const branch = process.env.VERCEL_GIT_COMMIT_REF || gitValue(['rev-parse', '--abbrev-ref', 'HEAD']);

  return {
    commit,
    branch,
    commitSubject: gitValue(['log', '-1', '--pretty=%s']),
    committedAt: gitValue(['log', '-1', '--pretty=%cI']),
  };
};

/**
 * Collects everything worth knowing about a build output directory.
 *
 * @param {{distDir?: string, siteUrl?: string}} [options]
 */
export const collectBuildInfo = ({ distDir = path.resolve(process.cwd(), 'dist'), siteUrl } = {}) => {
  const homeHtml = readIfExists(path.join(distDir, 'index.html'));
  const movieDir = path.join(distDir, 'movie');
  const genreDir = path.join(distDir, 'genre');

  const moviePages = countDirectories(movieDir);

  const genrePages = countDirectories(genreDir);
  const genrePagesWithMovies = fs.existsSync(genreDir)
    ? fs
        .readdirSync(genreDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            readIfExists(path.join(genreDir, entry.name, 'index.html')).includes('genre-movie-grid')
        ).length
    : 0;

  const collectionStatus = COLLECTIONS.map((collection) => {
    const html = readIfExists(
      path.join(distDir, ...collection.path.split('/').filter(Boolean), 'index.html')
    );
    return {
      path: collection.path,
      prerendered: html.length > 0,
      hasMovies: html.includes('genre-movie-grid'),
    };
  });

  const collectionPages = collectionStatus.filter((entry) => entry.prerendered).length;
  const collectionPagesWithMovies = collectionStatus.filter((entry) => entry.hasMovies).length;

  const sitemapUrls = countMatches(readIfExists(path.join(distDir, 'sitemap.xml')), /<loc>/g);
  const llmsTxt = readIfExists(path.join(distDir, 'llms.txt'));
  const tmdbKeyPresent = Boolean(getTmdbApiKey());
  const popularMovieLinksOnHome = countMatches(homeHtml, /href="\/movie\/\d+"/g);
  const genreLinksOnHome = countMatches(homeHtml, /href="\/genre\/[a-z-]+"/g);
  const collectionLinksOnHome = countMatches(
    homeHtml,
    /href="\/(top-rated|year\/\d{4}|decade\/[a-z0-9-]+)"/g
  );
  const hasOgImage = fs.existsSync(path.join(distDir, 'og-default.png'));

  // home + /genres + every genre hub + every collection page + every movie page
  const expectedSitemapUrls = 2 + GENRES.length + COLLECTIONS.length + moviePages;

  const problems = [];
  if (!tmdbKeyPresent) {
    problems.push('VITE_API_KEY was missing at build time — TMDB data is not prerendered.');
  }
  if (moviePages < 50) problems.push(`Only ${moviePages} movie pages were prerendered (expected ~200).`);
  if (genrePagesWithMovies !== GENRES.length) {
    problems.push(`Only ${genrePagesWithMovies}/${GENRES.length} genre hubs contain movies.`);
  }
  const emptyCollections = collectionStatus.filter((entry) => entry.prerendered && !entry.hasMovies);
  if (emptyCollections.length > 0) {
    problems.push(
      `${emptyCollections.length}/${COLLECTIONS.length} collection pages are empty: ` +
        emptyCollections.map((entry) => entry.path).join(', ')
    );
  }
  if (collectionPages !== COLLECTIONS.length) {
    problems.push(`Only ${collectionPages}/${COLLECTIONS.length} collection pages were prerendered.`);
  }
  if (popularMovieLinksOnHome < 20) {
    problems.push(`Home page has ${popularMovieLinksOnHome} movie links (expected 120).`);
  }
  if (sitemapUrls < 20 || sitemapUrls < expectedSitemapUrls - 5) {
    problems.push(`sitemap.xml has ${sitemapUrls} URLs (expected ${expectedSitemapUrls}).`);
  }
  if (!llmsTxt) problems.push('llms.txt was not generated.');
  if (!hasOgImage) problems.push('og-default.png (1200x630 social image) is missing.');

  return {
    builtAt: new Date().toISOString(),
    node: process.version,
    ...getGitMetadata(),
    ...(siteUrl ? { siteUrl } : {}),
    tmdbKeyPresent,
    moviePages,
    genrePages,
    genrePagesWithMovies,
    collectionPages,
    collectionPagesWithMovies,
    popularMovieLinksOnHome,
    genreLinksOnHome,
    collectionLinksOnHome,
    sitemapUrls,
    llmsTxtLength: llmsTxt.length,
    hasOgImage,
    emptyCollections: emptyCollections.map((entry) => entry.path),
    problems,
  };
};

/**
 * Writes `<distDir>/build-info.json` and returns the payload.
 *
 * @param {{distDir?: string, siteUrl?: string}} [options]
 */
export const writeBuildInfo = ({ distDir = path.resolve(process.cwd(), 'dist'), siteUrl } = {}) => {
  const info = collectBuildInfo({ distDir, siteUrl });

  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, BUILD_INFO_FILENAME), `${JSON.stringify(info, null, 2)}\n`, 'utf8');

  console.log(
    `[build-info] commit=${info.commit || 'unknown'} key=${info.tmdbKeyPresent} moviePages=${info.moviePages} ` +
      `genres=${info.genrePagesWithMovies}/${GENRES.length} ` +
      `collections=${info.collectionPagesWithMovies}/${COLLECTIONS.length} ` +
      `popularLinks=${info.popularMovieLinksOnHome} sitemapUrls=${info.sitemapUrls}`
  );
  for (const problem of info.problems) console.warn(`[build-info] ⚠ ${problem}`);

  return info;
};

export default writeBuildInfo;

// `node scripts/build-info.mjs` regenerates dist/build-info.json on demand.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeBuildInfo({ siteUrl: process.env.SITE_URL });
}
