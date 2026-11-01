import React from 'react';
import { SITE_URL } from '../lib/seo';

/**
 * BreadcrumbList structured data for movie pages so search results can show
 * "filmpoint.vercel.app › Movies › <title>" instead of a raw URL.
 */
const BreadcrumbSchema = ({ movie }) => {
  if (!movie?.id || !movie?.title) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: movie.title,
        item: `${SITE_URL}/movie/${movie.id}`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default BreadcrumbSchema;
