import React from 'react';
import { Link } from 'react-router-dom';
import { GENRES } from '../lib/genres';

/**
 * Cross-links between genre hub pages.
 *
 * `variant="dropdown"` (default) renders a native <details> disclosure used on
 * the home page and movie pages. `variant="grid"` renders the descriptive card
 * grid used on genre hub pages. Links stay in the served HTML either way, so
 * crawlers always have a short path between the 19 topical hubs.
 */
const GenreLinks = ({ currentSlug = null, title = 'Browse by genre', variant = 'dropdown' }) => {
  const genres = GENRES.filter((genre) => genre.slug !== currentSlug);
  if (genres.length === 0) return null;

  if (variant === 'grid') {
    return (
      <section className="genre-links genre-links-grid" aria-labelledby="genre-links-grid-title">
        <h2 id="genre-links-grid-title" className="genre-links-title">
          {title}
        </h2>
        <ul>
          {genres.map((genre) => (
            <li key={genre.slug}>
              <Link to={`/genre/${genre.slug}`}>
                <strong>Best {genre.name} movies</strong>
                <span>{genre.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <details className="link-dropdown">
      <summary className="link-dropdown-summary">
        <span className="link-dropdown-copy">
          <span className="link-dropdown-eyebrow">Topical hubs</span>
          <h2 className="link-dropdown-title">{title}</h2>
        </span>
        <span className="link-dropdown-count">{genres.length} genres</span>
        <span className="link-dropdown-chevron" aria-hidden="true" />
      </summary>

      <div className="link-dropdown-body">
        <nav aria-label={title}>
          <ul className="link-grid link-grid-genres">
            {genres.map((genre) => (
              <li key={genre.slug}>
                <Link to={`/genre/${genre.slug}`}>Best {genre.name} movies</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </details>
  );
};

export default GenreLinks;

