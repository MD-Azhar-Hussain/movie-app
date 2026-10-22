import React, { useEffect, useState } from 'react';
import { useParams, Link, useLoaderData } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import MovieSchema from '../components/MovieSchema';
import Spinner from '../components/Spin';
import { API_OPTIONS } from '../api/tmdb';

const WATCHLIST_STORAGE_KEY = 'movie-watchlist';

const getPosterImageSource = (posterValue) => {
  if (typeof posterValue !== 'string') return '/no-movie.png';
  const normalized = posterValue.trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') return '/no-movie.png';
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  return `https://image.tmdb.org/t/p/w500${normalized}`;
};

const getBackdropImageSource = (backdropValue) => {
  if (typeof backdropValue !== 'string') return null;
  const normalized = backdropValue.trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  return `https://image.tmdb.org/t/p/original${normalized}`;
};

const MovieDetails = () => {
  const { id } = useParams();
  const initialData = useLoaderData();
  const [movie, setMovie] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Sync watchlist status from localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !movie?.id) return;
    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          setIsSaved(list.some((item) => Number(item.id) === Number(movie.id)));
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [movie?.id]);

  // Client-side fetch fallback if data was not loaded by SSR/loader
  useEffect(() => {
    if (movie && Number(movie.id) === Number(id)) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchMovieDetails = async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,videos,recommendations`,
          {
            ...API_OPTIONS,
            headers: {
              ...API_OPTIONS.headers,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Movie not found (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (isMounted) {
          setMovie(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load movie details');
          setLoading(false);
        }
      }
    };

    fetchMovieDetails();

    return () => {
      isMounted = false;
    };
  }, [id, movie]);

  const toggleWatchlist = () => {
    if (typeof window === 'undefined' || !movie) return;

    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      let list = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];

      const exists = list.some((item) => Number(item.id) === Number(movie.id));
      let updated;
      if (exists) {
        updated = list.filter((item) => Number(item.id) !== Number(movie.id));
        setIsSaved(false);
        showToast(`Removed "${movie.title}" from watchlist`);
      } else {
        const itemToSave = {
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          runtime: movie.runtime,
          overview: movie.overview,
        };
        updated = [itemToSave, ...list];
        setIsSaved(true);
        showToast(`Added "${movie.title}" to watchlist`);
      }
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update watchlist', err);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const openWithFallbacks = async (event, primaryUrl, fallbackUrls = []) => {
    event.preventDefault();
    const urls = [primaryUrl, ...fallbackUrls];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) return;
        return;
      } catch {
        // try next fallback
      }
    }
    window.open(primaryUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <main className="min-h-screen text-white flex flex-col items-center justify-center p-6">
        <Head>
          <title>Loading Movie Details... - Film Point</title>
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
          <title>Movie Not Found - Film Point</title>
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

  const rawOverview = movie.overview || 'Discover full synopsis, cast, ratings, and streaming information on Film Point.';
  const metaDescription = rawOverview.length > 155 ? `${rawOverview.slice(0, 152)}...` : rawOverview;
  const posterUrl = getPosterImageSource(movie.poster_path);
  const backdropUrl = getBackdropImageSource(movie.backdrop_path);
  const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
  const rating = typeof movie.vote_average === 'number' && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : 'N/A';
  const pageTitle = `${movie.title} (${year}) - Film Point`;
  const canonicalUrl = `https://filmpoint.vercel.app/movie/${movie.id}`;
  const topCast = movie.credits?.cast?.slice(0, 6) || [];

  return (
    <main className="min-h-screen text-white relative pb-20">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={posterUrl} />
        {backdropUrl && <meta property="og:image" content={backdropUrl} />}
        <meta property="og:type" content="video.movie" />
        <meta property="og:url" content={canonicalUrl} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={backdropUrl || posterUrl} />
      </Head>

      {/* Schema.org/Movie JSON-LD */}
      <MovieSchema movie={movie} />

      <div className="pattern" />

      {/* Hero Backdrop Banner */}
      <div
        className="relative w-full h-[320px] sm:h-[460px] bg-cover bg-center overflow-hidden"
        style={
          backdropUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(3, 0, 20, 0.4) 0%, rgba(3, 0, 20, 0.95) 100%), url(${backdropUrl})`,
              }
            : {
                background: 'linear-gradient(180deg, #0f0d23 0%, #030014 100%)',
              }
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-light-100 hover:text-white bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 transition hover:bg-black/60"
          >
            ← Back to Discover
          </Link>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-36 sm:-mt-48 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
          {/* Poster Column */}
          <div className="w-56 sm:w-72 lg:w-80 flex-shrink-0 mx-auto md:mx-0">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0f0d23] group">
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full h-auto object-cover aspect-[2/3] transition duration-300 group-hover:scale-105"
                loading="eager"
              />
              <button
                type="button"
                onClick={toggleWatchlist}
                className={`absolute top-3 right-3 p-3 rounded-full backdrop-blur-md border border-white/20 transition ${
                  isSaved ? 'bg-amber-500 text-black' : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                aria-label={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
              >
                <span className="text-lg leading-none">{isSaved ? '★' : '☆'}</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={(e) =>
                  openWithFallbacks(e, `https://cinespot.org/movie/${movie.id}`, [
                    `https://doomflix.org/movie/${movie.id}`,
                    `https://guideflix.org/movie/${movie.id}`,
                    `https://indexflix.org/movie/${movie.id}`,
                    `https://streamiloo.org/movie/${movie.id}`,
                    `https://streamzy.org/movie/${movie.id}`,
                  ])
                }
                className="w-full py-3.5 px-6 rounded-xl font-bold text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:opacity-95 transition"
              >
                ▶ Watch Stream
              </button>

              <a
                href={`https://vidvault.ru/movie/${movie.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-6 rounded-xl font-medium text-center bg-white/10 hover:bg-white/15 border border-white/10 text-white transition"
              >
                ⬇ Download Options
              </a>

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

          {/* Details Column */}
          <div className="flex-1">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-light-200">
              <span className="px-3 py-1 rounded-full bg-white/10 font-semibold text-white">{year}</span>
              {movie.runtime ? <span>{movie.runtime} min</span> : null}
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

            {/* Single H1 for SEO */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3 text-left">
              {movie.title}
            </h1>

            {movie.tagline && (
              <p className="text-lg italic text-purple-300/80 mb-6 font-light">"{movie.tagline}"</p>
            )}

            {/* Genres */}
            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {movie.genres.map((genre) => (
                  <span
                    key={genre.id || genre.name}
                    className="px-3 py-1 text-xs rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-200"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis Section */}
            <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-3 text-left">Synopsis</h2>
              <p className="text-light-100 leading-relaxed text-base sm:text-lg">
                {movie.overview || 'No synopsis is currently available for this title.'}
              </p>
            </div>

            {/* Cast Section */}
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
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
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

            {/* Additional Metadata Details */}
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
      </div>

      {/* Watchlist Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-xl border border-indigo-400/40 text-sm font-medium animate-bounce"
          role="status"
        >
          {toastMessage}
        </div>
      )}

      {/* Footer */}
      <footer className="footer mt-24 text-center text-sm text-light-200" aria-label="Film Point footer">
        <p>© 2026 Film Point. All rights reserved.</p>
        <p className="mt-1">
          Data sourced from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="underline">
            TMDB
          </a>
          .
        </p>
      </footer>
    </main>
  );
};

export default MovieDetails;
