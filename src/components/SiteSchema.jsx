import React from 'react';
import { graph, organizationSchema, websiteSchema } from '../lib/schema';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/seo';

/**
 * Site-wide structured data (WebSite + Organization) in a single @graph.
 *
 * The SearchAction lets Google offer a sitelinks search box, and the shared
 * `@id`s are what page-level nodes reference through `isPartOf` and `publisher`.
 */
const SiteSchema = () => {
  const url = `${SITE_URL}/`;
  const logo = `${SITE_URL}/title.png`;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(
          graph(
            websiteSchema({ name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION }),
            organizationSchema({
              name: SITE_NAME,
              url,
              description: SITE_DESCRIPTION,
              logo,
            })
          )
        ).replace(/</g, '\\u003c'),
      }}
    />
  );
};

export default SiteSchema;

