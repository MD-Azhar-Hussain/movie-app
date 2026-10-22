import React from 'react';
import App from './App';
import HomePage from './pages/HomePage';
import MovieDetails from './pages/MovieDetails';
import { getTmdbApiKey } from './api/tmdb-ssg';

export const movieLoader = async ({ params }) => {
  const { id } = params;
  if (!id) return null;

  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) ||
    getTmdbApiKey();

  if (!apiKey) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,videos,recommendations`,
        {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        return null;
      }

      return await res.json();
    } catch {
      if (attempt === 2) return null;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  return null;
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
        path: '*',
        element: <HomePage />,
      },
    ],
  },
];

export default routes;
