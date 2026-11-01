/**
 * Centralized outbound provider links.
 *
 * These third-party streaming/download destinations are product configuration,
 * not business logic. Keeping them in one module makes them easy to review,
 * swap, or disable (return an empty array) without touching UI components.
 */
export const WATCH_PROVIDER_HOSTS = [
  'cinespot.org',
  'doomflix.org',
  'guideflix.org',
  'indexflix.org',
  'streamiloo.org',
  'streamzy.org',
];

export const DOWNLOAD_PROVIDER_HOST = 'vidvault.ru';

export const getWatchProviderUrls = (movieId) => {
  if (movieId === undefined || movieId === null) return [];
  return WATCH_PROVIDER_HOSTS.map((host) => `https://${host}/movie/${movieId}`);
};

export const getDownloadProviderUrl = (movieId) => {
  if (movieId === undefined || movieId === null) return null;
  return `https://${DOWNLOAD_PROVIDER_HOST}/movie/${movieId}`;
};

/**
 * Opens an external destination in a new tab. Returns true when the browser
 * accepted the navigation (popup blocked otherwise).
 */
export const openExternalUrl = (url) => {
  if (!url || typeof window === 'undefined') return false;
  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(openedWindow);
};
