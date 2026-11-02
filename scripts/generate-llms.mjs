/**
 * Generates `llms.txt` — the plain-text page inventory that AI assistants and
 * agent crawlers look for — from the real build output.
 *
 * The previous file was hand-written and had already drifted (it promised "~200
 * popular movie pages" and listed three genre hubs). Generating it means the
 * counts, URLs and descriptions always match what was actually deployed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENRES } from '../src/lib/genres.js';
import { COLLECTIONS, buildDecadePath, buildYearPath, DECADES, COLLECTION_YEARS } from '../src/lib/collections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');

const SITE_URL = (process.env.SITE_URL || 'https://filmpoint.vercel.app').replace(/\/+$/, '');
const CONTACT_URL = 'https://github.com/the-user99999';
const SAMPLE_MOVIE_COUNT = 30;

/** Reads `og:title` from a prerendered page so the movie list has real titles. */
const readPageTitle = (pathname) => {
  try {
    const htmlPath = path.resolve(distDir, ...pathname.split('/').filter(Boolean), 'index.html');
    if (!fs.existsSync(htmlPath)) return null;

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const match = html.match(/property="og:title" content="([^"]+)"/);
    return match ? match[1].replace(/\s+-\s+Film Point$/, '') : null;
  } catch {
    return null;
  }
};

const readMovieIds = () => {
  const movieDir = path.resolve(distDir, 'movie');
  if (!fs.existsSync(movieDir)) return [];

  return fs
    .readdirSync(movieDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name));
};

const generateLlmsTxt = () => {
  const movieIds = readMovieIds();
  const sampleIds = movieIds.slice(0, SAMPLE_MOVIE_COUNT);

  const lines = [
    '# Film Point',
    '',
    '> Movie discovery, ratings and watchlists. Metadata and posters from TMDB.',
    '',
    'Film Point is a movie discovery site: search films, browse curated genre hubs, read a full',
    'page per film (synopsis, cast, runtime, ratings, FAQ) and keep a local watchlist. Every page',
    'listed below is prerendered to static HTML and readable without JavaScript.',
    '',
    `Canonical origin: ${SITE_URL}`,
    '',
    '## Key pages',
    '',
    `- [Home / discovery](${SITE_URL}/): search, trending searches, watchlist and popular titles`,
    `- [Genre index](${SITE_URL}/genres): ${GENRES.length} genre hubs in one place`,
    `- [Top rated movies](${SITE_URL}/top-rated): highest TMDB user scores of all time`,
    `- [Release year lists](${SITE_URL}${buildYearPath(COLLECTION_YEARS[0])}): "best movies of <year>" pages`,
    `- [Decade lists](${SITE_URL}${buildDecadePath(DECADES[0].slug)}): "best movies of the <decade>" pages`,
    `- [Sitemap](${SITE_URL}/sitemap.xml) · [robots.txt](${SITE_URL}/robots.txt)`,
    '',
    '## Genre hubs',
    '',
    ...GENRES.map(
      (genre) => `- [Best ${genre.name} movies](${SITE_URL}/genre/${genre.slug}): ${genre.blurb}`
    ),
    '',
    '## Release year pages',
    '',
    ...COLLECTION_YEARS.map(
      (year) => `- [Best movies of ${year}](${SITE_URL}${buildYearPath(year)}): most popular ${year} releases`
    ),
    '',
    '## Decade pages',
    '',
    ...DECADES.map(
      (decade) =>
        `- [Best movies of the ${decade.label}](${SITE_URL}${buildDecadePath(decade.slug)}): ${decade.blurb}`
    ),
    '',
    '## Sample movie pages',
    '',
    ...sampleIds.map((id) => {
      const title = readPageTitle(`/movie/${id}`);
      return `- [${title || `Movie ${id}`}](${SITE_URL}/movie/${id})`;
    }),
    '',
    '## Notes for automated agents',
    '',
    '- Content is server-rendered HTML; titles, ratings, cast, genres and FAQs do not require JavaScript.',
    '- Structured data is JSON-LD: `Movie`, `FAQPage`, `BreadcrumbList`, `CollectionPage`/`ItemList`, `WebSite` and `Organization`.',
    '- Movie metadata comes from TMDB. Film Point does not host or stream video; "Watch"/"Download" links lead to third-party sites.',
    `- Page inventory at build time: 1 home + 1 genre index + ${COLLECTIONS.length} curated lists + ${GENRES.length} genre hubs + ${movieIds.length} movie pages.`,
    '- Crawling is welcome. `/api/` is a read-only TMDB proxy with no user content; robots.txt allows every path.',
    '- Machine-readable build diagnostics: /build-info.json (commit, page counts, build problems).',
    '',
    '## Contact',
    '',
    CONTACT_URL,
    '',
  ];

  const content = `${lines.join('\n')}`;

  const publicPath = path.resolve(projectRoot, 'public', 'llms.txt');
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(publicPath, content, 'utf-8');
  console.log(`[llms] Written to ${publicPath} (${movieIds.length} movie pages, ${GENRES.length} genres)`);

  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.resolve(distDir, 'llms.txt'), content, 'utf-8');
    console.log(`[llms] Written to ${path.resolve(distDir, 'llms.txt')}`);
  }
};

generateLlmsTxt();
