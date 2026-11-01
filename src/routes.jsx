import React from 'react';
import App from './App';
import HomePage from './pages/HomePage';
import MovieDetails from './pages/MovieDetails';
import GenrePage from './pages/GenrePage';
import NotFound from './pages/NotFound';
import { getGenreBySlug } from './lib/genres';

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

    if (!response.ok) return null;

    const contentType = response.headers?.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    return await response.json();
  } catch {
    return null;
  }
};

export const genreLoader = async ({ params }) => {
  const genre = getGenreBySlug(params.slug);
  if (!genre) return null;

  const query = `discover/movie?with_genres=${genre.id}&sort_by=popularity.desc&vote_count.gte=50&include_adult=false&language=en-US`;

  if (import.meta.env.SSR) {
    const { fetchTmdbServer } = await import('./api/tmdbServer');
    return fetchTmdbServer(`/${query}`);
  }

  const { tmdbFetch } = await import('./api/tmdbProxy');

  try {
    const response = await tmdbFetch(`https://api.themoviedb.org/3/${query}`);
    if (!response.ok) return null;

    const contentType = response.headers?.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    return await response.json();
  } catch {
    return null;
  }
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
        path: '*',
        element: <NotFound />,
      },
    ],
  },
];

export default routes;
