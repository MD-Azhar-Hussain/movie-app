/**
 * Verifies a deployed site.
 *
 * "The site is live but /build-info.json 404s and the genre pages are empty" is
 * almost always one of two things: the deployment failed and Vercel is still
 * serving the previous build, or the build ran without a TMDB key. This script
 * tells you which, from the outside, in one command:
 *
 *   npm run verify:deploy
 *   node scripts/verify-deploy.mjs https://filmpoint.vercel.app
 *
 * It compares the commit reported by the deployment with the local HEAD, then
 * checks the SEO surface: robots, sitemap, a genre hub, a curated list and a
 * movie page. Exit code is 1 when something is actually broken.
 */
import { spawnSync } from 'node:child_process';

const target = (process.argv[2] || process.env.SITE_URL || 'https://filmpoint.vercel.app').replace(/\/+$/, '');

const results = [];
let failed = false;

const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  if (!ok) failed = true;
};

const localCommit = (() => {
  const result = spawnSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
})();

const get = async (pathname) => {
  try {
    const response = await fetch(`${target}${pathname}`, {
      redirect: 'follow',
      headers: { 'user-agent': 'FilmPointDeployCheck/1.0' },
      signal: AbortSignal.timeout(25000),
    });
    const body = await response.text();
    return { status: response.status, body, contentType: response.headers.get('content-type') || '' };
  } catch (error) {
    return { status: 0, body: '', contentType: '', error: error.cause?.code || error.message };
  }
};

const main = async () => {
  console.log(`[verify] Checking ${target}${localCommit ? ` (local HEAD ${localCommit})` : ''}\n`);

  // 1. Static build report
  const buildInfo = await get('/build-info.json');
  if (buildInfo.status === 200) {
    try {
      const info = JSON.parse(buildInfo.body);
      record(
        'GET /build-info.json',
        true,
        `commit=${info.commit || 'unknown'} built=${info.builtAt || 'unknown'} ` +
          `movies=${info.moviePages} genres=${info.genrePagesWithMovies}/${info.genrePages} ` +
          `collections=${info.collectionPagesWithMovies}/${info.collectionPages}`
      );
      if (localCommit && info.commit && info.commit !== localCommit) {
        record(
          'Deployment matches local HEAD',
          false,
          `deployed ${info.commit} but local HEAD is ${localCommit} — the deploy is stale, redeploy`
        );
      }
      if (Array.isArray(info.problems) && info.problems.length > 0) {
        record('Build reported no problems', false, info.problems.join(' | '));
      }
    } catch {
      record('GET /build-info.json', false, `returned 200 but is not JSON (${buildInfo.contentType})`);
    }
  } else {
    record(
      'GET /build-info.json',
      false,
      `HTTP ${buildInfo.status} — the deployment was built without the post-build step ` +
        '(run `npm run build` locally to confirm it writes dist/build-info.json)'
    );
  }

  // 2. Runtime diagnostics
  const apiBuildInfo = await get('/api/build-info');
  if (apiBuildInfo.status === 200) {
    try {
      const info = JSON.parse(apiBuildInfo.body);
      record(
        'GET /api/build-info',
        true,
        `env=${info.runtime?.environment} commit=${info.deployment?.commit || 'unknown'}`
      );
    } catch {
      record('GET /api/build-info', false, 'returned 200 but is not JSON');
    }
  } else {
    record('GET /api/build-info', false, `HTTP ${apiBuildInfo.status} — the function is not deployed`);
  }

  // 3. Health
  const health = await get('/api/health');
  if (health.status === 200) {
    try {
      const payload = JSON.parse(health.body);
      record('GET /api/health', Boolean(payload.ok), `tmdb key configured: ${payload.ok}`);
    } catch {
      record('GET /api/health', false, 'returned 200 but is not JSON');
    }
  } else {
    record('GET /api/health', false, `HTTP ${health.status}`);
  }

  // 4. robots.txt
  const robots = await get('/robots.txt');
  record(
    'GET /robots.txt',
    robots.status === 200 && robots.body.includes('Sitemap:'),
    robots.status === 200 ? (robots.body.includes('Sitemap:') ? 'has Sitemap directive' : 'missing Sitemap directive') : `HTTP ${robots.status}`
  );

  // 5. sitemap.xml
  const sitemap = await get('/sitemap.xml');
  const sitemapUrls = (sitemap.body.match(/<loc>/g) || []).length;
  record(
    'GET /sitemap.xml',
    sitemap.status === 200 && sitemapUrls > 20,
    sitemap.status === 200 ? `${sitemapUrls} URLs` : `HTTP ${sitemap.status}`
  );

  // 6. The SEO surface
  const sampleMovieId = (sitemap.body.match(/\/movie\/(\d+)</) || [])[1];
  const pages = ['/', '/genres', '/top-rated', '/genre/action', '/year/2024', sampleMovieId ? `/movie/${sampleMovieId}` : null].filter(
    Boolean
  );

  for (const pathname of pages) {
    const page = await get(pathname);
    const hasCanonical = /rel="canonical"/.test(page.body);
    record(`GET ${pathname}`, page.status === 200 && hasCanonical, `HTTP ${page.status}${hasCanonical ? ', canonical present' : ', NO canonical'}`);
  }

  // 7. llms.txt
  const llms = await get('/llms.txt');
  record('GET /llms.txt', llms.status === 200 && llms.body.length > 500, llms.status === 200 ? `${llms.body.length} bytes` : `HTTP ${llms.status}`);

  console.log('');
  for (const result of results) {
    console.log(`${result.ok ? 'OK  ' : 'FAIL'}  ${result.name.padEnd(34)} ${result.detail}`);
  }

  console.log('');
  if (failed) {
    console.error('[verify] One or more checks failed — see the FAIL lines above.');
    console.error('[verify] If /build-info.json is the only failure, the live deployment predates the current build.');
    process.exit(1);
  }

  console.log('[verify] All checks passed.');
};

main();
