import React from 'react';
import { absoluteUrl } from '../lib/seo';

/**
 * Schema.org builders shared by every page and by the JSON-LD components.
 *
 * Keeping them in one module means the WebSite/Organization nodes always carry
 * the same `@id`s, so `isPartOf`, `publisher` and `mainEntityOfPage` references
 * resolve instead of duplicating disconnected objects (a common cause of
 * "structured data could not be validated" warnings).
 */

export const WEBSITE_ID = `${absoluteUrl('/')}#website`;

export const ORGANIZATION_ID = `${absoluteUrl('/')}#organization`;

export const COLLECTION_ID = (path) => `${absoluteUrl(path)}#collection`;

export const breadcrumbListSchema = (items) => ({
  '@type': 'BreadcrumbList',
  '@id': `${absoluteUrl('/')}#breadcrumb`,
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

/**
 * ItemList where each entry wraps a full Movie object. Google can read the
 * nested type for carousel and list rich results; bare URLs cannot be.
 */
export const itemListSchema = (movies, { name, path, limit = 20 }) => ({
  '@type': 'ItemList',
  '@id': `${absoluteUrl(path)}#itemlist`,
  name,
  numberOfItems: movies.length,
  itemListOrder: 'https://schema.org/ItemListOrderDescending',
  itemListElement: movies.slice(0, limit).map((movie, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Movie',
      name: movie.title,
      url: absoluteUrl(`/movie/${movie.id}`),
      ...(movie.release_date ? { datePublished: movie.release_date } : {}),
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
    },
  })),
});

export const collectionPageSchema = ({ name, description, path, movies = [] }) => ({
  '@type': 'CollectionPage',
  '@id': COLLECTION_ID(path),
  name,
  description,
  url: absoluteUrl(path),
  inLanguage: 'en',
  isPartOf: { '@id': WEBSITE_ID },
  ...(movies.length
    ? {
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: movies.length,
          itemListElement: movies.slice(0, 20).map((movie, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absoluteUrl(`/movie/${movie.id}`),
            name: movie.title,
          })),
        },
      }
    : {}),
});

export const websiteSchema = ({ name, url, description }) => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name,
  alternateName: 'FilmPoint',
  url,
  description,
  inLanguage: 'en',
  publisher: { '@id': ORGANIZATION_ID },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${url}/?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
});

export const organizationSchema = ({ name, url, description, logo }) => ({
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name,
  url,
  logo: {
    '@type': 'ImageObject',
    url: logo,
    width: 200,
    height: 200,
  },
  description,
});

/** Wraps any nodes into a single `@graph` document with one `@context`. */
export const graph = (...nodes) => ({
  '@context': 'https://schema.org',
  '@graph': nodes.filter(Boolean).flat(),
});
