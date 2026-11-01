import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import MovieSchema from '../components/MovieSchema';
import BreadcrumbSchema from '../components/BreadcrumbSchema';
import FaqSchema from '../components/FaqSchema';
import GenreLinks from '../components/GenreLinks';
import SiteFooter from '../components/SiteFooter';
import Spinner from '../components/Spin';
import { tmdbFetch } from '../api/tmdbProxy';
import { getBackdropImageSource, getPosterImageSource, getProfileImageSource } from '../lib/poster';
import { getGenreSlugById } from '../lib/genres';
import {
  absoluteUrl,
  buildGenrePath,
  buildMoviePath,
  buildMovieTitle,
  SITE_NAME,
  truncateText,
} from '../lib/seo';

import {
  enqueueWatchlistMutation,
  isMovieInWatchlist,
  readStoredWatchlist,
  toggleWatchlistItems,
  writeStoredWatchlist,
} from '../lib/watchlist';
import { getDownloadProviderUrl, getWatchProviderUrls, openExternalUrl } from '../lib/watchLinks';

const MovieDetails = () => {
  const { id } = useParams();
  const initialData = useLoaderData();
  const [movie, setMovie] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef(null);

  // Watchlist status always comes from the shared store used by the home page.
  useEffect(() => {
    if (typeof window === 'undefined' || !movie?.id) return;
    setIsSaved(isMovieInWatchlist(readStoredWatchlist(), movie.id));
  }, [movie?.id]);

  // Client-side fetch fallback when the SSG loader produced no data.
  useEffect(() => {
    if (movie && Number(movie.id) === Number(id)) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchMovieDetails = async () => {
      try {
        const response = await tmdbFetch(
          `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,videos,recommendations`
        );

        if (!response.ok) throw new Error(`Movie not found (HTTP ${response.status})`);

        const contentType = response.headers?.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Received non-JSON response from server');
        }

        const data = await response.json();
        if (isMounted) {
          setMovie(data);
          setLoading(false);
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || 'Unable to load movie details');
          setLoading(false);
        }
      }
    };

    void fetchMovieDetails();

    return () => {
      isMounted = false;
    };
  }, [id, movie]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), 3000);
  }, []);

  const toggleWatchlist = useCallback(() => {
    if (typeof window === 'undefined' || !movie) return;

    const { items, saved, entry } = toggleWatchlistItems(readStoredWatchlist(), movie);
    if (!entry) return;

    writeStoredWatchlist(items);
    setIsSaved(saved);
    showToast(`"${entry.title}" ${saved ? 'added to' : 'removed from'} your watchlist`);

    enqueueWatchlistMutation(
      saved ? { op: 'add', movieId: entry.id, movie: entry } : { op: 'remove', movieId: entry.id }
    );
  }, [movie, showToast]);

  const handleWatchClick = useCallback(() => {
    if (!movie) return;
    const [primaryUrl] = getWatchProviderUrls(movie.id);
    openExternalUrl(primaryUrl);
  }, [movie]);

  if (loading) {
    return (
      <main className="min-h-screen text-white flex flex-col items-center justify-center p-6">
        <Head>
          <title>Loading movie details - {SITE_NAME}</title>
          <meta name="robots" content="noindex, follow" />
        </Head>
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-light-200">Loading film details...</p>
        </div>
      </main>
    );
  }

  if (error || !movie) {
    return (
      <main className="min-h-screen text-white flex flex-col items-center justify-center p-6">
        <Head>
          <title>Movie not found - {SITE_NAME}</title>
          <meta name="robots" content="noindex, follow" />
        </Head>
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Movie Not Available</h1>
          <p className="text-light-200 mb-6">{error || 'Unable to retrieve details for this movie.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold text-white shadow-lg shadow-indigo-500/30 hover:scale-105 transition"
          >
            ← Return to Movies
          </Link>
        </div>
      </main>
    );
  }

  const rawOverview = movie.overview || `Everything you need to know about ${movie.title}: synopsis, cast, ratings and where to watch.`;
  const metaDescription = truncateText(rawOverview);
  const posterUrl = getPosterImageSource(movie.poster_path, 'w500');
  const socialImage = getPosterImageSource(movie.poster_path, 'w780');
  const backdropUrl = getBackdropImageSource(movie.backdrop_path, 'w1280');
  const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
  const rating = typeof movie.vote_average === 'number' && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : 'N/A';
  const pageTitle = buildMovieTitle(movie);
  const canonicalUrl = absoluteUrl(buildMoviePath(movie.id));
  const topCast = movie.credits?.cast?.slice(0, 6) || [];
  const recommendations = (movie.recommendations?.results || [])
    .filter((item) => item?.id && item?.title && Number(item.id) !== Number(movie.id))
    .slice(0, 12);
  const runtimeLabel = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
  const primaryGenre = movie.genres?.[0] || null;
  const primaryGenreSlug = primaryGenre ? getGenreSlugById(primaryGenre.id) : null;

  const directorNames = (movie.credits?.crew || [])
    .filter((member) => member.job === 'Director')
    .map((member) => member.name);

  const topCastNames = (movie.credits?.cast || []).slice(0, 3).map((actor) => actor.name);

  // Direct answer placed within the first ~100 words of the page.
  const genreNames = (movie.genres || []).map((genre) => genre.name.toLowerCase()).slice(0, 3);
  const genrePhrase = genreNames.length > 0
    ? `${/^[aeiou]/.test(genreNames[0]) ? 'an' : 'a'} ${genreNames.join(', ')} film`
    : 'a film';
  const quickAnswer = [
    `${movie.title}${movie.release_date ? ` (${year})` : ''} is ${genrePhrase}`,
    directorNames.length > 0 ? `directed by ${directorNames[0]}` : null,
    movie.runtime ? `that runs ${runtimeLabel}` : null,
    rating !== 'N/A' ? `and holds a ${rating}/10 audience rating on TMDB` : null,
  ].filter(Boolean).join(' ') + '.';

  const quickFacts = [
    { label: 'Director', value: directorNames.length > 0 ? directorNames.join(', ') : 'Not listed' },
    { label: 'Runtime', value: runtimeLabel ? `${runtimeLabel} (${movie.runtime} min)` : 'Not listed' },
    { label: 'Release date', value: movie.release_date || 'Not listed' },
    { label: 'Genres', value: movie.genres?.map((genre) => genre.name).join(', ') || 'Not listed' },
    { label: 'Original language', value: movie.original_language ? movie.original_language.toUpperCase() : 'Not listed' },
    { label: 'Audience rating', value: rating === 'N/A' ? 'Not rated yet' : `${rating}/10 from ${movie.vote_count?.toLocaleString() || 0} votes` },
  ];

  const faqItems = [
    {
      question: `Who directed ${movie.title}?`,
      answer: directorNames.length > 0
        ? `${movie.title} was directed by ${directorNames.join(', ')}.`
        : `TMDB does not list a director for ${movie.title}.`,
    },
    {
      question: `How long is ${movie.title}?`,
      answer: movie.runtime
        ? `${movie.title} runs ${runtimeLabel} (${movie.runtime} minutes).`
        : `The runtime for ${movie.title} is not listed on TMDB.`,
    },
    {
      question: `What is ${movie.title} about?`,
      answer: truncateText(movie.overview || `A synopsis for ${movie.title} is not available yet.`, 240),
    },
    {
      question: `When was ${movie.title} released?`,
      answer: movie.release_date
        ? `${movie.title} was released on ${movie.release_date}.`
        : `The release date for ${movie.title} is not listed.`,
    },
    {
      question: `What genre is ${movie.title}?`,
      answer: movie.genres?.length
        ? `${movie.title} is classified as ${movie.genres.map((genre) => genre.name).join(', ')}.`
        : `Genres for ${movie.title} are not listed.`,
    },
    {
      question: `Who stars in ${movie.title}?`,
      answer: topCastNames.length > 0
        ? `${movie.title} stars ${topCastNames.join(', ')}.`
        : `Cast information for ${movie.title} is not listed.`,
    },
  ];

  return (
    <main className="min-h-screen text-white relative pb-20">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow, max-image-preview:large" />

        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={`${movie.title} poster`} />
        <meta property="og:type" content="video.movie" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="en_US" />
        {movie.release_date && <meta property="video:release_date" content={movie.release_date} />}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={socialImage} />

        <link rel="alternate" hrefLang="en" href={canonicalUrl} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
        <link rel="preload" as="image" href={posterUrl} fetchPriority="high" />
      </Head>

      <MovieSchema movie={movie} />
      <BreadcrumbSchema movie={movie} />
      <FaqSchema items={faqItems} />

      <div className="pattern" />

      {/* Hero backdrop banner */}
      <div
        className="relative w-full h-[320px] sm:h-[460px] bg-cover bg-center overflow-hidden"
        style={backdropUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(3, 0, 20, 0.4) 0%, rgba(3, 0, 20, 0.95) 100%), url(${backdropUrl})`,
            }
          : { background: 'linear-gradient(180deg, #0f0d23 0%, #030014 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <nav aria-label="Breadcrumb" className="movie-breadcrumb">
            <Link to="/" className="movie-breadcrumb-home">
              ← Back to Discover
            </Link>
            <span aria-hidden="true">›</span>
            {primaryGenreSlug ? (
              <Link to={buildGenrePath(primaryGenreSlug)}>{primaryGenre.name} movies</Link>
            ) : (
              <span>Movies</span>
            )}
            <span aria-hidden="true">›</span>
            <span aria-current="page">{movie.title}</span>
          </nav>
        </div>
      </div>


      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-36 sm:-mt-48 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
          {/* Poster column */}
          <div className="w-56 sm:w-72 lg:w-80 flex-shrink-0 mx-auto md:mx-0">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0f0d23] group">
              <img
                src={posterUrl}
                alt={`${movie.title} poster`}
                width="500"
                height="750"
                className="w-full h-auto object-cover aspect-[2/3] transition duration-300 group-hover:scale-105"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <button
                type="button"
                onClick={toggleWatchlist}
                className={`absolute top-3 right-3 p-3 rounded-full backdrop-blur-md border border-white/20 transition ${
                  isSaved ? 'bg-amber-500 text-black' : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                aria-label={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                aria-pressed={isSaved}
              >
                <span className="text-lg leading-none">{isSaved ? '★' : '☆'}</span>
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleWatchClick}
                className="w-full py-3 px-6 rounded-xl font-semibold text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:opacity-95 transition"
              >
                ▶ Watch Stream
              </button>

              <button
                type="button"
                onClick={() => openExternalUrl(getDownloadProviderUrl(movie.id))}
                className="w-full py-3 px-6 rounded-xl font-medium text-center bg-white/10 hover:bg-white/15 border border-white/10 text-white transition"
              >
                ⬇ Download Options
              </button>

              <a
                href={`https://www.themoviedb.org/movie/${movie.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-center text-light-200 hover:text-white transition"
              >
                View on TMDB ↗
              </a>
            </div>
          </div>

          {/* Details column */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-light-200">
              <span className="px-3 py-1 rounded-full bg-white/10 font-semibold text-white">{year}</span>
              {runtimeLabel ? <span>{runtimeLabel}</span> : null}
              {movie.original_language && (
                <span className="uppercase px-2 py-0.5 rounded border border-white/20 text-xs">
                  {movie.original_language}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                ⭐ {rating}
                {movie.vote_count ? (
                  <span className="text-xs text-light-200 font-normal">({movie.vote_count.toLocaleString()} votes)</span>
                ) : null}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3 text-left">
              {movie.title}
            </h1>

            {movie.tagline && (
              <p className="text-lg italic text-purple-300/80 mb-4 font-light">&ldquo;{movie.tagline}&rdquo;</p>
            )}

            <p className="movie-quick-answer">{quickAnswer}</p>

            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {movie.genres.map((genre) => {
                  const genreSlug = getGenreSlugById(genre.id);

                  return genreSlug ? (
                    <Link
                      key={genre.id || genre.name}
                      to={buildGenrePath(genreSlug)}
                      className="px-3 py-1 text-xs rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition"
                    >
                      {genre.name}
                    </Link>
                  ) : (
                    <span
                      key={genre.id || genre.name}
                      className="px-3 py-1 text-xs rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-200"
                    >
                      {genre.name}
                    </span>
                  );
                })}
              </div>
            )}

            <dl className="quick-facts" aria-label={`Quick facts about ${movie.title}`}>
              {quickFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-3 text-left">Synopsis</h2>
              <p className="text-light-100 leading-relaxed text-base sm:text-lg">
                {movie.overview || 'No synopsis is currently available for this title.'}
              </p>
            </div>


            {topCast.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 text-left">Featured Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {topCast.map((actor) => (
                    <div
                      key={actor.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center text-center"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-white/10 mb-2">
                        {actor.profile_path ? (
                          <img
                            src={getProfileImageSource(actor.profile_path)}
                            alt={`${actor.name} portrait`}
                            width="100"
                            height="100"
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-light-200">
                            Photo
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-xs text-white line-clamp-1">{actor.name}</p>
                      <p className="text-[11px] text-light-200 line-clamp-1">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="faq-section" aria-labelledby="movie-faq-title">
              <h2 id="movie-faq-title" className="text-xl font-bold text-white mb-3 text-left">
                Frequently asked questions
              </h2>
              <dl>
                {faqItems.map((item) => (
                  <div key={item.question}>
                    <dt>{item.question}</dt>
                    <dd>{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm">
              <div>
                <p className="text-xs text-light-200">Status</p>
                <p className="font-semibold text-white">{movie.status || 'Released'}</p>
              </div>
              <div>
                <p className="text-xs text-light-200">Release Date</p>
                <p className="font-semibold text-white">{movie.release_date || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-light-200">Budget</p>
                <p className="font-semibold text-white">
                  {movie.budget ? `$${(movie.budget / 1000000).toFixed(1)}M` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-light-200">Revenue</p>
                <p className="font-semibold text-white">
                  {movie.revenue ? `$${(movie.revenue / 1000000).toFixed(1)}M` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {recommendations.length > 0 && (
          <section className="mt-16" aria-labelledby="more-like-this-title">
            <h2 id="more-like-this-title" className="text-xl font-bold text-white mb-4 text-left">
              More like this
            </h2>
            <ul className="movie-card-links">
              {recommendations.map((item) => (
                <li key={item.id}>
                  <Link to={`/movie/${item.id}`}>
                    <img
                      src={getPosterImageSource(item.poster_path, 'w185')}
                      alt={`${item.title} poster`}
                      width="185"
                      height="278"
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{item.title}</span>
                    {item.release_date ? <small>{item.release_date.slice(0, 4)}</small> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="link-dropdowns">
          <GenreLinks title="Find more movies by genre" />
        </div>
      </div>

      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-xl border border-indigo-400/40 text-sm font-medium"
          role="status"
        >
          {toastMessage}
        </div>
      )}

      <SiteFooter />
    </main>
  );
};

export default MovieDetails;

