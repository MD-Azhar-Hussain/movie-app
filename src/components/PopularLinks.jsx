import React from 'react';
import { Link } from 'react-router-dom';
import POPULAR_MOVIES from 'virtual:popular-movies';

/**
 * Crawlable list of internal links to prerendered movie pages, collapsed into a
 * native <details> dropdown.
 *
 * The anchors stay in the server-rendered HTML (crawlers still see them), but
 * the page no longer dumps 120 links on the reader at once. <details> is
 * keyboard accessible and needs no JavaScript, so it works for the prerendered
 * HTML and for the hydrated app alike.
 */
const PopularLinks = ({ limit = 72, title = 'Popular movie pages', description }) => {
  const items = Array.isArray(POPULAR_MOVIES) ? POPULAR_MOVIES.slice(0, limit) : [];
  if (items.length === 0) return null;

  return (
    <details className="link-dropdown">
      <summary className="link-dropdown-summary">
        <span className="link-dropdown-copy">
          <span className="link-dropdown-eyebrow">Browse the catalogue</span>
          <h2 className="link-dropdown-title">{title}</h2>
        </span>
        <span className="link-dropdown-count">{items.length} pages</span>
        <span className="link-dropdown-chevron" aria-hidden="true" />
      </summary>

      <div className="link-dropdown-body">
        {description && <p className="link-dropdown-description">{description}</p>}
        <nav aria-label={title}>
          <ul className="link-grid">
            {items.map((movie) => (
              <li key={movie.id}>
                <Link to={`/movie/${movie.id}`}>
                  {movie.year ? `${movie.title} (${movie.year})` : movie.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </details>
  );
};

export default PopularLinks;

