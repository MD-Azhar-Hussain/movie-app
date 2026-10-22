import fs from 'node:fs';
import path from 'node:path';

// Helper to resolve VITE_API_KEY from environment or .env file
export const getTmdbApiKey = () => {
  if (typeof process !== 'undefined') {
    if (process.env.VITE_API_KEY) {
      return process.env.VITE_API_KEY.trim();
    }
    // Check .env if process.env doesn't have it
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/VITE_API_KEY=(.+)/);
        if (match && match[1]) {
          return match[1].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return '';
};

/**
 * Fetches top popular movie IDs from TMDB API at build time.
 * @param {number} count Total number of movie IDs to fetch (default: 100)
 * @returns {Promise<number[]>} Array of TMDB movie IDs
 */
export const fetchPopularMovieIds = async (count = 100) => {
  const apiKey = getTmdbApiKey();

  if (!apiKey) {
    console.warn('[SSG] VITE_API_KEY not found. Skipping dynamic route generation.');
    return [];
  }

  const movieIds = new Set();
  const pagesToFetch = Math.ceil(count / 20);

  for (let page = 1; page <= pagesToFetch; page++) {
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?language=en-US&page=${page}`, {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        if (!res.ok) {
          console.warn(`[SSG] Failed to fetch TMDB popular page ${page} (HTTP ${res.status})`);
          break;
        }

        const data = await res.json();
        if (Array.isArray(data.results)) {
          for (const movie of data.results) {
            if (movie && movie.id) {
              movieIds.add(movie.id);
              if (movieIds.size >= count) break;
            }
          }
        }
        success = true;
        break;
      } catch (error) {
        if (attempt === 2) {
          console.warn(`[SSG] Error fetching popular movies page ${page}:`, error.message);
        } else {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }

    if (!success) break;
    if (movieIds.size >= count) break;
  }

  console.log(`[SSG] Successfully gathered ${movieIds.size} popular movie IDs from TMDB.`);
  return Array.from(movieIds);
};

/**
 * Fetches top popular movie routes for vite-react-ssg.
 * @param {number} count Number of movie routes to generate
 * @returns {Promise<string[]>} Array of route strings like ['/movie/123', ...]
 */
export const fetchPopularMovieRoutes = async (count = 100) => {
  const ids = await fetchPopularMovieIds(count);
  return ids.map((id) => `/movie/${id}`);
};
