/**
 * Server-only TMDB helpers.
 *
 * This module is only imported behind `import.meta.env.SSR`, so the bearer
 * token never enters the browser bundle.
 */
import { getTmdbApiKey } from './tmdb-ssg';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const buildHeaders = (apiKey) => ({
  accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
  'User-Agent': 'Mozilla/5.0 (compatible; FilmPointBot/1.0; +https://filmpoint.vercel.app)',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a TMDB endpoint server-side with basic retry handling for 429s.
 * Returns parsed JSON or null so loaders can render an error state.
 */
export const fetchTmdbServer = async (path, { attempts = 3, retryDelayMs = 400 } = {}) => {
  const apiKey = getTmdbApiKey();
  if (!apiKey) return null;

  const url = `${TMDB_BASE}${path}`;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: buildHeaders(apiKey) });

      if (response.status === 429) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      if (!response.ok) return null;

      const contentType = response.headers?.get('content-type') || '';
      if (!contentType.includes('application/json')) return null;

      return await response.json();
    } catch {
      if (attempt === attempts - 1) return null;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  return null;
};

export const fetchMovieDetails = (id) =>
  fetchTmdbServer(`/movie/${id}?append_to_response=credits,videos,recommendations`);
