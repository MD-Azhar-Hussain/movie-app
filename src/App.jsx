import React, { useCallback, useEffect, useRef, useState } from 'react'
import Search from './components/Search'
import Spinner from './components/Spin'
import { useDebounce } from 'react-use'
import MovieCard from './components/MovieCard'
import MovieCardSkeleton from './components/MovieCardSkeleton'
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
import POSTER_FILES from 'virtual:poster-manifest'

import { API_OPTIONS } from './api/tmdb';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const WATCHLIST_STORAGE_KEY = 'movie-watchlist';
const WATCHLIST_DEVICE_KEY_STORAGE = 'movie-watchlist-device-key';
const WATCHLIST_SYNC_QUEUE_KEY = 'movie-watchlist-sync-queue';
const RECENT_SEARCHES_STORAGE_KEY = 'movie-recent-searches';
const RANDOM_PICK_HISTORY_STORAGE_KEY = 'movie-random-pick-history';
const MAX_RECENT_SEARCHES = 8;
const getPosterTitle = (fileName) => fileName
  .replace(/\.[^.]+$/, '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
const INITIAL_GALLERY_POSTERS = 8;
const RANDOM_SEARCH_FALLBACKS = [
  'Interstellar',
  'The Dark Knight',
  'Knives Out',
  'Spider-Man: Into the Spider-Verse',
  'The Grand Budapest Hotel',
  'Mad Max: Fury Road',
  'Arrival',
  'The Lord of the Rings',
  'The Shawshank Redemption',
  'Pulp Fiction',
  'Inception',
  'Fight Club',
  'Forrest Gump',
  'The Matrix',
  'Goodfellas',
  'The Godfather',
  'Parasite',
  'Whiplash',
  'The Prestige',
  'Dune',
  'Oppenheimer',
  'Everything Everywhere All at Once',
  'Spider-Man: Across the Spider-Verse',
  'Guardians of the Galaxy',
  'Avengers: Endgame',
  'Black Panther',
  'Logan',
  'The Batman',
  'Top Gun: Maverick',
  'The Wolf of Wall Street',
  'The Social Network',
  'La La Land',
  'Eternal Sunshine of the Spotless Mind',
  'Her',
  'The Truman Show',
  'Inglourious Basterds',
  'Django Unchained',
  'The Hateful Eight',
  'No Country for Old Men',
  'There Will Be Blood',
  'The Green Mile',
  'Se7en',
  'The Silence of the Lambs',
  'Zodiac',
  'Prisoners',
  'Gone Girl',
  'Shutter Island',
  'The Departed',
  'Heat',
  'The Big Lebowski',
  'Jojo Rabbit',
  '1917',
  'The Pianist',
  'The Intouchables',
  'Cinema Paradiso',
  'The Lives of Others',
  'Coco',
  'Ratatouille',
  'WALL-E',
  'How to Train Your Dragon',
  'The Incredibles',
  'Toy Story',
  'Get Out',
  'A Quiet Place',
  'Hereditary',
  'The Conjuring',
  'The Menu',
  'The Nice Guys',
  'Palm Springs',
  'Game Night',
  'The Princess Bride',
  'Back to the Future',
  'Jurassic Park',
  'Pirates of the Caribbean',
];
const LANDING_POSTERS = POSTER_FILES.map((fileName) => [fileName, getPosterTitle(fileName)]);
const LANDING_POSTERS_SECOND = [...LANDING_POSTERS].sort(() => Math.random() - 0.5);

const normalizeSearchTerm = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

const readRandomPickHistory = () => {
  if (typeof window === 'undefined') return new Set();

  try {
    const storedHistory = JSON.parse(window.sessionStorage.getItem(RANDOM_PICK_HISTORY_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(storedHistory) ? storedHistory : []);
  } catch {
    return new Set();
  }
};

const persistRandomPickHistory = (history) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(RANDOM_PICK_HISTORY_STORAGE_KEY, JSON.stringify([...history]));
  } catch {
    // Private browsing or storage limits should not disable random search.
  }
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
  const [watchlistSort, setWatchlistSort] = useState('recent');
  const [watchlistToast, setWatchlistToast] = useState('');
  const detailRequestIdRef = useRef(0);
  const detailAbortControllerRef = useRef(null);
  const moviesRequestIdRef = useRef(0);
  const moviesAbortControllerRef = useRef(null);
  const randomPickHistoryRef = useRef(readRandomPickHistory());
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
  }, 1000, [searchTerm])

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
    const revealTargets = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach((target) => target.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -48px' });

    revealTargets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [moviesList.length, trendingMovies.length]);

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
    if (typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isDetailOpen ? 'hidden' : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
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

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    persistRecentSearches([]);
  };

  const handleRandomSearch = useCallback(() => {
    const excludedTitles = new Set(
      recentSearches
        .concat(searchTerm)
        .map((title) => normalizeSearchTerm(title).toLowerCase())
        .filter(Boolean),
    );
    const weightedCandidates = [
      ...watchlist.map((movie) => ({ title: movie.title, weight: 6 })),
      ...moviesList.slice(0, 20).map((movie) => ({ title: movie.title, weight: 3 })),
      ...RANDOM_SEARCH_FALLBACKS.map((title) => ({ title, weight: 1 })),
    ].filter(({ title }) => {
      const normalizedTitle = normalizeSearchTerm(title).toLowerCase();
      return normalizedTitle && !excludedTitles.has(normalizedTitle);
    });

    const candidates = Array.from(new Map(
      weightedCandidates.map(({ title, weight }) => {
        const normalizedTitle = normalizeSearchTerm(title);
        return [normalizedTitle.toLowerCase(), { title: normalizedTitle, weight }];
      }),
    ).values());
    let pool = candidates.filter(({ title }) => !randomPickHistoryRef.current.has(title.toLowerCase()));

    if (pool.length === 0) {
      randomPickHistoryRef.current.clear();
      persistRandomPickHistory(randomPickHistoryRef.current);
      pool = candidates;
    }

    const totalWeight = pool.reduce((total, candidate) => total + candidate.weight, 0);
    let cursor = Math.random() * totalWeight;

    const selectedCandidate = pool.find((candidate) => {
      cursor -= candidate.weight;
      return cursor <= 0;
    }) || pool[0];

    if (selectedCandidate) {
      randomPickHistoryRef.current.add(selectedCandidate.title.toLowerCase());
      persistRandomPickHistory(randomPickHistoryRef.current);
      setSearchTerm(selectedCandidate.title);
    }
  }, [moviesList, recentSearches, searchTerm, watchlist]);

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
      setWatchlistToast(`${normalizedMovie.title} removed from your watchlist`);
      enqueueWatchlistMutation({
        op: 'remove',
        movieId: normalizedMovie.id,
      });
    } else {
      setWatchlist([normalizedMovie, ...normalizedCurrentWatchlist]);
      setWatchlistToast(`${normalizedMovie.title} added to your watchlist`);
      enqueueWatchlistMutation({
        op: 'add',
        movieId: normalizedMovie.id,
        movie: normalizedMovie,
      });
    }

    if (isWatchlistSyncConfigured) {
      void flushWatchlistSyncQueue();
    }

    window.setTimeout(() => setWatchlistToast(''), 2600);
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

  const sortedWatchlist = [...watchlist].sort((firstMovie, secondMovie) => {
    if (watchlistSort === 'title') return firstMovie.title.localeCompare(secondMovie.title);
    if (watchlistSort === 'rating') return (secondMovie.vote_average || 0) - (firstMovie.vote_average || 0);
    return new Date(secondMovie.addedAt).getTime() - new Date(firstMovie.addedAt).getTime();
  });

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
    const requestId = moviesRequestIdRef.current + 1;
    moviesRequestIdRef.current = requestId;

    if (moviesAbortControllerRef.current) {
      moviesAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    moviesAbortControllerRef.current = controller;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const endpoint = normalizedQuery
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(normalizedQuery)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;
      const response = await fetch(endpoint, { ...API_OPTIONS, signal: controller.signal });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      if (requestId !== moviesRequestIdRef.current) return;
      setMoviesList(data.results);

      if (normalizedQuery && data.results.length > 0) {
        await updateSearchCount(normalizedQuery, data.results[0]);
        addRecentSearch(normalizedQuery);
      }
    } catch (error) {
      if (error.name === 'AbortError' || requestId !== moviesRequestIdRef.current) return;
      console.error('Error fetching movies:', error);
      setErrorMessage('Failed to fetch movies. Please try again later.');
    } finally {
      if (requestId === moviesRequestIdRef.current) setIsLoading(false);
    }
  }, [addRecentSearch]);

  useEffect(() => {
    fetchMovies(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchMovies]);

  useEffect(() => {
    loadTrendingMovies();
  }, []);

  const activeSearchTerm = normalizeSearchTerm(searchTerm);
  const isSearchPending = activeSearchTerm !== normalizeSearchTerm(debouncedSearchTerm);
  const pageHeading = activeSearchTerm ? `Results for “${activeSearchTerm}”` : 'Popular right now';

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
        <header id='discover' data-reveal>
          <div className="poster-gallery" aria-label="Featured movie posters">
            <div className="poster-gallery-track poster-gallery-track-forward">
              {[...LANDING_POSTERS, ...LANDING_POSTERS].map(([fileName, title], index) => (
                <img
                  key={`forward-${fileName}-${index}`}
                  src={`/newposters/${encodeURIComponent(fileName)}`}
                  alt={`${title} poster`}
                  loading={index < INITIAL_GALLERY_POSTERS ? 'eager' : 'lazy'}
                  decoding="async"
                />
              ))}
            </div>
            <div className="poster-gallery-track poster-gallery-track-reverse">
              {[...LANDING_POSTERS_SECOND, ...LANDING_POSTERS_SECOND].map(([fileName, title], index) => (
                <img
                  key={`reverse-${fileName}-${index}`}
                  src={`/newposters/${encodeURIComponent(fileName)}`}
                  alt={`${title} poster`}
                  loading={index < INITIAL_GALLERY_POSTERS ? 'eager' : 'lazy'}
                  decoding="async"
                />
              ))}
            </div>
          </div>
          <h1>
            Find <span className="text-gradient">Movies</span> You'll Enjoy
          </h1>

          <Search
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            recentSearches={recentSearches}
            onSelectRecentSearch={handleSelectRecentSearch}
            onClearRecentSearches={handleClearRecentSearches}
            onRandomSearch={handleRandomSearch}
            isLoading={isLoading || isSearchPending}
          />
        </header>

        {trendingMovies.length > 0 && !normalizeSearchTerm(searchTerm) && (
          <section className="trending reveal-delay-1" id='trending' data-reveal>
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
                  <img
                    src={getPosterImageSource(movie.poster_url || movie.poster_path)}
                    alt={movie.searchTerm}
                    loading="lazy"
                    decoding="async"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="watchlist-section reveal-delay-2" id='watchlist' data-reveal>
          <div className="watchlist-header">
            <div>
              <h2>Watchlist</h2>
              <p className='section-kicker'>Your saved movies, ready when you are</p>
            </div>
            <div className='watchlist-tools'>
              <label htmlFor='watchlist-sort'>Sort</label>
              <select id='watchlist-sort' value={watchlistSort} onChange={(event) => setWatchlistSort(event.target.value)}>
                <option value='recent'>Recent</option>
                <option value='title'>Title</option>
                <option value='rating'>Rating</option>
              </select>
              <span>{watchlist.length}</span>
            </div>
          </div>

          {watchlist.length === 0 ? (
            <p className="watchlist-empty">No saved movies yet. Use Save on a movie card to build your list.</p>
          ) : (
            <ul className="watchlist-list">
              {sortedWatchlist.map((movie) => (
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
                    loading="lazy"
                    decoding="async"
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

        <section className="all-movies reveal-delay-3" id='all-movies' data-reveal>
            <div className='section-heading'>
              <div>
                <p className='section-eyebrow'>Movie library</p>
                <h2 className="text-white text-2xl font-bold">{pageHeading}</h2>
              </div>
              {!isLoading && !isSearchPending && !errorMessage && <span className='result-count'>{moviesList.length} titles</span>}
            </div>

          {isLoading || isSearchPending ? (
            <ul className='movie-grid-skeletons'>
              {Array.from({ length: 8 }, (_, index) => <MovieCardSkeleton key={index} />)}
            </ul>
          ) : errorMessage ? (
            <div className='api-error-state'>
              <p>{errorMessage}</p>
              <button type='button' onClick={() => fetchMovies(debouncedSearchTerm)}>Try again</button>
            </div>
          ) : (
            <ul>
              {moviesList.map((movie, index) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  index={index}
                  hidePopularBadge={!activeSearchTerm}
                  onClick={() => openMovieDetail(movie)}
                  isSaved={isMovieSaved(movie.id)}
                  onToggleWatchlist={() => toggleWatchlist(movie)}
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
                <div
                  className="movie-detail-hero"
                  style={selectedMovie.backdrop_path ? {
                    backgroundImage: `linear-gradient(180deg, rgba(9, 13, 29, 0.08), #090d1d 92%), url(${getPosterImageSource(selectedMovie.backdrop_path)})`,
                  } : undefined}
                >
                  <img
                    className="movie-detail-poster"
                    src={getPosterImageSource(selectedMovie.poster_path || selectedMovie.poster_url)}
                    alt={selectedMovie.title}
                  />
                </div>

                <div className="movie-detail-content">
                  <div className="movie-detail-meta">
                    <span>{selectedMovie.release_date ? selectedMovie.release_date.split('-')[0] : 'N/A'}</span>
                    <span>⭐ {selectedMovie.vote_average ? selectedMovie.vote_average.toFixed(1) : 'N/A'}</span>
                    {selectedMovie.runtime ? <span>{selectedMovie.runtime} min</span> : null}
                  </div>

                  <h2 id="movie-detail-title">{selectedMovie.title}</h2>

                  {selectedMovie.genres?.length > 0 && (
                    <div className="movie-detail-genres" aria-label="Genres">
                      {selectedMovie.genres.map((genre) => (
                        <span key={genre.id || genre.name}>{genre.name}</span>
                      ))}
                    </div>
                  )}

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
                    <a
                      className="movie-detail-button movie-detail-secondary"
                      href={`https://www.themoviedb.org/movie/${selectedMovie.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on TMDB
                    </a>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {watchlistToast && <div className='watchlist-toast' role='status'>{watchlistToast}</div>}

      <footer className="footer" aria-label="MovieVerse footer">
        <p>© 2026 MovieVerse. All rights reserved.</p>
        <p>
          Data sourced from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a> and <a href="https://www.imdb.com/" target="_blank" rel="noopener noreferrer">IMDB</a>.
        </p>
        <p>Made with <span aria-label="love">♥</span> by MAH(6931).</p>
      </footer>
    </main>
  )
}

export default App