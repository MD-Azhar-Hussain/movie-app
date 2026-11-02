/**
 * Mock TMDB API for offline development and build verification.
 *
 *   node scripts/mock-tmdb-server.mjs          # http://127.0.0.1:5099
 *   TMDB_BASE_URL=http://127.0.0.1:5099 npm run build
 *
 * Every endpoint the app touches is answered with deterministic data, so the
 * prerender can be tested without a TMDB key, without network access and
 * without burning the real API quota. It is never used in production: the base
 * URL only changes when `TMDB_BASE_URL` is set explicitly.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_TMDB_PORT || 5099);

const GENRE_IDS = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37, 10770];

const makeMovie = (id, title, year = 2024, rating = 7.5) => ({
  id,
  title,
  original_title: title,
  overview: `${title} is a sample movie used to verify the prerender pipeline. It has a synopsis long enough to look like real content on the page.`,
  release_date: `${year}-06-15`,
  vote_average: rating,
  vote_count: 1200 + id,
  popularity: 100 + id,
  poster_path: `/sample-${id}.jpg`,
  backdrop_path: `/sample-backdrop-${id}.jpg`,
  original_language: 'en',
  genre_ids: [28, 12],
  adult: false,
});

const CATALOGUE = Array.from({ length: 40 }, (_, index) =>
  makeMovie(1000 + index, `Sample Movie ${index + 1}`, 2026 - (index % 8), 6 + (index % 4))
);

const movieDetails = (id) => {
  const movie = CATALOGUE.find((entry) => entry.id === Number(id)) || makeMovie(Number(id), `Sample Movie ${id}`);

  return {
    ...movie,
    runtime: 118,
    status: 'Released',
    tagline: 'A sample tagline for the prerender check.',
    budget: 50000000,
    revenue: 120000000,
    genres: [
      { id: 28, name: 'Action' },
      { id: 53, name: 'Thriller' },
    ],
    production_companies: [{ id: 1, name: 'Sample Studios' }],
    credits: {
      cast: [
        { id: 1, name: 'Sample Actor', character: 'Lead', profile_path: '/sample-actor.jpg' },
        { id: 2, name: 'Second Actor', character: 'Support', profile_path: null },
      ],
      crew: [{ id: 3, name: 'Sample Director', job: 'Director' }],
    },
    videos: {
      results: [
        { key: 'dQw4w9WgXcQ', site: 'YouTube', type: 'Trailer', name: 'Official Trailer', published_at: '2024-01-01T00:00:00.000Z' },
      ],
    },
    recommendations: { results: CATALOGUE.slice(1, 13) },
  };
};

const listResponse = (page, results) => ({
  page,
  results,
  total_pages: 5,
  total_results: 100,
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname.replace(/^\/3/, '');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (pathname === '/movie/popular' || pathname === '/movie/top_rated' || pathname === '/discover/movie') {
    const page = Number(url.searchParams.get('page') || 1);
    const offset = (page - 1) * 20;
    const results = CATALOGUE.slice(offset, offset + 20);
    res.end(JSON.stringify(listResponse(page, results.length ? results : CATALOGUE.slice(0, 20))));
    return;
  }

  const detailMatch = pathname.match(/^\/movie\/(\d+)$/);
  if (detailMatch) {
    res.end(JSON.stringify(movieDetails(detailMatch[1])));
    return;
  }

  if (pathname === '/genre/movie/list') {
    res.end(JSON.stringify({ genres: GENRE_IDS.map((id) => ({ id, name: `Genre ${id}` })) }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ status_code: 34, status_message: 'Not found in the mock API.', success: false }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-tmdb] listening on http://127.0.0.1:${PORT}`);
});
