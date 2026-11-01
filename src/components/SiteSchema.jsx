import React from 'react';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/seo';

/**
 * Site-wide structured data (WebSite + Organization).
 * Includes the SearchAction so Google can offer a sitelinks search box.
 */
const SiteSchema = () => {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: 'FilmPoint',
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/title.png`,
      description: SITE_DESCRIPTION,
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default SiteSchema;
