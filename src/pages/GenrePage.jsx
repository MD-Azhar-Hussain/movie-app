import React from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import GenreLinks from '../components/GenreLinks';
import SiteFooter from '../components/SiteFooter';
import { getGenreBySlug } from '../lib/genres';
import { getPosterImageSource } from '../lib/poster';
import {
  absoluteUrl,
  buildGenreDescription,
  buildGenrePath,
  buildGenreTitle,
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
        <Head>
          <title>Genre not found - {SITE_NAME}</title>
          <meta name="robots" content="noindex, follow" />
        </Head>
        <div className="wrapper">
          <h1>Genre not found</h1>
          <p>
            <Link to="/">Back to Film Point</Link>
          </p>
        </div>
      </main>
    );
  }

  const movies = Array.isArray(data?.results) ? data.results.filter((movie) => movie && movie.id) : [];
  const topPick = movies[0];
  const canonicalUrl = absoluteUrl(buildGenrePath(genre.slug));
  const pageTitle = buildGenreTitle(genre);
  const pageDescription = buildGenreDescription(genre);
  const topPickYear = topPick?.release_date ? topPick.release_date.slice(0, 4) : null;
  const topPickRating = formatRating(topPick?.vote_average);

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      inLanguage: 'en',
      about: { '@type': 'Thing', name: `${genre.name} films` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Best ${genre.name} movies`,
      numberOfItems: movies.length,
      itemListElement: movies.slice(0, 20).map((movie, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(`/movie/${movie.id}`),
        name: movie.title,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: `${genre.name} movies`, item: canonicalUrl },
      ],
    },
  ];

  return (
    <main className="genre-page">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
        <meta name="robots" content="index, follow, max-image-preview:large" />

        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
      </Head>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="pattern" />

      <div className="wrapper">
        <nav aria-label="Breadcrumb" className="genre-breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>{genre.name} movies</span>
        </nav>

        <header className="genre-header">
          <p className="section-eyebrow">Genre hub</p>
          <h1>Best {genre.name} Movies to Watch Right Now</h1>
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
              We could not load {genre.name.toLowerCase()} movies right now. The movie data service may be
              temporarily unavailable.
            </p>
            <div className="data-error-actions">
              <button type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
              <Link to="/">Back to discovery</Link>
            </div>
          </div>
        ) : (
          <section aria-labelledby="genre-movies-title">
            <h2 id="genre-movies-title" className="genre-section-title">
              {genre.name} movies ranked by popularity
            </h2>
            <ul className="genre-movie-grid">
              {movies.slice(0, 20).map((movie) => {
                const rating = formatRating(movie.vote_average);
                const year = movie.release_date ? movie.release_date.slice(0, 4) : null;

                return (
                  <li key={movie.id}>
                    <Link to={`/movie/${movie.id}`}>
                      <img
                        src={getPosterImageSource(movie.poster_path, 'w342')}
                        alt={`${movie.title} poster`}
                        width="342"
                        height="513"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="genre-movie-title">{movie.title}</span>
                      <span className="genre-movie-meta">
                        {year || 'N/A'}
                        {rating ? ` · ⭐ ${rating}` : ''}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <GenreLinks currentSlug={genre.slug} title="Explore other genres" variant="grid" />
      </div>

      <SiteFooter />
    </main>
  );
};

export default GenrePage;

