import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import flowbiteReact from "flowbite-react/plugin/vite";

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
})