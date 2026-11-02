/**
 * Runtime build diagnostics: `/api/build-info`.
 *
 * `/build-info.json` is a static file written by the build (see
 * `scripts/build-info.mjs`). When that file 404s, the usual cause is that the
 * deployment never ran the post-processing step — which also means production
 * is serving an older commit. This function answers the question without
 * needing the file: it reports the commit, branch and environment the running
 * deployment was built from, plus whether the TMDB keys exist at runtime.
 *
 * Values are booleans and non-secret identifiers only; the key itself is never
 * returned.
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  return res.status(200).json({
    ok: true,
    source: '/api/build-info',
    note:
      'This is the runtime diagnostic endpoint. The static build report lives at /build-info.json. ' +
      'HTTP 200 here with a 404 there means the deployment was built without the post-build step — redeploy from the latest commit.',
    runtime: {
      node: process.version,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      region: process.env.VERCEL_REGION || null,
      deploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    },
    deployment: {
      commit,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      repo: process.env.VERCEL_GIT_REPO_SLUG || null,
    },
    keys: {
      TMDB_API_KEY: Boolean(process.env.TMDB_API_KEY),
      VITE_API_KEY: Boolean(process.env.VITE_API_KEY),
    },
    hint:
      process.env.TMDB_API_KEY || process.env.VITE_API_KEY
        ? 'Runtime TMDB access is configured.'
        : 'Set TMDB_API_KEY (or VITE_API_KEY) for the deployment, then redeploy.',
  });
}
