import React, { useCallback, useEffect, useRef, useState } from 'react'
import Search from './components/Search'
import Spinner from './components/Spin'
import { useDebounce } from 'react-use'
import MovieCard from './components/MovieCard'
import {
  deleteWatchlistSyncDocument,
  getTrendingSearches,
  getWatchlistSyncDocuments,
  isWatchlistSyncConfigured,
  updateSearchCount,
  upsertWatchlistSyncDocument,
} from './appwrite'
import { Helmet } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react'

import { API_OPTIONS } from './api/tmdb';
const API_BASE_URL = 'https://api.themoviedb.org/3/';
const WATCHLIST_STORAGE_KEY = 'movie-watchlist';
const WATCHLIST_DEVICE_KEY_STORAGE = 'movie-watchlist-device-key';
const WATCHLIST_SYNC_QUEUE_KEY = 'movie-watchlist-sync-queue';
const RECENT_SEARCHES_STORAGE_KEY = 'movie-recent-searches';
const MAX_RECENT_SEARCHES = 8;

const normalizeSearchTerm = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

const readRecentSearches = () => {
  if (typeof window === 'undefined') return [];

  try {
    const storedSearches = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!storedSearches) return [];

    const parsedSearches = JSON.parse(storedSearches);
    if (!Array.isArray(parsedSearches)) return [];

    const normalizedSearches = parsedSearches
      .map((search) => normalizeSearchTerm(search))
      .filter(Boolean)
      .filter((search, index, array) => array.findIndex((item) => item.toLowerCase() === search.toLowerCase()) === index)
      .slice(0, MAX_RECENT_SEARCHES);

    return normalizedSearches;
  } catch (error) {
    console.warn('Unable to read recent searches from localStorage.', error);
    return [];
  }
};

const persistRecentSearches = (searches) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(searches));
  } catch (error) {
    console.warn('Unable to persist recent searches to localStorage.', error);
  }
};

const createDeviceKey = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `device_${timestamp}_${randomPart}`;
};

const normalizeWatchlistEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const movieId = entry.id ?? entry.movie_id;
  if (movieId === undefined || movieId === null || movieId === '') return null;

  const numericId = Number(movieId);
  if (Number.isNaN(numericId)) return null;

  return {
    id: numericId,
    title: typeof entry.title === 'string' ? entry.title : 'Untitled',
    poster_path: typeof entry.poster_path === 'string' ? entry.poster_path : '',
    release_date: typeof entry.release_date === 'string' ? entry.release_date : '',
    vote_average: typeof entry.vote_average === 'number' ? entry.vote_average : null,
    overview: typeof entry.overview === 'string' ? entry.overview : '',
    addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : new Date().toISOString(),
  };
};

const normalizeWatchlist = (items) => {
  if (!Array.isArray(items)) return [];

  const deduped = new Map();

  items.forEach((item) => {
    const normalized = normalizeWatchlistEntry(item);
    if (!normalized) return;

    const idKey = String(normalized.id);
    if (!deduped.has(idKey)) {
      deduped.set(idKey, normalized);
    }
  });

  return Array.from(deduped.values());
};

const mergeWatchlists = (localItems, remoteItems) => {
  const merged = new Map();

  normalizeWatchlist(remoteItems).forEach((item) => {
    merged.set(String(item.id), item);
  });

  normalizeWatchlist(localItems).forEach((item) => {
    merged.set(String(item.id), item);
  });

  return Array.from(merged.values());
};

const parseSyncQueue = (serializedQueue) => {
  if (!serializedQueue) return [];

  try {
    const parsed = JSON.parse(serializedQueue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        if (entry.op !== 'add' && entry.op !== 'remove') return null;

        const numericMovieId = Number(entry.movieId);
        if (Number.isNaN(numericMovieId)) return null;

        const normalizedMovie = entry.op === 'add' ? normalizeWatchlistEntry(entry.movie) : null;
        if (entry.op === 'add' && !normalizedMovie) return null;

        return {
          op: entry.op,
          movieId: numericMovieId,
          movie: normalizedMovie,
          enqueuedAt: typeof entry.enqueuedAt === 'string' ? entry.enqueuedAt : new Date().toISOString(),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const parseRemoteWatchlistDocuments = (documents) => {
  if (!Array.isArray(documents)) return [];

  const parsed = documents
    .map((document) => {
      if (!document || typeof document !== 'object') return null;

      const payload = typeof document.payload === 'string' ? document.payload : '';
      if (!payload) return null;

      try {
        return normalizeWatchlistEntry(JSON.parse(payload));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return normalizeWatchlist(parsed);
};

const getPosterImageSource = (posterValue) => {
  if (typeof posterValue !== 'string') return '/no-movie.png';

  const normalizedPosterValue = posterValue.trim();
  if (!normalizedPosterValue || normalizedPosterValue === 'null' || normalizedPosterValue === 'undefined') {
    return '/no-movie.png';
  }

  if (normalizedPosterValue.startsWith('http://') || normalizedPosterValue.startsWith('https://')) {
    if (normalizedPosterValue.includes('/w500null') || normalizedPosterValue.includes('/w500undefined')) {
      return '/no-movie.png';
    }

    return normalizedPosterValue;
  }

  return `https://image.tmdb.org/t/p/w500${normalizedPosterValue}`;
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [moviesList, setMoviesList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isWatchlistHydrated, setIsWatchlistHydrated] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestIdRef = useRef(0);
  const detailAbortControllerRef = useRef(null);
  const isFlushingSyncQueueRef = useRef(false);

  const getDeviceKey = useCallback(() => {
    if (typeof window === 'undefined') return '';

    const existingKey = window.localStorage.getItem(WATCHLIST_DEVICE_KEY_STORAGE);
    if (existingKey && typeof existingKey === 'string') return existingKey;

    const newKey = createDeviceKey();
    window.localStorage.setItem(WATCHLIST_DEVICE_KEY_STORAGE, newKey);
    return newKey;
  }, []);

  const getSyncQueue = useCallback(() => {
    if (typeof window === 'undefined') return [];
    return parseSyncQueue(window.localStorage.getItem(WATCHLIST_SYNC_QUEUE_KEY));
  }, []);

  const setSyncQueue = useCallback((queueItems) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WATCHLIST_SYNC_QUEUE_KEY, JSON.stringify(queueItems));
  }, []);

  const enqueueWatchlistMutation = useCallback((mutation) => {
    if (!isWatchlistSyncConfigured || typeof window === 'undefined' || !mutation) return;

    const existingQueue = getSyncQueue();
    setSyncQueue([
      ...existingQueue,
      {
        ...mutation,
        enqueuedAt: new Date().toISOString(),
      },
    ]);
  }, [getSyncQueue, setSyncQueue]);

  const flushWatchlistSyncQueue = useCallback(async () => {
    if (!isWatchlistSyncConfigured || isFlushingSyncQueueRef.current) return;

    const deviceKey = getDeviceKey();
    if (!deviceKey) return;

    isFlushingSyncQueueRef.current = true;

    try {
      const queue = getSyncQueue();
      if (queue.length === 0) return;

      const nextQueue = [...queue];

      while (nextQueue.length > 0) {
        const mutation = nextQueue[0];

        if (mutation.op === 'add') {
          await upsertWatchlistSyncDocument(deviceKey, mutation.movie);
        } else {
          await deleteWatchlistSyncDocument(deviceKey, mutation.movieId);
        }

        nextQueue.shift();
        setSyncQueue(nextQueue);
      }
    } catch (error) {
      console.warn('Watchlist sync queue flush failed. Will retry later.', error);
    } finally {
      isFlushingSyncQueueRef.current = false;
    }
  }, [getDeviceKey, getSyncQueue, setSyncQueue]);

  const hydrateWatchlistFromSync = useCallback(async () => {
    if (!isWatchlistSyncConfigured) return;

    const deviceKey = getDeviceKey();
    if (!deviceKey) return;

    try {
      const remoteDocuments = await getWatchlistSyncDocuments(deviceKey);
      const remoteWatchlist = parseRemoteWatchlistDocuments(remoteDocuments);

      if (remoteWatchlist.length === 0) return;

      setWatchlist((previousWatchlist) => mergeWatchlists(previousWatchlist, remoteWatchlist));
    } catch (error) {
      console.warn('Watchlist sync hydrate failed. Continuing with local data.', error);
    }
  }, [getDeviceKey]);

  useDebounce(() => {
    setDebouncedSearchTerm(searchTerm);
  }, 500, [searchTerm])

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedWatchlist = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!savedWatchlist) {
        setWatchlist([]);
      } else {
        const parsedWatchlist = JSON.parse(savedWatchlist);
        const normalizedWatchlist = normalizeWatchlist(parsedWatchlist);
        setWatchlist(normalizedWatchlist);

        if (JSON.stringify(normalizedWatchlist) !== savedWatchlist) {
          window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(normalizedWatchlist));
        }
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
      setWatchlist([]);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([]));
      }
    } finally {
      setIsWatchlistHydrated(true);
      if (isWatchlistSyncConfigured) {
        void hydrateWatchlistFromSync();
        void flushWatchlistSyncQueue();
      }
    }
  }, [flushWatchlistSyncQueue, hydrateWatchlistFromSync]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isWatchlistHydrated) return;

    try {
      const normalizedWatchlist = normalizeWatchlist(watchlist);
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(normalizedWatchlist));
      if (normalizedWatchlist.length !== watchlist.length) {
        setWatchlist(normalizedWatchlist);
      }
    } catch (error) {
      console.error('Error saving watchlist:', error);
    }
  }, [isWatchlistHydrated, watchlist]);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    if (!isDetailOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMovieDetail();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDetailOpen]);

  useEffect(() => {
    return () => {
      if (detailAbortControllerRef.current) {
        detailAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!isWatchlistSyncConfigured || typeof window === 'undefined') return;

    const handleOnline = () => {
      void flushWatchlistSyncQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushWatchlistSyncQueue]);

  const isMovieSaved = (movieId) => watchlist.some((movie) => Number(movie.id) === Number(movieId));

  const addRecentSearch = useCallback((query) => {
    const normalizedQuery = normalizeSearchTerm(query);
    if (!normalizedQuery) return;

    setRecentSearches((previousSearches) => {
      const nextSearches = [
        normalizedQuery,
        ...previousSearches.filter((search) => search.toLowerCase() !== normalizedQuery.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);

      persistRecentSearches(nextSearches);
      return nextSearches;
    });
  }, []);

  const handleSelectRecentSearch = (query) => {
    const normalizedQuery = normalizeSearchTerm(query);
    if (!normalizedQuery) return;

    setSearchTerm(normalizedQuery);
  };

  const toggleWatchlist = (movie) => {
    if (!movie) return;

    const normalizedMovie = normalizeWatchlistEntry({
      ...movie,
      id: movie.id,
      title: movie.title || movie.name || 'Untitled',
      poster_path: movie.poster_path || '',
      release_date: movie.release_date || '',
      vote_average: movie.vote_average ?? null,
      overview: movie.overview || '',
      addedAt: new Date().toISOString(),
    });

    if (!normalizedMovie) return;

    const normalizedCurrentWatchlist = normalizeWatchlist(watchlist);
    const exists = normalizedCurrentWatchlist.some((item) => Number(item.id) === Number(normalizedMovie.id));

    if (exists) {
      setWatchlist(normalizedCurrentWatchlist.filter((item) => Number(item.id) !== Number(normalizedMovie.id)));
      enqueueWatchlistMutation({
        op: 'remove',
        movieId: normalizedMovie.id,
      });
    } else {
      setWatchlist([normalizedMovie, ...normalizedCurrentWatchlist]);
      enqueueWatchlistMutation({
        op: 'add',
        movieId: normalizedMovie.id,
        movie: normalizedMovie,
      });
    }

    if (isWatchlistSyncConfigured) {
      void flushWatchlistSyncQueue();
    }
  };

  const openMovieDetail = async (movie) => {
    if (!movie) return;

    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    if (detailAbortControllerRef.current) {
      detailAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    detailAbortControllerRef.current = controller;

    setIsDetailOpen(true);
    setDetailError('');

    const hasDetailFields = Boolean(
      movie.overview ||
      movie.runtime ||
      (movie.genres && movie.genres.length > 0) ||
      movie.vote_average ||
      movie.release_date
    );

    if (movie.poster_path && hasDetailFields) {
      setSelectedMovie(movie);
      return;
    }

    setSelectedMovie(movie);
    setDetailLoading(true);

    try {
      const response = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}`, {
        ...API_OPTIONS,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      if (requestId !== detailRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      setSelectedMovie({ ...movie, ...data });
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (requestId !== detailRequestIdRef.current) return;

      console.error('Error fetching movie details:', error);
      setSelectedMovie(movie);
      setDetailError('Unable to load movie details right now. Please try again.');
    } finally {
      if (requestId === detailRequestIdRef.current && !controller.signal.aborted) {
        setDetailLoading(false);
      }
    }
  };

  const closeMovieDetail = () => {
    detailRequestIdRef.current += 1;

    if (detailAbortControllerRef.current) {
      detailAbortControllerRef.current.abort();
      detailAbortControllerRef.current = null;
    }

    setIsDetailOpen(false);
    setDetailError('');
    setDetailLoading(false);
    setSelectedMovie(null);
  };

  const loadTrendingMovies = async () => {
    try {
      const movies = await getTrendingSearches();
      setTrendingMovies(movies);
      console.log('Trending Movies:', movies);
    } catch (error) {
      console.log(`Error Fetching Trending Movies : ${error}`);
    }
  }

  const fetchMovies = useCallback(async (query = '') => {
    const normalizedQuery = normalizeSearchTerm(query);
    setIsLoading(true);
    setErrorMessage('');
    try {
      const endpoint = normalizedQuery
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(normalizedQuery)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;
      const response = await fetch(endpoint, API_OPTIONS);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log(data.results);
      setMoviesList(data.results);

      if (normalizedQuery && data.results.length > 0) {
        await updateSearchCount(normalizedQuery, data.results[0]);
        addRecentSearch(normalizedQuery);
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
      setErrorMessage('Failed to fetch movies. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [addRecentSearch]);

  useEffect(() => {
    fetchMovies(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchMovies]);

  useEffect(() => {
    loadTrendingMovies();
  }, []);

  return (
    <main>
      <Helmet>
        <title>MovieVerse | Discover Trending & Popular Movies</title>

        <meta
          name="description"
          content="Search and explore trending movies with cinematic UI, real-time popularity, ratings, and direct IMDb links."
        />

        <meta name="keywords" content="movies, trending movies, IMDb, TMDB, movie search, film discovery" />

        <meta property="og:title" content="MovieVerse – Discover Movies You'll Enjoy" />
        <meta
          property="og:description"
          content="A futuristic movie discovery platform with trending analytics and IMDb integration."
        />
        <meta property="og:image" content="/hero.png" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MovieVerse – Discover Movies You'll Enjoy" />
        <meta
          name="twitter:description"
          content="Search trending and popular movies with ratings and direct IMDb access."
        />
        <meta name="twitter:image" content="/hero.png" />
      </Helmet>

      <div className="pattern" />

      <Analytics />

      <div className="wrapper">
        <header>
          <img src="./hero.png" alt="Hero Banner" />
          <h1>
            Find <span className="text-gradient">Movies</span> You'll Enjoy
          </h1>

          <Search
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            recentSearches={recentSearches}
            onSelectRecentSearch={handleSelectRecentSearch}
          />
        </header>

        {trendingMovies.length > 0 && (
          <section className="trending">
            <h2 className="text-white text-2xl font-bold mb-4">Trending Searches</h2>
            <ul>
              {trendingMovies.map((movie, index) => (
                <li
                  key={movie.$id}
                  className="trending-item cursor-pointer"
                  onClick={async () => {
                    const newTab = window.open('', '_blank');

                    try {
                      const res = await fetch(
                        `https://api.themoviedb.org/3/movie/${movie.movie_id}`,
                        API_OPTIONS
                      );
                      const data = await res.json();

                      if (data.imdb_id) {
                        newTab.location.href = `https://www.imdb.com/title/${data.imdb_id}`;
                      }
                    } catch (err) {
                      newTab.close();
                      console.error('Failed to fetch IMDb ID', err);
                    }
                  }}
                >
                  <p>{index + 1}</p>
                  <img src={getPosterImageSource(movie.poster_url || movie.poster_path)} alt={movie.searchTerm} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="watchlist-section">
          <div className="watchlist-header">
            <h2>Watchlist</h2>
            <span>{watchlist.length}</span>
          </div>

          {watchlist.length === 0 ? (
            <p className="watchlist-empty">No saved movies yet. Open a movie to add it.</p>
          ) : (
            <ul className="watchlist-list">
              {watchlist.map((movie) => (
                <li
                  key={movie.id}
                  className="watchlist-item"
                  onClick={() => openMovieDetail(movie)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openMovieDetail(movie);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open details for ${movie.title}`}
                >
                  <img
                    src={getPosterImageSource(movie.poster_path || movie.poster_url)}
                    alt={movie.title}
                  />
                  <div className="watchlist-details">
                    <p>{movie.title}</p>
                    <span>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="all-movies">
          <h2 className="text-white text-2xl font-bold mb-40px mt-[40px]">All Movies</h2>

          {isLoading ? (
            <Spinner />
          ) : errorMessage ? (
            <p className="text-red-500">{errorMessage}</p>
          ) : (
            <ul>
              {moviesList.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onClick={() => openMovieDetail(movie)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {isDetailOpen && selectedMovie && (
        <div className="movie-detail-backdrop" onClick={closeMovieDetail}>
          <aside
            className="movie-detail-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-detail-title"
            aria-describedby="movie-detail-description"
          >
            <button type="button" className="movie-detail-close" onClick={closeMovieDetail} aria-label="Close movie details">
              ×
            </button>

            {detailLoading ? (
              <div className="movie-detail-loading">
                <Spinner />
              </div>
            ) : detailError ? (
              <div className="movie-detail-error">
                <h3>Movie details unavailable</h3>
                <p>{detailError}</p>
              </div>
            ) : (
              <>
                <img
                  className="movie-detail-poster"
                  src={getPosterImageSource(selectedMovie.poster_path || selectedMovie.poster_url)}
                  alt={selectedMovie.title}
                />

                <div className="movie-detail-content">
                  <div className="movie-detail-meta">
                    <span>{selectedMovie.release_date ? selectedMovie.release_date.split('-')[0] : 'N/A'}</span>
                    <span>⭐ {selectedMovie.vote_average ? selectedMovie.vote_average.toFixed(1) : 'N/A'}</span>
                  </div>

                  <h2 id="movie-detail-title">{selectedMovie.title}</h2>

                  <p id="movie-detail-description" className="movie-detail-overview">
                    {selectedMovie.overview || 'No synopsis available for this title yet.'}
                  </p>

                  <div className="movie-detail-actions">
                    <button
                      type="button"
                      className="movie-detail-button movie-detail-toggle"
                      onClick={() => toggleWatchlist(selectedMovie)}
                    >
                      {isMovieSaved(selectedMovie.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

export default App