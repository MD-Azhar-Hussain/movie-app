import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import flowbiteReact from 'flowbite-react/plugin/vite';
import { fetchPopularMovieRoutes } from './src/api/tmdb-ssg.js';

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [posterManifestPlugin(), react(), tailwindcss(), flowbiteReact()],
  ssr: {
    noExternal: ['react-helmet-async', 'react-use'],
  },
  ssgOptions: {
    script: 'async',
    formatting: 'none',
    dirStyle: 'nested',
    mock: true,
    concurrency: 10,
    includedRoutes: async (paths, routes) => {
      try {
        const movieRoutes = await fetchPopularMovieRoutes(100);
        return ['/', ...movieRoutes];
      } catch (err) {
        console.warn('[SSG] Error fetching popular movie routes for SSG:', err.message);
        return paths;
      }
    },
  },
});