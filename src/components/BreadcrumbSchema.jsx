import React from 'react';
import { breadcrumbListSchema, graph } from '../lib/schema';

/**
 * BreadcrumbList structured data.
 *
 * Pass `items` for an explicit trail (home › genre › movie) or `movie` for the
 * legacy two-level trail. Matching the visible breadcrumb matters: Google warns
 * when the markup and the on-page trail disagree.
 */
const BreadcrumbSchema = ({ items, movie }) => {
  const trail = Array.isArray(items) && items.length > 0
    ? items
    : movie?.id && movie?.title
      ? [
          { name: 'Home', path: '/' },
          { name: movie.title, path: `/movie/${movie.id}` },
        ]
      : null;

  if (!trail) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph(breadcrumbListSchema(trail))).replace(/</g, '\\u003c'),
      }}
    />
  );
};

export default BreadcrumbSchema;

