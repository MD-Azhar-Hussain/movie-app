import React from 'react';
import App from './App';
import HomePage from './pages/HomePage';
import MovieDetails from './pages/MovieDetails';
import GenrePage from './pages/GenrePage';
import GenresIndexPage from './pages/GenresIndexPage';
import CollectionPage from './pages/CollectionPage';
import NotFound from './pages/NotFound';
import { getGenreBySlug } from './lib/genres';
import { getCollectionFromParams } from './lib/collections';

/**
 * Shared failure reporting for the browser loaders.
 *
 * A `null` loader result is what renders "could not load" in the UI, so log the
 * real reason to the console: a 5xx means the serverless proxy has no key, and
 * non-JSON means the route does not exist at all (e.g. `vite preview`, or a
 * static host without the function).
 */
const parseTmdbProxyResponse = async (response, label) => {
  if (!response.ok) {
    console.warn(
      `[${label}] /api/tmdb responded ${response.status}.` +
        (response.status >= 500
          ? ' The TMDB proxy is not configured — set TMDB_API_KEY (or VITE_API_KEY) in the environment.'
          : '')
    );
    return null;
  }

  const contentType = response.headers?.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    console.warn(
      `[${label}] /api/tmdb returned "${contentType || 'no content-type'}" instead of JSON.` +
        ' The API route is not available in this environment (use `npm run dev`, or deploy to Vercel).' +
        ' See README → Troubleshooting.'
    );
    return null;
  }

  try {
    return await response.json();
  } catch (error) {
    console.warn(`[${label}] Could not parse the TMDB response:`, error);
    return null;
  }
};

export const movieLoader = async ({ params }) => {
  const { id } = params;
  if (!id) return null;

  // Server rendering (SSG build): call TMDB directly. The dynamic import is
  // gated by `import.meta.env.SSR` so the API key is tree-shaken out of the
  // client bundle.
  if (import.meta.env.SSR) {
    const { fetchMovieDetails } = await import('./api/tmdbServer');
    return fetchMovieDetails(id);
  }

  // Browser: always go through the same-origin serverless proxy.
  const { tmdbFetch } = await import('./api/tmdbProxy');

  try {
    const response = await tmdbFetch(
      `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,videos,recommendations`
    );

    return await parseTmdbProxyResponse(response, 'movie');
  } catch (error) {
    console.warn('[movie] Request to /api/tmdb failed:', error.message);
    return null;
  }
};

/**
 * Shared list loader for every page that renders "a page of movies": the genre
 * hubs, the yearly lists, the decade lists and the top-rated page.
 *
 * `tmdbPath` is a path on api.themoviedb.org/3 (e.g. "/discover/movie?..."),
 * so callers only have to describe which slice of the catalogue they want.
 */
const loadTmdbList = async (tmdbPath, label) => {
  if (!tmdbPath) return null;

  if (import.meta.env.SSR) {
    const { fetchTmdbServer } = await import('./api/tmdbServer');
    return fetchTmdbServer(tmdbPath);
  }

  const { tmdbFetch } = await import('./api/tmdbProxy');

  try {
    const response = await tmdbFetch(`https://api.themoviedb.org/3${tmdbPath}`);
    return await parseTmdbProxyResponse(response, label);
  } catch (error) {
    console.warn(`[${label}] Request to /api/tmdb failed:`, error.message);
    return null;
  }
};

export const genreLoader = async ({ params }) => {
  const genre = getGenreBySlug(params.slug);
  if (!genre) return null;

  const query = `discover/movie?with_genres=${genre.id}&sort_by=popularity.desc&vote_count.gte=50&include_adult=false&language=en-US`;

  return loadTmdbList(`/${query}`, 'genre');
};

/**
 * Loader for `/top-rated`, `/year/:year` and `/decade/:decade`.
 *
 * The TMDB query lives in `src/lib/collections.js` next to the page copy, so the
 * prerendered HTML, the sitemap entry and llms.txt always describe the same
 * thing.
 */
export const collectionLoader = async ({ params }) => {
  const collection = getCollectionFromParams(params);
  if (!collection) return null;

  return loadTmdbList(collection.tmdbPath, collection.kind);
};

export const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'movie/:id',
        element: <MovieDetails />,
        loader: movieLoader,
      },
      {
        path: 'genre/:slug',
        element: <GenrePage />,
        loader: genreLoader,
      },
      {
        // Genre index: the crawl hub that links all 19 genre pages.
        path: 'genres',
        element: <GenresIndexPage />,
      },
      {
        path: 'top-rated',
        element: <CollectionPage />,
        loader: collectionLoader,
      },
      {
        path: 'year/:year',
        element: <CollectionPage />,
        loader: collectionLoader,
      },
      {
        path: 'decade/:decade',
        element: <CollectionPage />,
        loader: collectionLoader,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
];

export default routes;

