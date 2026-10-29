/**
 * TMDB Proxy Helper
 *
 * Replaces direct client-side calls to `api.themoviedb.org` with calls to
 * the Vercel Serverless proxy at `/api/tmdb`. Falls back to direct TMDB
 * calls during local development (vite dev server) where the proxy isn't
 * available, unless you configure Vite's dev proxy (see vite.config.js).
 */

const TMDB_BASE = 'https://api.themoviedb.org';

const API_KEY = import.meta.env.VITE_API_KEY;

/**
 * Build headers for a direct TMDB call (local dev fallback).
 */
const directHeaders = {
  accept: 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

/**
 * Fetch from TMDB through the serverless proxy.
 *
 * @param {string} tmdbUrl  Full TMDB URL, e.g. "https://api.themoviedb.org/3/movie/popular?page=1"
 * @param {RequestInit} [options]  Extra fetch options (signal, etc.)
 * @returns {Promise<Response>}
 */
export async function tmdbFetch(tmdbUrl, options = {}) {
  // Parse the original TMDB URL
  const url = new URL(tmdbUrl);
  const tmdbPath = url.pathname; // e.g. "/3/movie/popular"

  // Build the proxy URL: /api/tmdb?path=/3/movie/popular&page=1&...
  const proxyParams = new URLSearchParams(url.searchParams);
  proxyParams.set('path', tmdbPath);
  const proxyUrl = `/api/tmdb?${proxyParams}`;

  try {
    const response = await fetch(proxyUrl, {
      ...options,
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // If proxy returns successfully, use it
    if (response.ok || response.status === 404 || response.status === 429) {
      return response;
    }

    // If the proxy itself is broken (5xx), fall back to direct call
    throw new Error(`Proxy returned ${response.status}`);
  } catch (proxyError) {
    // Fallback: call TMDB directly (works when there's no firewall or during local dev)
    console.warn('[tmdbFetch] Proxy unavailable, falling back to direct TMDB call:', proxyError.message);
    return fetch(tmdbUrl, {
      ...options,
      method: 'GET',
      headers: directHeaders,
    });
  }
}
