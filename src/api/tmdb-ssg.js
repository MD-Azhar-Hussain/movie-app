import fs from 'node:fs';
import path from 'node:path';

/**
 * Build-time only helpers (SSG routes, sitemap and the popular-movies nav).
 * This module is imported by `vite.config.js` and `scripts/*` — never by the
 * browser bundle, because it reads the API key from the server environment.
 */

// Helper to resolve VITE_API_KEY from environment or .env file
export const getTmdbApiKey = () => {
  if (typeof process !== 'undefined') {
    if (process.env.VITE_API_KEY) {
      return process.env.VITE_API_KEY.trim();
    }
    // Check .env if process.env doesn't have it
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/VITE_API_KEY=(.+)/);
        if (match && match[1]) {
          return match[1].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return '';
};

const TMDB_HEADERS = (apiKey) => ({
  accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
  'User-Agent': 'Mozilla/5.0 (compatible; FilmPointBot/1.0; +https://filmpoint.vercel.app)',
});

/**
 * Base URL for TMDB. Override with `TMDB_BASE_URL` to point the build at
 * `scripts/mock-tmdb-server.mjs` for offline development and pipeline tests.
 */
const TMDB_BASE = (process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3').replace(/\/+$/, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cached summaries so routes, sitemap and nav share a single TMDB pass. */
const popularCache = { count: 0, movies: [] };

const toSummary = (movie) => ({
  id: movie.id,
  title: movie.title || movie.original_title || 'Untitled movie',
  year: movie.release_date ? movie.release_date.slice(0, 4) : '',
});

/**
 * Fetches the most popular movies from TMDB at build time.
 * @param {number} count Total number of movies to collect (default: 100)
 * @returns {Promise<Array<{ id: number, title: string, year: string }>>}
 */
export const fetchPopularMovieSummaries = async (count = 100) => {
  if (popularCache.count >= count && popularCache.movies.length >= count) {
    return popularCache.movies.slice(0, count);
  }

  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    console.warn('[SSG] VITE_API_KEY not found. Skipping dynamic route generation.');
    return popularCache.movies.slice(0, count);
  }

  const movies = new Map(popularCache.movies.map((movie) => [movie.id, movie]));
  const pagesToFetch = Math.ceil(count / 20);

  for (let page = 1; page <= pagesToFetch; page += 1) {
    let succeeded = false;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        let response;
        try {
          response = await fetch(
            `${TMDB_BASE}/movie/popular?language=en-US&page=${page}`,
            { headers: TMDB_HEADERS(apiKey), signal: AbortSignal.timeout(15000) }
          );
        } catch (fetchError) {
          if (attempt === 5) {
            console.warn(`[SSG] Error fetching popular movies page ${page}:`, fetchError.message);
          } else {
            await sleep(500 * (attempt + 1));
          }
          continue;
        }

        if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
          // TMDB throttles with 429 and, under load, with a 401 that claims the
          // key is invalid. Backing off and retrying recovers most of these;
          // giving up on the first one is what silently truncated the popular
          // list (and therefore the movie pages and the sitemap).
          const retryAfter = Number(response.headers.get('retry-after')) || 0;
          await sleep(Math.max(retryAfter * 1000, 700 * (attempt + 1)) + Math.round(Math.random() * 250));
          continue;
        }

        if (!response.ok) {
          console.warn(`[SSG] Failed to fetch TMDB popular page ${page} (HTTP ${response.status})`);
          break;
        }

        const data = await response.json();
        if (Array.isArray(data.results)) {
          for (const movie of data.results) {
            if (movie && movie.id) movies.set(movie.id, toSummary(movie));
            if (movies.size >= count) break;
          }
        }

        succeeded = true;
        break;
      } catch (error) {
        if (attempt === 5) {
          console.warn(`[SSG] Error fetching popular movies page ${page}:`, error.message);
        } else {
          await sleep(400 * (attempt + 1));
        }
      }
    }

    if (!succeeded) {
      // One flaky page must not discard the pages we already collected.
      console.warn(`[SSG] Skipping TMDB popular page ${page} after repeated failures.`);
      continue;
    }
    if (movies.size >= count) break;
  }

  const collected = Array.from(movies.values()).slice(0, count);
  popularCache.count = collected.length;
  popularCache.movies = collected;

  console.log(`[SSG] Collected ${collected.length} popular movies from TMDB.`);
  return collected;
};

/**
 * @param {number} count Total number of movie IDs to fetch
 * @returns {Promise<number[]>}
 */
export const fetchPopularMovieIds = async (count = 100) => {
  const summaries = await fetchPopularMovieSummaries(count);
  return summaries.map((movie) => movie.id);
};

/**
 * @param {number} count Number of movie routes to generate
 * @returns {Promise<string[]>} Route strings like ['/movie/123', ...]
 */
export const fetchPopularMovieRoutes = async (count = 100) => {
  const ids = await fetchPopularMovieIds(count);
  return ids.map((id) => `/movie/${id}`);
};
