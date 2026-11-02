import React from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import CollectionLinks from '../components/CollectionLinks';
import GenreLinks from '../components/GenreLinks';
import JsonLd from '../components/JsonLd';
import MovieLinkGrid from '../components/MovieLinkGrid';
import SeoHead from '../components/SeoHead';
import SiteFooter from '../components/SiteFooter';
import { COLLECTIONS, getCollectionFromParams, TOP_RATED_PATH } from '../lib/collections';
import { getPosterImageSource } from '../lib/poster';
import {
  breadcrumbListSchema,
  collectionPageSchema,
  graph,
  itemListSchema,
} from '../lib/schema';
import { ROBOTS_NOINDEX, SITE_NAME } from '../lib/seo';

const formatRating = (value) =>
  typeof value === 'number' && value > 0 ? value.toFixed(1) : null;

/**
 * Shared template for the curated list pages:
 *
 *   /top-rated          top rated movies of all time
 *   /year/2024          best movies of a release year
 *   /decade/1990s       best movies of a decade
 *
 * All three pull from a TMDB discover query resolved by `getCollectionFromParams`,
 * which the sitemap and llms.txt read too — so the copy, the canonical URL and
 * the indexed data cannot drift apart.
 */
const CollectionPage = () => {
  const params = useParams();
  const data = useLoaderData();
  const collection = getCollectionFromParams(params);

  if (!collection) {
    return (
      <main className="not-found">
        <SeoHead
          title={`List not found - ${SITE_NAME}`}
          description="This movie list does not exist. Browse the genre hubs, release years and top rated films instead."
          canonicalPath="/top-rated"
          robots={ROBOTS_NOINDEX}
        />
        <div className="wrapper">
          <h1>List not found</h1>
          <p>
            <Link to="/">Back to {SITE_NAME}</Link>
          </p>
        </div>
      </main>
    );
  }

  const movies = Array.isArray(data?.results)
    ? data.results.filter((movie) => movie && movie.id && movie.title)
    : [];
  const topPick = movies[0];
  const topPickRating = formatRating(topPick?.vote_average);
  const topPickYear = topPick?.release_date ? topPick.release_date.slice(0, 4) : null;
  const topPickImage = topPick?.poster_path
    ? getPosterImageSource(topPick.poster_path, 'w500')
    : undefined;

  const siblings = COLLECTIONS.filter(
    (item) => item.kind === collection.kind && item.path !== collection.path
  );

  const quickAnswer = topPick
    ? `The most popular title on this list is ${topPick.title}${
        topPickYear ? ` (${topPickYear})` : ''
      }${topPickRating ? `, rated ${topPickRating}/10 by TMDB users` : ''}.`
    : null;

  const structuredData = graph(
    collectionPageSchema({
      name: collection.heading,
      description: collection.description,
      path: collection.path,
      movies,
    }),
    movies.length
      ? itemListSchema(movies, { name: collection.heading, path: collection.path })
      : null,
    breadcrumbListSchema([
      { name: 'Home', path: '/' },
      { name: collection.heading, path: collection.path },
    ])
  );

  return (
    <main className="genre-page">
      <SeoHead
        title={collection.title}
        description={collection.description}
        canonicalPath={collection.path}
        image={topPickImage}
        imageAlt={
          topPickImage ? `${collection.heading} — most popular pick: ${topPick.title}` : undefined
        }
      />

      <JsonLd data={structuredData} />

      <div className="pattern" />

      <div className="wrapper">
        <nav aria-label="Breadcrumb" className="genre-breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>{collection.heading}</span>
        </nav>

        <header className="genre-header">
          <p className="section-eyebrow">
            {collection.kind === 'top-rated'
              ? 'Highest rated'
              : collection.kind === 'decade'
                ? 'Decade in review'
                : 'Year in review'}
          </p>
          <h1>{collection.heading}</h1>
          <p className="genre-intro">{collection.intro}</p>

          {quickAnswer && (
            <p className="genre-answer">
              {quickAnswer}{' '}
              {topPick ? (
                <Link to={`/movie/${topPick.id}`}>Open the full {topPick.title} page</Link>
              ) : null}
            </p>
          )}
        </header>

        {movies.length === 0 ? (
          <div className="data-error">
            <p>
              We could not load this list right now. The movie data service may be temporarily
              unavailable.
            </p>
            <div className="data-error-actions">
              <button type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
              <Link to="/">Back to discovery</Link>
            </div>
          </div>
        ) : (
          <MovieLinkGrid
            movies={movies}
            heading={`${collection.heading} ranked by popularity`}
            headingId="collection-movies-title"
          />
        )}

        {siblings.length > 0 && (
          <section aria-labelledby="sibling-lists-title">
            <h2 id="sibling-lists-title" className="genre-section-title">
              More movie lists
            </h2>
            <ul className="link-grid">
              {siblings.map((sibling) => (
                <li key={sibling.path}>
                  <Link to={sibling.path}>{sibling.heading}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="link-dropdowns">
          <CollectionLinks currentPath={collection.path} title="Browse every curated list" />
          <GenreLinks title="Browse by genre" />
        </div>

        {collection.path !== TOP_RATED_PATH && (
          <p className="genre-answer">
            Looking for the highest scores rather than the most popular? Start with the{' '}
            <Link to={TOP_RATED_PATH}>top rated movies of all time</Link>.
          </p>
        )}
      </div>

      <SiteFooter />
    </main>
  );
};

export default CollectionPage;
