import React from 'react';

const MovieSchema = ({ movie }) => {
  if (!movie || !movie.title) return null;

  const posterUrl = movie.poster_path
    ? (movie.poster_path.startsWith('http')
        ? movie.poster_path
        : `https://image.tmdb.org/t/p/w500${movie.poster_path}`)
    : undefined;

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    ...(movie.release_date ? { datePublished: movie.release_date } : {}),
    ...(movie.overview ? { description: movie.overview } : {}),
    ...(posterUrl ? { image: posterUrl } : {}),
    ...(movie.runtime ? { duration: `PT${movie.runtime}M` } : {}),
    ...(movie.genres?.length
      ? { genre: movie.genres.map((g) => (typeof g === 'string' ? g : g.name)).filter(Boolean) }
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};

export default MovieSchema;
