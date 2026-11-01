const DEFAULT_SITE_URL = 'https://filmpoint.vercel.app';

export const SITE_NAME = 'Film Point';

export const SITE_URL = String(import.meta.env?.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

export const SITE_TITLE = 'Film Point | Discover Trending & Popular Movies';

export const SITE_DESCRIPTION =
  'Explore top trending movies, discover new releases, read detailed synopses, and build your personal watchlist on Film Point.';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/title.png`;

export const absoluteUrl = (path = '/') => {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const truncateText = (text, maxLength = 155) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

/**
 * Builds a title tag with the primary keyword first and keeps it inside the
 * ~60 character limit Google typically renders.
 */
export const buildTitle = (primary, { suffix = SITE_NAME, maxLength = 60 } = {}) => {
  const base = String(primary || '').replace(/\s+/g, ' ').trim();
  if (!base) return suffix;

  const withSuffix = `${base} - ${suffix}`;
  if (withSuffix.length <= maxLength) return withSuffix;

  const maxBaseLength = maxLength - suffix.length - 3;
  if (base.length <= maxBaseLength) return `${base} - ${suffix}`;

  return `${base.slice(0, Math.max(maxBaseLength - 3, 12)).trimEnd()}...`;
};

export const buildMovieTitle = (movie) => {
  const year = movie?.release_date ? movie.release_date.split('-')[0] : null;
  const primary = year ? `${movie.title} (${year})` : movie?.title || 'Movie';
  return buildTitle(primary);
};

export const buildGenreTitle = (genre) => buildTitle(`Best ${genre.name} Movies`);

export const buildGenreDescription = (genre) =>
  truncateText(
    `The best ${genre.name.toLowerCase()} movies to watch right now, ranked by popularity. ${genre.blurb} See ratings, release years and full movie details.`,
    155
  );

export const buildMoviePath = (movieId) => `/movie/${movieId}`;

export const buildGenrePath = (slug) => `/genre/${slug}`;

