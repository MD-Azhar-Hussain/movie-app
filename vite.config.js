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
import { COLLECTION_PATHS, GENRES_INDEX_PATH } from './src/lib/collections.js';
import { BUILD_INFO_FILENAME, collectBuildInfo } from './scripts/build-info.mjs';

const projectRootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * A production build without a TMDB key silently ships a degraded site: the genre
 * hubs prerender empty, the "Popular movie pages" dropdown renders nothing, no
 * movie page is generated and the sitemap is nearly empty.
 *
 * The build used to *throw* in that case, which is the worst of both outcomes:
 * the deployment fails, Vercel keeps serving the previous (older) build, and
 * nothing in the UI explains why the site looks stale. It now warns loudly and
 * lets the build finish, so every deployment publishes current HTML plus a
 * `build-info.json` that spells out what is missing. Opt into the hard failure
 * with STRICT_TMDB_BUILD_CHECK=1.
 */
const assertTmdbKeyForBuild = (command) => {
  if (command !== 'build') return;

  if (process.env.SKIP_TMDB_BUILD_CHECK === '1') {
    console.warn('[build] SKIP_TMDB_BUILD_CHECK=1 — building without a TMDB key (degraded output).');
    return;
  }

  if (getTmdbApiKey()) return;

  console.error(
    [
      '',
      '==============================================================',
      ' WARNING: VITE_API_KEY is missing',
      ' This build ships empty genre pages and no movie pages.',
      '==============================================================',
      ' The TMDB bearer token is needed at BUILD time to prerender:',
      '   - the ~200 movie pages',
      '   - the 19 genre hub pages (their ranked movie lists)',
      '   - the curated year / decade / top-rated lists',
      '   - the "Popular movie pages" dropdown',
      '   - sitemap.xml and llms.txt entries',
      '',
      ' Fix: Vercel -> Project -> Settings -> Environment Variables ->',
      '      add VITE_API_KEY (TMDB v4 read token) for Production AND Preview,',
      '      then redeploy (env changes only apply to new builds).',
      '',
      ' The runtime proxy also needs TMDB_API_KEY (VITE_API_KEY is accepted as',
      ' a fallback). Verify a deployment with /api/health, /api/build-info and',
      ' /build-info.json.',
      '',
      ' Want the build to fail instead of publishing a degraded site?',
      ' Set STRICT_TMDB_BUILD_CHECK=1 in the build environment.',
      '==============================================================',
      '',
    ].join('\n')
  );

  if (process.env.STRICT_TMDB_BUILD_CHECK === '1') {
    throw new Error(
      'VITE_API_KEY is missing and STRICT_TMDB_BUILD_CHECK=1 is set. Add VITE_API_KEY to the build environment and redeploy.'
    );
  }
};

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
  const optimizedDirectory = path.join(posterDirectory, 'optimized');
  const imagePattern = /\.(avif|gif|jpe?g|png|webp)$/i;

  // Prefer the resized WebP variants produced by `npm run posters:optimize`;
  // fall back to the originals when they have not been generated yet.
  const pickPosterDirectory = () => {
    try {
      const optimizedFiles = fs.readdirSync(optimizedDirectory).filter((fileName) => imagePattern.test(fileName));
      if (optimizedFiles.length > 0) {
        return { directory: optimizedDirectory, urlBase: '/newposters/optimized' };
      }
    } catch {
      // Optimized directory does not exist yet.
    }

    return { directory: posterDirectory, urlBase: '/newposters' };
  };

  return {
    name: 'poster-manifest',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return undefined;

      const { directory, urlBase } = pickPosterDirectory();

      const posters = fs.readdirSync(directory)
        .filter((fileName) => imagePattern.test(fileName))
        .sort((firstFile, secondFile) => firstFile.localeCompare(secondFile))
        .map((fileName) => ({
          file: fileName,
          url: `${urlBase}/${encodeURIComponent(fileName)}`,
        }));

      return `export default ${JSON.stringify(posters)};`;
    },
    handleHotUpdate({ file, server }) {
      if (path.dirname(file) === posterDirectory || path.dirname(file) === optimizedDirectory) {
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
 * Local implementation of the Vercel serverless TMDB proxy, so the TMDB bearer
 * token never has to be exposed through `import.meta.env`.
 *
 * Used by both `vite dev` and `vite preview`. Without it, preview (or any plain
 * static host) answers `/api/tmdb` with index.html, every loader rejects the
 * non-JSON response and every genre/movie page shows "could not load".
 */
const createTmdbProxyMiddleware = () => async (req, res, next) => {
  const requestUrl = req.url || '';
  if (!requestUrl.startsWith('/api/tmdb')) {
    next();
    return;
  }

  const respondWithJson = (statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
  };

  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    respondWithJson(500, {
      error: 'Missing VITE_API_KEY in the local .env file',
      hint: 'Add VITE_API_KEY to .env (a TMDB v4 bearer token) and restart the server.',
    });
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

        // Transient network resets are common on flaky networks, and TMDB
        // throttles with a 401 that claims the key is invalid. Retry both, up to
        // three attempts, before surfacing the upstream error to the browser.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await fetch(upstreamUrl, {
              headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(20000),
            });

            const retryable =
              response.status === 401 ||
              response.status === 403 ||
              response.status === 429 ||
              response.status >= 500;

            if (retryable && attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
              continue;
            }

            upstreamResponse = response;
            break;
          } catch (fetchError) {
            if (attempt === 2) throw fetchError;
            await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
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
        console.error('[vite] TMDB proxy failed:', error.message, error.cause?.message || '');
        respondWithJson(502, { error: 'Failed to reach TMDB. Please try again.' });
      }
};

/**
 * `vite preview` serves `dist/` statically and has no rewrite rules, so map
 * clean URLs onto the prerendered directory index:
 *   /genre/mystery -> dist/genre/mystery/index.html
 */
const cleanUrlPreviewMiddleware = (req, _res, next) => {
  const requestPath = (req.url || '/').split('?')[0];
  const hasExtension = /\.[a-z0-9]+$/i.test(requestPath);

  if (requestPath === '/' || requestPath.startsWith('/api/') || hasExtension) {
    next();
    return;
  }

  const segments = decodeURIComponent(requestPath).split('/').filter((segment) => segment && segment !== '..');
  const indexPath = path.join(projectRootDir, 'dist', ...segments, 'index.html');

  if (fs.existsSync(indexPath)) {
    req.url = `/${segments.join('/')}/index.html`;
  }

  next();
};

const tmdbProxyPlugin = () => ({
  name: 'tmdb-proxy',
  configureServer(server) {
    server.middlewares.use(createTmdbProxyMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(cleanUrlPreviewMiddleware);
    server.middlewares.use(createTmdbProxyMiddleware());
  },
});

/**
 * Serves `/build-info.json` from `vite dev` and `vite preview`.
 *
 * The static file only exists after a full build, so both commands used to
 * answer this URL with the SPA shell or a bare 404 — the same confusing response
 * that made the production 404 hard to diagnose. Here the report is generated on
 * demand from whatever is in `dist/`.
 */
const buildInfoMiddleware = (req, res, next) => {
  const requestPath = (req.url || '').split('?')[0];
  const isBuildInfoRequest = [
    `/${BUILD_INFO_FILENAME}`,
    `/api/build-info`,
    `/api/${BUILD_INFO_FILENAME}`,
  ].includes(requestPath);

  if (!isBuildInfoRequest) {
    next();
    return;
  }

  let payload;
  try {
    payload = collectBuildInfo({ distDir: path.join(projectRootDir, 'dist') });
  } catch (error) {
    payload = { ok: false, error: error.message };
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`${JSON.stringify({ ...payload, source: 'vite dev/preview middleware' }, null, 2)}\n`);
};

const buildInfoPlugin = () => ({
  name: 'build-info',
  configureServer(server) {
    server.middlewares.use(buildInfoMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(buildInfoMiddleware);
  },
});

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  assertTmdbKeyForBuild(command);

  return {
  define: {
    // Vercel provides the analytics/speed-insights scripts only on its own
    // platform. Flag the build so local previews do not request them (and log
    // two 404s in the console).
    __VERCEL_DEPLOYMENT__: JSON.stringify(
      Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_BUILDER)
    ),
  },
  plugins: [
    posterManifestPlugin(),
    popularMoviesPlugin(),
    buildInfoPlugin(),
    tmdbProxyPlugin(),
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
    // 'async' let the module script execute before the inline
    // `window.__VITE_REACT_SSG_HASH__` assignment at the end of <body>, which
    // made hydration fetch `static-loader-data-manifest-undefined.json`.
    // 'defer' keeps execution order (after the document is parsed).
    script: 'defer',
    formatting: 'none',
    dirStyle: 'nested',
    mock: true,
    concurrency: 10,
    includedRoutes: async () => {
      // Every page that gets prerendered to static HTML. The curated list pages
      // (top rated, release years, decades) are the SEO surface that competes
      // for "best movies of <year>" style queries; each one is a real page with
      // its own copy, canonical URL, structured data and sitemap entry.
      const collectionRoutes = [GENRES_INDEX_PATH, ...COLLECTION_PATHS];

      try {
        const movieRoutes = await fetchPopularMovieRoutes(POPULAR_MOVIE_COUNT);
        return ['/', ...collectionRoutes, ...GENRE_PATHS, ...movieRoutes];
      } catch (error) {
        console.warn('[SSG] Error fetching popular movie routes for SSG:', error.message);
        return ['/', ...collectionRoutes, ...GENRE_PATHS];
      }
    },
  },
  };
});
