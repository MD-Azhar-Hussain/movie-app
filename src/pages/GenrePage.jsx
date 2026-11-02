import React from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import CollectionLinks from '../components/CollectionLinks';
import GenreLinks from '../components/GenreLinks';
import JsonLd from '../components/JsonLd';
import MovieLinkGrid from '../components/MovieLinkGrid';
import SeoHead from '../components/SeoHead';
import SiteFooter from '../components/SiteFooter';
import { GENRES_INDEX_PATH, TOP_RATED_PATH } from '../lib/collections';
import { GENRES, getGenreBySlug } from '../lib/genres';
import { getPosterImageSource } from '../lib/poster';
import {
  breadcrumbListSchema,
  collectionPageSchema,
  graph,
  itemListSchema,
} from '../lib/schema';
import {
  buildGenreDescription,
  buildGenrePath,
  buildGenreTitle,
  ROBOTS_NOINDEX,
  SITE_NAME,
} from '../lib/seo';

const formatRating = (value) =>
  typeof value === 'number' && value > 0 ? value.toFixed(1) : null;

const GenrePage = () => {
  const { slug } = useParams();
  const data = useLoaderData();
  const genre = getGenreBySlug(slug);

  if (!genre) {
    return (
      <main className="not-found">
        <SeoHead
          title={`Genre not found - ${SITE_NAME}`}
          description="This genre hub does not exist. Browse every movie genre instead."
          canonicalPath={GENRES_INDEX_PATH}
          robots={ROBOTS_NOINDEX}
        />
        <div className="wrapper">
          <h1>Genre not found</h1>
          <p>
            <Link to={GENRES_INDEX_PATH}>Browse all movie genres</Link>
          </p>
        </div>
      </main>
    );
  }

  const movies = Array.isArray(data?.results)
    ? data.results.filter((movie) => movie && movie.id)
    : [];
  const topPick = movies[0];
  const canonicalPath = buildGenrePath(genre.slug);
  const pageTitle = buildGenreTitle(genre);
  const pageDescription = buildGenreDescription(genre);
  const topPickYear = topPick?.release_date ? topPick.release_date.slice(0, 4) : null;
  const topPickRating = formatRating(topPick?.vote_average);
  const topPickImage = topPick?.poster_path
    ? getPosterImageSource(topPick.poster_path, 'w500')
    : undefined;

  const structuredData = graph(
    collectionPageSchema({
      name: pageTitle,
      description: pageDescription,
      path: canonicalPath,
      movies,
    }),
    movies.length
      ? itemListSchema(movies, { name: `Best ${genre.name} movies`, path: canonicalPath })
      : null,
    breadcrumbListSchema([
      { name: 'Home', path: '/' },
      { name: 'Genres', path: GENRES_INDEX_PATH },
      { name: `${genre.name} movies`, path: canonicalPath },
    ])
  );

  return (
    <main className="genre-page">
      <SeoHead
        title={pageTitle}
        description={pageDescription}
        canonicalPath={canonicalPath}
        image={topPickImage}
        imageAlt={
          topPickImage ? `Best ${genre.name} movies — top pick: ${topPick.title}` : undefined
        }
      />

      <JsonLd data={structuredData} />

      <div className="pattern" />

      <div className="wrapper">
        <nav aria-label="Breadcrumb" className="genre-breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <Link to={GENRES_INDEX_PATH}>Genres</Link>
          <span aria-hidden="true">›</span>
          <span>{genre.name}</span>
        </nav>

        <header className="genre-header">
          <p className="section-eyebrow">Genre hub</p>
          <h1>{`Best ${genre.name} Movies to Watch Right Now`}</h1>
          <p className="genre-intro">{genre.intro}</p>

          {topPick && (
            <p className="genre-answer">
              Right now the most popular {genre.name.toLowerCase()} movie on {SITE_NAME} is{' '}
              <Link to={`/movie/${topPick.id}`}>
                <strong>{topPick.title}</strong>
                {topPickYear ? ` (${topPickYear})` : ''}
              </Link>
              {topPickRating ? `, rated ${topPickRating}/10 by TMDB users` : ''}.
            </p>
          )}
        </header>

        {movies.length === 0 ? (
          <div className="data-error">
            <p>
              We could not load {genre.name.toLowerCase()} movies right now. The movie data
              service may be temporarily unavailable.
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
            heading={`${genre.name} movies ranked by popularity`}
            headingId="genre-movies-title"
          />
        )}

        <p className="genre-answer">
          Want a different starting point? Browse{' '}
          <Link to={GENRES_INDEX_PATH}>all {GENRES.length} genre hubs</Link>, the{' '}
          <Link to={TOP_RATED_PATH}>top rated movies of all time</Link>, or the best films of a{' '}
          <Link to="/decade/2020s">decade</Link>.
        </p>

        <div className="link-dropdowns">
          <CollectionLinks title="Browse by release year and decade" />
          <GenreLinks currentSlug={genre.slug} title="Explore other genres" />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
};

export default GenrePage;
