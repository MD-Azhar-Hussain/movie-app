/**
 * Server-only TMDB helpers.
 *
 * This module is only imported behind `import.meta.env.SSR`, so the bearer
 * token never enters the browser bundle.
 */
import { getTmdbApiKey } from './tmdb-ssg';

/**
 * Base URL for TMDB. Override with `TMDB_BASE_URL` to point the build at
 * `scripts/mock-tmdb-server.mjs` for offline development and pipeline tests.
 */
const TMDB_BASE = (process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3').replace(/\/+$/, '');

/**
 * Build-time request budget.
 *
 * ViteReactSSG renders up to `ssgOptions.concurrency` routes at once, and every
 * loader fires its own TMDB request. On a flaky CI network that surfaced as
 * `ECONNRESET` bursts — three genre hubs prerendered empty on a build that
 * otherwise looked fine. Limiting how many requests are in flight at once, and
 * retrying with backoff, makes the prerender deterministic.
 */
const MAX_CONCURRENT_REQUESTS = 4;

let activeRequests = 0;
const requestQueue = [];

const acquireSlot = () =>
  new Promise((resolve) => {
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      activeRequests += 1;
      resolve();
      return;
    }
    requestQueue.push(resolve);
  });

const releaseSlot = () => {
  const next = requestQueue.shift();
  if (next) {
    next();
    return;
  }
  activeRequests -= 1;
};

/** Responses keyed by URL so a route rendered twice only costs one request. */
const responseCache = new Map();

const buildHeaders = (apiKey) => ({
  accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
  'User-Agent': 'Mozilla/5.0 (compatible; FilmPointBot/1.0; +https://filmpoint.vercel.app)',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readRetryAfter = (response) => {
  const header = response?.headers?.get?.('retry-after');
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 5000) : 0;
};

const fetchOnce = async (url, apiKey) => {
  const response = await fetch(url, {
    headers: buildHeaders(apiKey),
    signal: AbortSignal.timeout(20000),
  });

  // TMDB reports throttling as either 429 or, under load, as
  // `401 {"status_code":7,"status_message":"Invalid API key"}` — the same token
  // succeeds seconds later. Treating that 401 as permanent is what left genre
  // hubs and list pages empty in a build that otherwise looked healthy, so 401
  // and 403 are retried with backoff like a rate limit.
  if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
    const error = new Error(`TMDB responded ${response.status}`);
    error.retryAfterMs = readRetryAfter(response) || 0;
    throw error;
  }

  if (!response.ok) {
    // A genuine 404 (unknown movie id) is not worth retrying.
    const error = new Error(`TMDB responded ${response.status}`);
    error.permanent = true;
    throw error;
  }

  const contentType = response.headers?.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const error = new Error(`TMDB returned "${contentType || 'no content type'}"`);
    error.permanent = true;
    throw error;
  }

  return response.json();
};

/**
 * Fetch a TMDB endpoint server-side.
 *
 * Retries network resets (the common failure on restricted networks) plus
 * throttling, and never throws: a loader that gets `null` renders an error
 * state instead of failing the whole prerender.
 *
 * @param {string} path TMDB path, e.g. "/discover/movie?..."
 * @param {{attempts?: number, retryDelayMs?: number, cache?: boolean}} [options]
 */
export const fetchTmdbServer = async (path, { attempts = 5, retryDelayMs = 800, cache = true } = {}) => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) return null;

  const url = `${TMDB_BASE}${path}`;
  if (cache && responseCache.has(url)) return responseCache.get(url);

  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await acquireSlot();

    try {
      const data = await fetchOnce(url, apiKey);
      releaseSlot();
      if (cache) responseCache.set(url, data);
      return data;
    } catch (error) {
      releaseSlot();
      lastError = error;

      if (error.permanent) {
        console.warn(`[tmdb] ${error.message} for ${path}`);
        return null;
      }

      if (attempt === attempts - 1) break;
      // Jitter keeps several loaders from retrying in lockstep after a throttle.
      const jitter = Math.round(Math.random() * 250);
      await sleep((error.retryAfterMs || retryDelayMs * (attempt + 1)) + jitter);
    }
  }

  console.warn(
    `[tmdb] Gave up on ${path} after ${attempts} attempts:`,
    lastError?.message || 'unknown error'
  );
  return null;
};

export const fetchMovieDetails = (id) =>
  fetchTmdbServer(`/movie/${id}?append_to_response=credits,videos,recommendations`);

/** Clears the per-process cache (used by the build scripts between phases). */
export const clearTmdbServerCache = () => responseCache.clear();

