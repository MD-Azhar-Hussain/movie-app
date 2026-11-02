import React from 'react';
import { Link } from 'react-router-dom';
import { getPosterImageSource } from '../lib/poster';

/**
 * The poster + title + rating grid used by the genre hubs and the collection
 * pages ("Best movies of 2024", "Top rated").
 *
 * Extracted so every list page renders identical, crawlable markup: a real
 * <ul> of <a> elements (no JavaScript needed), with fixed width/height on the
 * images so the grid cannot shift while posters load.
 */
const MovieLinkGrid = ({ movies, heading, headingId, limit = 20 }) => {
  const items = (Array.isArray(movies) ? movies : []).filter((movie) => movie && movie.id).slice(0, limit);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      {heading ? (
        <h2 id={headingId} className="genre-section-title">
          {heading}
        </h2>
      ) : null}
      <ul className="genre-movie-grid">
        {items.map((movie) => {
          const rating = typeof movie.vote_average === 'number' && movie.vote_average > 0
            ? movie.vote_average.toFixed(1)
            : null;
          const year = movie.release_date ? movie.release_date.slice(0, 4) : null;
          const title = movie.title || 'Untitled movie';

          return (
            <li key={movie.id}>
              <Link to={`/movie/${movie.id}`}>
                <img
                  src={getPosterImageSource(movie.poster_path, 'w342')}
                  alt={`${title} poster`}
                  width="342"
                  height="513"
                  loading="lazy"
                  decoding="async"
                />
                <span className="genre-movie-title">{title}</span>
                <span className="genre-movie-meta">
                  {year || 'N/A'}
                  {rating ? ` · ⭐ ${rating}` : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default MovieLinkGrid;
