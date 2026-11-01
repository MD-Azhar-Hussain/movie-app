/**
 * TMDB client helper.
 *
 * The browser always talks to the same-origin `/api/tmdb` proxy, so the TMDB
 * bearer token is never shipped to the client. In production that route is the
 * Vercel serverless function in `api/tmdb.js`; during local development it is
 * served by the middleware registered in `vite.config.js`, and during SSG the
 * loader uses `src/api/tmdbServer.js` instead.
 */

/**
 * Fetch from TMDB through the serverless proxy.
 *
 * @param {string} tmdbUrl  Full TMDB URL, e.g. "https://api.themoviedb.org/3/movie/popular?page=1"
 * @param {RequestInit} [options]  Extra fetch options (signal, etc.)
 * @returns {Promise<Response>}
 */
export async function tmdbFetch(tmdbUrl, options = {}) {
  const url = new URL(tmdbUrl);
  const proxyParams = new URLSearchParams(url.searchParams);
  proxyParams.set('path', url.pathname);

  return fetch(`/api/tmdb?${proxyParams}`, {
    ...options,
    method: 'GET',
    headers: { accept: 'application/json' },
  });
}

export default tmdbFetch;
