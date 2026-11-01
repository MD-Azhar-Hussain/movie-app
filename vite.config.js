import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import flowbiteReact from 'flowbite-react/plugin/vite';
import {
  fetchPopularMovieRoutes,
  fetchPopularMovieSummaries,
  getTmdbApiKey,
} from './src/api/tmdb-ssg.js';
import { GENRE_PATHS } from './src/lib/genres.js';


/**
 * Number of movie pages that get prerendered, listed in the sitemap and linked
 * from the static "Popular movie pages" navigation. More prerendered pages =
 * faster discovery by search engines.
 */
const POPULAR_MOVIE_COUNT = 200;

const posterManifestPlugin = () => {
  const virtualModuleId = 'virtual:poster-manifest';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;
  const projectRoot = path.dirname(fileURLToPath(import.meta.url));
  const posterDirectory = path.resolve(projectRoot, 'public/newposters');

  return {
    name: 'poster-manifest',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return undefined;

      const posterFiles = fs.readdirSync(posterDirectory)
        .filter((fileName) => /\.(avif|gif|jpe?g|png|webp)$/i.test(fileName))
        .sort((firstFile, secondFile) => firstFile.localeCompare(secondFile));

      return `export default ${JSON.stringify(posterFiles)};`;
    },
    handleHotUpdate({ file, server }) {
      if (path.dirname(file) === posterDirectory) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }

      return undefined;
    },
  };
};

/**
 * Exposes the build-time popular movie list to the app so the home page can
 * render a static, crawlable block of internal links.
 */
const popularMoviesPlugin = () => {
  const virtualModuleId = 'virtual:popular-movies';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: 'popular-movies',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return undefined;

      try {
        const summaries = await fetchPopularMovieSummaries(POPULAR_MOVIE_COUNT);
        return `export default ${JSON.stringify(summaries)};`;
      } catch (error) {
        console.warn('[vite] Unable to build the popular movies list:', error.message);
        return 'export default [];';
      }
    },
  };
};

/**
 * Local development replacement for the Vercel serverless TMDB proxy so the
 * TMDB bearer token never has to be exposed through `import.meta.env`.
 */
const tmdbDevProxyPlugin = () => ({
  name: 'tmdb-dev-proxy',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const requestUrl = req.url || '';
      if (!requestUrl.startsWith('/api/tmdb')) {
        next();
        return;
      }

      const respondWithJson = (statusCode, payload) => {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      };

      const apiKey = getTmdbApiKey();
      if (!apiKey) {
        respondWithJson(500, { error: 'Missing VITE_API_KEY in the local .env file' });
        return;
      }

      const parsedUrl = new URL(requestUrl, 'http://localhost');
      const tmdbPath = parsedUrl.searchParams.get('path');

      if (!tmdbPath || !tmdbPath.startsWith('/3/')) {
        respondWithJson(400, { error: 'Invalid TMDB path. Must start with /3/' });
        return;
      }

      const upstreamParams = new URLSearchParams(parsedUrl.searchParams);
      upstreamParams.delete('path');
      const upstreamUrl = `https://api.themoviedb.org${tmdbPath}${
        upstreamParams.toString() ? `?${upstreamParams}` : ''
      }`;

      try {
        let upstreamResponse;

        // Transient network resets are common on flaky networks; retry once.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            upstreamResponse = await fetch(upstreamUrl, {
              headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` },
            });
            break;
          } catch (fetchError) {
            if (attempt === 1) throw fetchError;
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        res.statusCode = upstreamResponse.status;
        res.setHeader(
          'Content-Type',
          upstreamResponse.headers.get('content-type') || 'application/json'
        );
        res.setHeader('Cache-Control', 'no-store');
        res.end(await upstreamResponse.text());
      } catch (error) {
        console.error('[vite] TMDB dev proxy failed:', error.message, error.cause?.message || '');
        respondWithJson(502, { error: 'Failed to reach TMDB. Please try again.' });
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    posterManifestPlugin(),
    popularMoviesPlugin(),
    tmdbDevProxyPlugin(),
    react(),
    tailwindcss(),
    flowbiteReact(),
  ],
  ssr: {
    noExternal: ['react-helmet-async'],
  },
  build: {
    // Keep the lighter "modern" baseline for better compression on evergreen browsers.
    target: 'es2020',
  },
  ssgOptions: {
    script: 'async',
    formatting: 'none',
    dirStyle: 'nested',
    mock: true,
    concurrency: 10,
    includedRoutes: async () => {
      try {
        const movieRoutes = await fetchPopularMovieRoutes(POPULAR_MOVIE_COUNT);
        return ['/', ...movieRoutes, ...GENRE_PATHS];
      } catch (error) {
        console.warn('[SSG] Error fetching popular movie routes for SSG:', error.message);
        return ['/', ...GENRE_PATHS];
      }
    },
  },
});
