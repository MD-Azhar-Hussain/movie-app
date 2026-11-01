const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const PLACEHOLDER_POSTER = '/no-movie.png';

const isUsableValue = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return Boolean(normalized) && normalized !== 'null' && normalized !== 'undefined';
};

const isAbsoluteUrl = (value) => value.startsWith('http://') || value.startsWith('https://');

/**
 * Normalizes a TMDB poster value into a usable image URL.
 * Accepts either a bare `poster_path` ("/abc.jpg") or an already absolute URL.
 */
export const getPosterImageSource = (posterValue, size = 'w500') => {
  if (!isUsableValue(posterValue)) return PLACEHOLDER_POSTER;

  const normalized = posterValue.trim();

  if (isAbsoluteUrl(normalized)) {
    if (normalized.includes('/w500null') || normalized.includes('/w500undefined')) {
      return PLACEHOLDER_POSTER;
    }
    return normalized;
  }

  return `${TMDB_IMAGE_BASE}/${size}${normalized}`;
};

export const getBackdropImageSource = (backdropValue, size = 'original') => {
  if (!isUsableValue(backdropValue)) return null;

  const normalized = backdropValue.trim();
  if (isAbsoluteUrl(normalized)) return normalized;

  return `${TMDB_IMAGE_BASE}/${size}${normalized}`;
};

/**
 * Responsive candidates for movie cards so phones download ~half the pixels.
 */
export const getPosterSrcSet = (posterValue) => {
  if (!isUsableValue(posterValue) || isAbsoluteUrl(posterValue.trim())) return undefined;

  const normalized = posterValue.trim();
  return [
    `${TMDB_IMAGE_BASE}/w185${normalized} 185w`,
    `${TMDB_IMAGE_BASE}/w342${normalized} 342w`,
    `${TMDB_IMAGE_BASE}/w500${normalized} 500w`,
  ].join(', ');
};

export const getProfileImageSource = (profilePath, size = 'w185') => {
  if (!isUsableValue(profilePath)) return null;
  const normalized = profilePath.trim();
  return isAbsoluteUrl(normalized) ? normalized : `${TMDB_IMAGE_BASE}/${size}${normalized}`;
};
