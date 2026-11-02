import React from 'react';
import { Link } from 'react-router-dom';
import CollectionLinks from '../components/CollectionLinks';
import GenreLinks from '../components/GenreLinks';
import JsonLd from '../components/JsonLd';
import SeoHead from '../components/SeoHead';
import SiteFooter from '../components/SiteFooter';
import { GENRES_INDEX_PATH, TOP_RATED_PATH } from '../lib/collections';
import { GENRES } from '../lib/genres';
import { breadcrumbListSchema, collectionPageSchema, graph } from '../lib/schema';
import { SITE_NAME, absoluteUrl } from '../lib/seo';

const TITLE = `Browse Movies by Genre - ${SITE_NAME}`;
const DESCRIPTION =
  'Every Film Point genre hub in one place: action, comedy, horror, romance, science fiction, thriller and more, each ranked by current popularity.';
const HEADING = 'Browse Movies by Genre';

/**
 * Genre index: a single crawl hub that links all 19 topical pages.
 *
 * Genre hubs previously had no parent page, so a crawler could only reach them
 * through the collapsed footer dropdown. This page gives them a real parent,
 * a descriptive intro and an ItemList of every hub.
 */
const GenresIndexPage = () => {
  const structuredData = graph(
    collectionPageSchema({
      name: HEADING,
      description: DESCRIPTION,
      path: GENRES_INDEX_PATH,
    }),
    {
      '@type': 'ItemList',
      name: 'Movie genres',
      numberOfItems: GENRES.length,
      itemListElement: GENRES.map((genre, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `Best ${genre.name} movies`,
        url: absoluteUrl(`/genre/${genre.slug}`),
        description: genre.blurb,
      })),
    },
    breadcrumbListSchema([
      { name: 'Home', path: '/' },
      { name: HEADING, path: GENRES_INDEX_PATH },
    ])
  );

  return (
    <main className="genre-page">
      <SeoHead
        title={TITLE}
        description={DESCRIPTION}
        canonicalPath={GENRES_INDEX_PATH}
      />

      <JsonLd data={structuredData} />

      <div className="pattern" />

      <div className="wrapper">
        <nav aria-label="Breadcrumb" className="genre-breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>Genres</span>
        </nav>

        <header className="genre-header">
          <p className="section-eyebrow">Genre index</p>
          <h1>{HEADING}</h1>
          <p className="genre-intro">
            Genre is the fastest way to narrow a movie night: pick the mood first, then choose a
            title. Each hub below ranks its genre by current popularity, so the list reflects what
            people are watching now rather than a decade-old critics&apos; poll.
          </p>
          <p className="genre-answer">
            There are {GENRES.length} genre hubs covering everything from action to western. If you
            would rather start from quality than mood, see the{' '}
            <Link to={TOP_RATED_PATH}>top rated movies of all time</Link>.
          </p>
        </header>

        <GenreLinks title={`All ${GENRES.length} movie genres`} variant="grid" />

        <CollectionLinks title="Browse by release year and decade" />
      </div>

      <SiteFooter />
    </main>
  );
};

export default GenresIndexPage;
