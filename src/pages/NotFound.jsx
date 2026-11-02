import React from 'react';
import { Link } from 'react-router-dom';
import CollectionLinks from '../components/CollectionLinks';
import GenreLinks from '../components/GenreLinks';
import PopularLinks from '../components/PopularLinks';
import SeoHead from '../components/SeoHead';
import SiteFooter from '../components/SiteFooter';
import { GENRES_INDEX_PATH } from '../lib/collections';
import { ROBOTS_NOINDEX, SITE_NAME } from '../lib/seo';

/**
 * Real 404 page. The previous catch-all rendered the home page, which created
 * soft-404 duplicate content for every unknown URL.
 *
 * It still offers real navigation (genre hubs, curated lists, popular movie
 * pages) so a visitor who lands here has somewhere useful to go.
 */
const NotFound = () => (
  <main className="not-found">
    <SeoHead
      title={`Page not found - ${SITE_NAME}`}
      description="This page does not exist. Browse movie genres, release years and popular film pages on Film Point instead."
      canonicalPath="/404"
      robots={ROBOTS_NOINDEX}
    />

    <div className="pattern" />

    <div className="wrapper">
      <header className="not-found-header">
        <p className="section-eyebrow">404</p>
        <h1>We couldn&apos;t find that page</h1>
        <p className="not-found-text">
          The link may be broken, or the movie may no longer be listed. Start again from the{' '}
          <Link to="/">movie discovery page</Link>, browse{' '}
          <Link to={GENRES_INDEX_PATH}>every movie genre</Link>, or jump straight into a list
          below.
        </p>
      </header>

      <div className="link-dropdowns">
        <GenreLinks title="Popular genres" />
        <CollectionLinks title="Curated movie lists" />
        <PopularLinks limit={36} title="Popular movie pages" />
      </div>
    </div>

    <SiteFooter />
  </main>
);

export default NotFound;

