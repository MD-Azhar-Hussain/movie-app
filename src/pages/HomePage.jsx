import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head } from 'vite-react-ssg';
import { Link } from 'react-router-dom';
import POSTER_FILES from 'virtual:poster-manifest';
import Search from '../components/Search';
import Spinner from '../components/Spin';
import MovieCard from '../components/MovieCard';
import MovieCardSkeleton from '../components/MovieCardSkeleton';
import PopularLinks from '../components/PopularLinks';
import SiteSchema from '../components/SiteSchema';
import GenreLinks from '../components/GenreLinks';
import SiteFooter from '../components/SiteFooter';
import { getTrendingSearches, isWatchlistSyncConfigured, updateSearchCount } from '../appwrite';
import {
  WATCHLIST_STORAGE_KEY,
  enqueueWatchlistMutation,
  fetchRemoteWatchlist,
  flushSyncQueue,
  isMovieInWatchlist,
  mergeWatchlists,
  readStoredWatchlist,
  sortWatchlist,
  toggleWatchlistItems,
  writeStoredWatchlist,
} from '../lib/watchlist';
import { getPosterImageSource } from '../lib/poster';
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  truncateText,
} from '../lib/seo';
import { tmdbFetch } from '../api/tmdbProxy';
import { useDebounce } from '../hooks/useDebounce';

const API_BASE_URL = 'https://api.themoviedb.org/3';
const RECENT_SEARCHES_STORAGE_KEY = 'movie-recent-searches';
const RANDOM_PICK_HISTORY_STORAGE_KEY = 'movie-random-pick-history';
const MAX_RECENT_SEARCHES = 8;
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
  'Back to the Future',
  'Jurassic Park',
  'Pirates of the Caribbean',
];

const getPosterTitle = (fileName) => fileName
  .replace(/\.[^.]+$/, '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const LANDING_POSTERS = POSTER_FILES.map((fileName) => [fileName, getPosterTitle(fileName)]);
const LANDING_POSTERS_SECOND = [...LANDING_POSTERS].reverse();

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

    return parsedSearches
      .map((search) => normalizeSearchTerm(search))
      .filter(Boolean)
      .filter((search, index, array) => array.findIndex((item) => item.toLowerCase() === search.toLowerCase()) === index)
      .slice(0, MAX_RECENT_SEARCHES);
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

const HomePage = () => {
  // Incoming `?q=` search — the same URL shape advertised by the WebSite
  // SearchAction, so shared links and sitelinks search actually work.
  const initialQuery = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const query = window.location?.search
      ? new URLSearchParams(window.location.search).get('q')
      : '';
    return normalizeSearchTerm(query || '');
  }, []);

  const isSearchResultPage = Boolean(initialQuery);

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [errorMessage, setErrorMessage] = useState('');
  const [moviesList, setMoviesList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isWatchlistHydrated, setIsWatchlistHydrated] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [watchlistSort, setWatchlistSort] = useState('recent');
  const [watchlistToast, setWatchlistToast] = useState('');
  const [syncStatus, setSyncStatus] = useState('');

  const debouncedSearchTerm = useDebounce(searchTerm, 1000);

  const detailRequestIdRef = useRef(0);
  const detailAbortControllerRef = useRef(null);
  const detailPanelRef = useRef(null);
  const moviesRequestIdRef = useRef(0);
  const moviesAbortControllerRef = useRef(null);
  const randomPickHistoryRef = useRef(readRandomPickHistory());
  const isFlushingSyncQueueRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  /* ---------------------------------------------------------------- *
   * Watchlist: local storage is the source of truth, Appwrite is a
   * best-effort background replica.
   * ---------------------------------------------------------------- */

  const runSyncFlush = useCallback(async () => {
    if (!isWatchlistSyncConfigured || isFlushingSyncQueueRef.current) return;

    isFlushingSyncQueueRef.current = true;
    try {
      const { pending } = await flushSyncQueue();
      setSyncStatus(pending > 0 ? 'Offline: saved locally, will retry' : '');
    } finally {
      isFlushingSyncQueueRef.current = false;
    }
  }, []);

  useEffect(() => {
    const storedWatchlist = readStoredWatchlist();
    setWatchlist(storedWatchlist);
    setIsWatchlistHydrated(true);

    if (!isWatchlistSyncConfigured) return;

    let isMounted = true;

    const hydrateFromRemote = async () => {
      const remoteWatchlist = await fetchRemoteWatchlist();
      if (!isMounted || remoteWatchlist.length === 0) return;
      setWatchlist((previous) => mergeWatchlists(previous, remoteWatchlist));
    };

    void hydrateFromRemote();
    void runSyncFlush();

    return () => {
      isMounted = false;
    };
  }, [runSyncFlush]);

  useEffect(() => {
    if (!isWatchlistHydrated) return;
    writeStoredWatchlist(watchlist);
  }, [isWatchlistHydrated, watchlist]);

  // Keep multiple tabs in sync without a refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event) => {
      if (event.key !== WATCHLIST_STORAGE_KEY) return;
      setWatchlist(readStoredWatchlist());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!isWatchlistSyncConfigured || typeof window === 'undefined') return undefined;

    const handleOnline = () => {
      void runSyncFlush();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [runSyncFlush]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

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

  useEffect(() => () => {
    if (detailAbortControllerRef.current) detailAbortControllerRef.current.abort();
    if (moviesAbortControllerRef.current) moviesAbortControllerRef.current.abort();
  }, []);

  const isMovieSaved = useCallback((movieId) => isMovieInWatchlist(watchlist, movieId), [watchlist]);

  const showWatchlistToast = useCallback((message) => {
    setWatchlistToast(message);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setWatchlistToast(''), 2600);
  }, []);

  const toggleWatchlist = useCallback((movie) => {
    if (!movie) return;

    const { items, saved, entry } = toggleWatchlistItems(watchlist, movie);
    if (!entry) return;

    setWatchlist(items);
    showWatchlistToast(`${entry.title} ${saved ? 'added to' : 'removed from'} your watchlist`);

    enqueueWatchlistMutation(
      saved
        ? { op: 'add', movieId: entry.id, movie: entry }
        : { op: 'remove', movieId: entry.id }
    );

    if (isWatchlistSyncConfigured) void runSyncFlush();
  }, [runSyncFlush, showWatchlistToast, watchlist]);

  /* ---------------------------------------------------------------- *
   * Recent searches + personalized random pick
   * ---------------------------------------------------------------- */

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

  const handleSelectRecentSearch = useCallback((query) => {
    const normalizedQuery = normalizeSearchTerm(query);
    if (normalizedQuery) setSearchTerm(normalizedQuery);
  }, []);

  const handleClearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    persistRecentSearches([]);
  }, []);

  const handleRandomSearch = useCallback(() => {
    const excludedTitles = new Set(
      recentSearches
        .concat(searchTerm)
        .map((title) => normalizeSearchTerm(title).toLowerCase())
        .filter(Boolean)
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
      })
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
  /* ---------------------------------------------------------------- *
   * TMDB data loading
   * ---------------------------------------------------------------- */

  const fetchMovies = useCallback(async (query = '') => {
    const normalizedQuery = normalizeSearchTerm(query);
    const requestId = moviesRequestIdRef.current + 1;
    moviesRequestIdRef.current = requestId;

    if (moviesAbortControllerRef.current) moviesAbortControllerRef.current.abort();

    const controller = new AbortController();
    moviesAbortControllerRef.current = controller;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const endpoint = normalizedQuery
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(normalizedQuery)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;
      const response = await tmdbFetch(endpoint, { signal: controller.signal });

      if (!response.ok) throw new Error(`TMDB responded with ${response.status}`);

      const data = await response.json();
      if (requestId !== moviesRequestIdRef.current) return;

      setMoviesList(Array.isArray(data.results) ? data.results : []);

      if (normalizedQuery && data.results?.length > 0) {
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
    void fetchMovies(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchMovies]);

  useEffect(() => {
    let isMounted = true;

    const loadTrendingMovies = async () => {
      const movies = await getTrendingSearches();
      if (isMounted && Array.isArray(movies)) setTrendingMovies(movies);
    };

    void loadTrendingMovies();

    return () => {
      isMounted = false;
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Movie detail dialog
   * ---------------------------------------------------------------- */

  const closeMovieDetail = useCallback(() => {
    detailRequestIdRef.current += 1;

    if (detailAbortControllerRef.current) {
      detailAbortControllerRef.current.abort();
      detailAbortControllerRef.current = null;
    }

    setIsDetailOpen(false);
    setDetailError('');
    setDetailLoading(false);
    setSelectedMovie(null);
  }, []);

  const openMovieDetail = useCallback(async (movie) => {
    if (!movie) return;

    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    if (detailAbortControllerRef.current) detailAbortControllerRef.current.abort();

    const controller = new AbortController();
    detailAbortControllerRef.current = controller;

    setIsDetailOpen(true);
    setDetailError('');
    setSelectedMovie(movie);

    const hasDetailFields = Boolean(
      movie.overview || movie.runtime || movie.genres?.length || movie.vote_average || movie.release_date
    );

    if (movie.poster_path && hasDetailFields) return;

    setDetailLoading(true);

    try {
      const response = await tmdbFetch(`https://api.themoviedb.org/3/movie/${movie.id}`, {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      if (requestId !== detailRequestIdRef.current || controller.signal.aborted) return;

      setSelectedMovie({ ...movie, ...data });
    } catch (error) {
      if (error.name === 'AbortError' || requestId !== detailRequestIdRef.current) return;
      console.error('Error fetching movie details:', error);
      setDetailError('Unable to load movie details right now. Please try again.');
    } finally {
      if (requestId === detailRequestIdRef.current && !controller.signal.aborted) {
        setDetailLoading(false);
      }
    }
  }, []);


  // Escape to close, focus trap, focus restore and scroll lock for the dialog.
  useEffect(() => {
    if (!isDetailOpen || typeof document === 'undefined') return undefined;

    const previouslyFocused = document.activeElement;
    const panel = detailPanelRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

    panel?.querySelector(focusableSelector)?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMovieDetail();
        return;
      }

      if (event.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll(focusableSelector))
        .filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [closeMovieDetail, isDetailOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isDetailOpen ? 'hidden' : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDetailOpen]);

  const sortedWatchlist = useMemo(() => sortWatchlist(watchlist, watchlistSort), [watchlist, watchlistSort]);

  const activeSearchTerm = normalizeSearchTerm(searchTerm);
  const isSearchPending = activeSearchTerm !== normalizeSearchTerm(debouncedSearchTerm);
  const pageHeading = activeSearchTerm ? `Results for “${activeSearchTerm}”` : 'Popular right now';
  const pageTitle = activeSearchTerm ? `${activeSearchTerm} movies - ${SITE_NAME}` : SITE_TITLE;
  const pageDescription = activeSearchTerm
    ? truncateText(`Search results, ratings and streaming details for "${activeSearchTerm}" on ${SITE_NAME}.`)
    : SITE_DESCRIPTION;

  // The search state is not a separate URL: `/` is the only indexable page.
  // `/` canonical + `noindex` for `?q=` results follows Google's guidance on
  // internal search results (they must not be indexed as separate pages).
  const canonicalUrl = absoluteUrl('/');
  const robotsContent = isSearchResultPage
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large';

  return (
    <main>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
        <meta name="robots" content={robotsContent} />

        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Head>

      <SiteSchema />

      <div className="pattern" />

      <div className="wrapper">
        <header id="discover" data-reveal>
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
            Find <span className="text-gradient">Movies</span> You&apos;ll Enjoy
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

        {trendingMovies.length > 0 && !activeSearchTerm && (
          <section className="trending reveal-delay-1" id="trending" data-reveal>
            <h2 className="text-white text-2xl font-bold mb-4">Trending Searches</h2>
            <ul>
              {trendingMovies.map((movie, index) => (
                <li
                  key={movie.$id}
                  className="trending-item cursor-pointer"
                  onClick={async () => {
                    const newTab = window.open('', '_blank');

                    try {
                      const response = await tmdbFetch(
                        `https://api.themoviedb.org/3/movie/${movie.movie_id}`
                      );
                      if (!response.ok) throw new Error('Failed to fetch movie info');

                      const contentType = response.headers?.get('content-type') || '';
                      if (!contentType.includes('application/json')) throw new Error('Non-JSON response');

                      const data = await response.json();

                      if (data.imdb_id && newTab) {
                        newTab.location.href = `https://www.imdb.com/title/${data.imdb_id}`;
                        return;
                      }

                      newTab?.close();
                    } catch (error) {
                      newTab?.close();
                      console.error('Failed to open the trending movie', error);
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



        <section className="watchlist-section reveal-delay-2" id="watchlist" data-reveal>
          <div className="watchlist-header">
            <div>
              <h2>Watchlist</h2>
              <p className="section-kicker">Your saved movies, ready when you are</p>
            </div>
            <div className="watchlist-tools">
              <label htmlFor="watchlist-sort">Sort</label>
              <select id="watchlist-sort" value={watchlistSort} onChange={(event) => setWatchlistSort(event.target.value)}>
                <option value="recent">Recent</option>
                <option value="title">Title</option>
                <option value="rating">Rating</option>
              </select>
              <span>{watchlist.length}</span>
            </div>
          </div>

          {syncStatus && <p className="watchlist-sync-status">{syncStatus}</p>}

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
                    src={getPosterImageSource(movie.poster_path || movie.poster_url, 'w185')}
                    alt={movie.title}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="watchlist-details">
                    <p>{movie.title}</p>
                    <span>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                  </div>
                  <Link to={`/movie/${movie.id}`} className="watchlist-open-link">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="all-movies reveal-delay-3" id="all-movies" data-reveal>
          <div className="section-heading">
            <div>
              <p className="section-eyebrow">Movie library</p>
              <h2 className="text-white text-2xl font-bold">{pageHeading}</h2>
            </div>
            {!isLoading && !isSearchPending && !errorMessage && (
              <span className="result-count" aria-live="polite">{moviesList.length} titles</span>
            )}
          </div>

          {isLoading || isSearchPending ? (
            <ul className="movie-grid-skeletons">
              {Array.from({ length: 8 }, (_, index) => <MovieCardSkeleton key={index} />)}
            </ul>
          ) : errorMessage ? (
            <div className="api-error-state">
              <p>{errorMessage}</p>
              <button type="button" onClick={() => fetchMovies(debouncedSearchTerm)}>Try again</button>
            </div>
          ) : moviesList.length === 0 ? (
            activeSearchTerm ? (
              <p className="watchlist-empty">
                No movies matched &ldquo;{activeSearchTerm}&rdquo;. Try another title or clear the search.
              </p>
            ) : (
              <ul className="movie-grid-skeletons">
                {Array.from({ length: 8 }, (_, index) => <MovieCardSkeleton key={index} />)}
              </ul>
            )
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

        <div className="link-dropdowns">
          <GenreLinks title="Browse by genre" />
          <PopularLinks
            limit={120}
            title="Popular movie pages"
            description="Jump straight into a movie page to read the synopsis, cast, ratings and where to watch."
          />
        </div>
      </div>

      {isDetailOpen && selectedMovie && (
        <div className="movie-detail-backdrop" onClick={closeMovieDetail}>
          <aside
            ref={detailPanelRef}
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
                    backgroundImage: `linear-gradient(180deg, rgba(9, 13, 29, 0.08), #090d1d 92%), url(${getPosterImageSource(selectedMovie.backdrop_path, 'w780')})`,
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
                    <Link
                      className="movie-detail-button movie-detail-secondary"
                      to={`/movie/${selectedMovie.id}`}
                      onClick={closeMovieDetail}
                    >
                      Open full page
                    </Link>
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

      {watchlistToast && <div className="watchlist-toast" role="status">{watchlistToast}</div>}

      <SiteFooter />
    </main>
  );
};

export default HomePage;

