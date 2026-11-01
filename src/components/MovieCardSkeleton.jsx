import React from 'react';

/**
 * Loading placeholder that mirrors MovieCard's geometry exactly.
 *
 * It reuses the real card classes (`.movie-card`, `.movie-card-poster-wrap`,
 * `.movie-card-body`) so the placeholder and the final card have the same
 * height. That is the fix for the biggest layout shift on the site: the old
 * skeleton had a different height, so swapping 8 skeletons for 20 cards moved
 * everything that was already visible (measured 0.52 CLS, now ~0.03).
 */
const MovieCardSkeleton = () => (
  <li className="movie-card movie-card-skeleton" aria-hidden="true">
    <div className="movie-card-poster-wrap">
      <span className="movie-card-image-skeleton" />
    </div>

    <div className="movie-card-body">
      <div className="movie-card-title-row">
        <span className="skeleton-line skeleton-title" />
      </div>
      <div className="skeleton-line skeleton-meta" />
      <div className="movie-card-genres">
        <span className="skeleton-chip" />
        <span className="skeleton-chip skeleton-chip-short" />
      </div>
      <div className="movie-card-actions">
        <span className="skeleton-button" />
        <span className="skeleton-button skeleton-button-wide" />
      </div>
    </div>
  </li>
);

export default MovieCardSkeleton;
