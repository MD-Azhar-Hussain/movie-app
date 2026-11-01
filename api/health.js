/**
 * Deployment health check — open /api/health in the browser to verify that the
 * serverless TMDB proxy has a key configured.
 *
 * Returns booleans only; never the key itself.
 */
export default function handler(req, res) {
  const tmdbApiKey = Boolean(process.env.TMDB_API_KEY);
  const viteApiKey = Boolean(process.env.VITE_API_KEY);

  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({
    ok: tmdbApiKey || viteApiKey,
    tmdbKey: {
      TMDB_API_KEY: tmdbApiKey,
      VITE_API_KEY: viteApiKey,
    },
    hint:
      tmdbApiKey || viteApiKey
        ? 'The TMDB proxy is configured.'
        : 'Set TMDB_API_KEY (or VITE_API_KEY) in the deployment environment, then redeploy.',
    node: process.version,
  });
}
