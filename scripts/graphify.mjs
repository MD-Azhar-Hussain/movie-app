#!/usr/bin/env node
/**
 * Project-local launcher for Graphify.
 *
 * Graphify is a Python CLI. This project keeps it inside `.tools/venv` so
 * nothing is installed globally and nothing outside this folder is touched.
 *
 * Usage (via npm scripts):
 *   npm run graph:build
 *   npm run graph:query -- "how does the watchlist sync queue work"
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const isWindows = process.platform === 'win32';

const localBinary = path.join(
  projectRoot,
  '.tools',
  'venv',
  isWindows ? 'Scripts' : 'bin',
  isWindows ? 'graphify.exe' : 'graphify'
);

if (!existsSync(localBinary)) {
  console.error(
    [
      '',
      'Graphify is not installed inside this project yet.',
      '',
      'It must stay project-local (no global install). Run:',
      '',
      '  npm run graph:setup',
      '',
      'That creates .tools/venv (git-ignored) and installs the `graphifyy` package into it.',
      'See docs/graphify.md for details.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

const result = spawnSync(localBinary, process.argv.slice(2), {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Failed to run Graphify: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
