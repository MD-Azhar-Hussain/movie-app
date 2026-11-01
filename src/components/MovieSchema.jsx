import React from 'react';
import { absoluteUrl, SITE_NAME, truncateText } from '../lib/seo';
import { getPosterImageSource } from '../lib/poster';

/**
 * Movie structured data (schema.org) for rich results.
 * @see https://developers.google.com/search/docs/appearance/structured-data/movie-carousel
 */
const MovieSchema = ({ movie }) => {
  if (!movie || !movie.title) return null;

  const posterUrl = movie.poster_path
    ? getPosterImageSource(movie.poster_path, 'w780')
    : undefined;

  const cast = Array.isArray(movie.credits?.cast)
    ? movie.credits.cast.slice(0, 10).map((actor) => ({
        '@type': 'Person',
        name: actor.name,
        ...(actor.profile_path
          ? { image: `https://image.tmdb.org/t/p/w185${actor.profile_path}` }
          : {}),
      }))
    : [];

  const directors = Array.isArray(movie.credits?.crew)
    ? movie.credits.crew
        .filter((member) => member.job === 'Director')
        .map((member) => ({ '@type': 'Person', name: member.name }))
    : [];

  const trailer = Array.isArray(movie.videos?.results)
    ? movie.videos.results.find((video) => video.site === 'YouTube' && video.type === 'Trailer')
    : null;

  // Google requires name, description, thumbnailUrl and uploadDate on a
  // VideoObject before it can be used for video rich results, so the trailer is
  // only emitted when we can supply all four.
  const trailerUploadDate = trailer?.published_at || movie.release_date || null;
  const trailerVideo = trailer && trailerUploadDate
    ? {
        '@type': 'VideoObject',
        name: trailer.name || `${movie.title} trailer`,
        description: truncateText(
          movie.overview || `${movie.title} official trailer.`,
          300
        ),
        thumbnailUrl: [`https://i.ytimg.com/vi/${trailer.key}/hqdefault.jpg`],
        uploadDate: trailerUploadDate,
        embedUrl: `https://www.youtube.com/embed/${trailer.key}`,
        contentUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
      }
    : null;

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    url: absoluteUrl(`/movie/${movie.id}`),
    ...(movie.release_date ? { datePublished: movie.release_date } : {}),
    ...(movie.overview ? { description: movie.overview } : {}),
    ...(posterUrl ? { image: posterUrl } : {}),
    ...(posterUrl ? { thumbnailUrl: posterUrl } : {}),
    ...(movie.runtime ? { duration: `PT${movie.runtime}M` } : {}),
    ...(movie.original_language ? { inLanguage: movie.original_language } : {}),
    ...(movie.genres?.length
      ? { genre: movie.genres.map((genre) => (typeof genre === 'string' ? genre : genre.name)).filter(Boolean) }
      : {}),
    ...(cast.length ? { actor: cast } : {}),
    ...(directors.length ? { director: directors } : {}),
    ...(trailerVideo ? { trailer: trailerVideo } : {}),
    ...(movie.production_companies?.length
      ? {
          productionCompany: movie.production_companies.slice(0, 5).map((company) => ({
            '@type': 'Organization',
            name: company.name,
          })),
        }
      : {}),
    ...(movie.vote_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number((movie.vote_average || 0).toFixed(1)),
            bestRating: 10,
            worstRating: 1,
            ratingCount: movie.vote_count,
          },
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: absoluteUrl('/'),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};

export default MovieSchema;

