import React from 'react';
import { Link } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import GenreLinks from '../components/GenreLinks';
import PopularLinks from '../components/PopularLinks';
import SiteFooter from '../components/SiteFooter';
import { SITE_NAME } from '../lib/seo';

/**
 * Real 404 page. The previous catch-all rendered the home page, which created
 * soft-404 duplicate content for every unknown URL.
 */
const NotFound = () => (
  <main className="not-found">
    <Head>
      <title>Page not found - {SITE_NAME}</title>
      <meta name="robots" content="noindex, follow" />
    </Head>

    <div className="pattern" />

    <div className="wrapper">
      <header className="not-found-header">
        <p className="section-eyebrow">404</p>
        <h1>We couldn&apos;t find that page</h1>
        <p className="not-found-text">
          The link may be broken, or the movie may no longer be listed. Start again from the{' '}
          <Link to="/">movie discovery page</Link>, or jump straight into a genre below.
        </p>
      </header>

      <div className="link-dropdowns">
        <GenreLinks title="Popular genres" />
        <PopularLinks limit={36} title="Popular movie pages" />
      </div>
    </div>

    <SiteFooter />
  </main>
);

export default NotFound;
