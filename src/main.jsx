import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import './index.css';

// Guard against stale or 404 static-loader-data manifest/data responses throwing JSON SyntaxError
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      if (url.includes('static-loader-data')) {
        const contentType = response.headers?.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
          // Return an empty JSON object so ViteReactSSG client loader never crashes with SyntaxError
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return response;
    } catch (err) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (url.includes('static-loader-data')) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }
  };
}

export const createRoot = ViteReactSSG({
  routes,
  basename: import.meta.env.BASE_URL,
});
