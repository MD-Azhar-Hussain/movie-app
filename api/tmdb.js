/**
 * Vercel Serverless Function — TMDB API Proxy
 *
 * Routes client requests through Vercel's server so the browser never calls
 * api.themoviedb.org directly. This bypasses college/corporate firewalls and
 * keeps the API key hidden from the client.
 *
 * Usage from the frontend:
 *   fetch('/api/tmdb?path=/3/movie/popular&language=en-US&page=1')
 *
 * The `path` query param is the TMDB endpoint (e.g. "/3/movie/550").
 * All other query params are forwarded to TMDB as-is.
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error('[tmdb-proxy] TMDB_API_KEY environment variable is not set.');
    return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
  }

  // Extract the TMDB path from the `path` query param
  const { path: tmdbPath, ...queryParams } = req.query;

  if (!tmdbPath) {
    return res.status(400).json({
      error: 'Missing "path" query parameter. Example: /api/tmdb?path=/3/movie/popular',
    });
  }

  // Ensure the path starts with /3/ (TMDB v3 API)
  if (!tmdbPath.startsWith('/3/')) {
    return res.status(400).json({ error: 'Invalid TMDB path. Must start with /3/' });
  }

  // Build the upstream TMDB URL
  const searchParams = new URLSearchParams(queryParams);
  const tmdbUrl = `https://api.themoviedb.org${tmdbPath}${searchParams.toString() ? `?${searchParams}` : ''}`;

  try {
    const tmdbResponse = await fetch(tmdbUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const contentType = tmdbResponse.headers.get('content-type') || '';
    const body = await tmdbResponse.text();

    // Forward TMDB's status code and content type
    res.setHeader('Content-Type', contentType);

    // Cache successful responses for 5 minutes on Vercel's CDN, 1 minute in browser
    if (tmdbResponse.ok) {
      res.setHeader('Cache-Control', 's-maxage=300, max-age=60, stale-while-revalidate=600');
    }

    return res.status(tmdbResponse.status).send(body);
  } catch (error) {
    console.error('[tmdb-proxy] Upstream fetch failed:', error);
    return res.status(502).json({ error: 'Failed to reach TMDB. Please try again.' });
  }
}
