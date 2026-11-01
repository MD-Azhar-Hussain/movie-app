#!/usr/bin/env node
/**
 * Project-local bootstrap for Graphify.
 *
 * Confines everything to this repository:
 *   .tools/venv      virtual environment holding the `graphifyy` package
 *   .tools/uv-cache  uv download/build cache (otherwise kept in the user profile)
 *
 * Idempotent: safe to run repeatedly. Requires `uv` on PATH (the only external
 * prerequisite, and it is not modified by this script).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const toolsDir = path.join(projectRoot, '.tools');
const venvDir = path.join(toolsDir, 'venv');
const cacheDir = path.join(toolsDir, 'uv-cache');
const isWindows = process.platform === 'win32';

const env = { ...process.env, UV_CACHE_DIR: cacheDir };

const run = (args) => {
  console.log(`\n> uv ${args.join(' ')}`);

  const result = spawnSync('uv', args, { cwd: projectRoot, stdio: 'inherit', env });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error(
        '\n`uv` was not found on PATH.\n' +
          'Install it from https://docs.astral.sh/uv/ — it is the only external prerequisite.\n' +
          'Nothing else is installed globally by this script.'
      );
      process.exit(1);
    }

    console.error(`Failed to run uv: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(['venv', venvDir, '--allow-existing']);
run(['pip', 'install', '--python', venvDir, 'graphifyy']);

const binary = path.join(venvDir, isWindows ? 'Scripts' : 'bin', isWindows ? 'graphify.exe' : 'graphify');

if (!existsSync(binary)) {
  console.error('\nInstall completed but the graphify executable was not found. Check the uv output above.');
  process.exit(1);
}

console.log(`\nGraphify is ready inside this project: ${path.relative(projectRoot, binary)}`);
console.log('Cache kept local at: .tools/uv-cache');
console.log('Next: npm run graph:build');
