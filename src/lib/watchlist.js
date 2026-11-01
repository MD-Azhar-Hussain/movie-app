import {
  deleteWatchlistSyncDocument,
  getWatchlistSyncDocuments,
  isWatchlistSyncConfigured,
  upsertWatchlistSyncDocument,
} from '../appwrite';

export const WATCHLIST_STORAGE_KEY = 'movie-watchlist';
export const WATCHLIST_DEVICE_KEY_STORAGE = 'movie-watchlist-device-key';
export const WATCHLIST_SYNC_QUEUE_KEY = 'movie-watchlist-sync-queue';

const hasWindow = () => typeof window !== 'undefined';

export const createDeviceKey = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `device_${timestamp}_${randomPart}`;
};

export const getOrCreateDeviceKey = () => {
  if (!hasWindow()) return '';

  try {
    const existingKey = window.localStorage.getItem(WATCHLIST_DEVICE_KEY_STORAGE);
    if (existingKey) return existingKey;

    const newKey = createDeviceKey();
    window.localStorage.setItem(WATCHLIST_DEVICE_KEY_STORAGE, newKey);
    return newKey;
  } catch {
    return '';
  }
};

/**
 * Single normalized shape for every code path (home page, movie page, remote sync).
 */
export const normalizeWatchlistEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const movieId = entry.id ?? entry.movie_id;
  if (movieId === undefined || movieId === null || movieId === '') return null;

  const numericId = Number(movieId);
  if (Number.isNaN(numericId)) return null;

  return {
    id: numericId,
    title: typeof entry.title === 'string' && entry.title ? entry.title : 'Untitled',
    poster_path: typeof entry.poster_path === 'string' ? entry.poster_path : '',
    release_date: typeof entry.release_date === 'string' ? entry.release_date : '',
    vote_average: typeof entry.vote_average === 'number' ? entry.vote_average : null,
    overview: typeof entry.overview === 'string' ? entry.overview : '',
    addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : new Date().toISOString(),
  };
};

export const normalizeWatchlist = (items) => {
  if (!Array.isArray(items)) return [];

  const deduped = new Map();

  items.forEach((item) => {
    const normalized = normalizeWatchlistEntry(item);
    if (!normalized) return;
    const idKey = String(normalized.id);
    if (!deduped.has(idKey)) deduped.set(idKey, normalized);
  });

  return Array.from(deduped.values());
};

export const mergeWatchlists = (localItems, remoteItems) => {
  const merged = new Map();

  normalizeWatchlist(remoteItems).forEach((item) => merged.set(String(item.id), item));
  normalizeWatchlist(localItems).forEach((item) => merged.set(String(item.id), item));

  return Array.from(merged.values());
};

export const createWatchlistEntry = (movie) => {
  if (!movie) return null;

  return normalizeWatchlistEntry({
    id: movie.id ?? movie.movie_id,
    title: movie.title || movie.name,
    poster_path: movie.poster_path || movie.poster_url || '',
    release_date: movie.release_date || '',
    vote_average: movie.vote_average ?? null,
    overview: movie.overview || '',
    addedAt: new Date().toISOString(),
  });
};

export const readStoredWatchlist = () => {
  if (!hasWindow()) return [];

  try {
    const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    const normalized = normalizeWatchlist(parsed);

    if (JSON.stringify(normalized) !== stored) {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch (error) {
    console.warn('Unable to read the saved watchlist, starting fresh.', error);
    try {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // Storage may be unavailable in private browsing mode.
    }
    return [];
  }
};

export const writeStoredWatchlist = (items) => {
  if (!hasWindow()) return;

  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(normalizeWatchlist(items)));
  } catch (error) {
    console.warn('Unable to persist the watchlist.', error);
  }
};

export const isMovieInWatchlist = (items, movieId) =>
  Array.isArray(items) && items.some((item) => Number(item.id) === Number(movieId));

export const toggleWatchlistItems = (items, movie) => {
  const entry = createWatchlistEntry(movie);
  if (!entry) return { items, saved: false, entry: null };

  const current = normalizeWatchlist(items);
  const exists = current.some((item) => Number(item.id) === Number(entry.id));

  if (exists) {
    return {
      items: current.filter((item) => Number(item.id) !== Number(entry.id)),
      saved: false,
      entry,
    };
  }

  return { items: [entry, ...current], saved: true, entry };
};

export const sortWatchlist = (items, sortKey = 'recent') => {
  const list = [...(Array.isArray(items) ? items : [])];

  if (sortKey === 'title') {
    return list.sort((first, second) => String(first.title).localeCompare(String(second.title)));
  }

  if (sortKey === 'rating') {
    return list.sort((first, second) => (second.vote_average || 0) - (first.vote_average || 0));
  }

  return list.sort((first, second) => new Date(second.addedAt).getTime() - new Date(first.addedAt).getTime());
};

/* ------------------------------------------------------------------ *
 * Offline-first sync queue
 * ------------------------------------------------------------------ */

export const parseSyncQueue = (serializedQueue) => {
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

export const readSyncQueue = () => {
  if (!hasWindow()) return [];
  try {
    return parseSyncQueue(window.localStorage.getItem(WATCHLIST_SYNC_QUEUE_KEY));
  } catch {
    return [];
  }
};

export const writeSyncQueue = (queueItems) => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(WATCHLIST_SYNC_QUEUE_KEY, JSON.stringify(queueItems));
  } catch (error) {
    console.warn('Unable to persist the watchlist sync queue.', error);
  }
};

/**
 * Adds a mutation to the queue, collapsing any previous mutation for the same
 * movie so repeated toggles cannot grow the queue without bound.
 */
export const enqueueWatchlistMutation = (mutation) => {
  if (!isWatchlistSyncConfigured || !hasWindow() || !mutation) return;

  const movieId = Number(mutation.movieId);
  if (Number.isNaN(movieId)) return;

  const existingQueue = readSyncQueue().filter((entry) => entry.movieId !== movieId);

  writeSyncQueue([
    ...existingQueue,
    {
      ...mutation,
      movieId,
      enqueuedAt: new Date().toISOString(),
    },
  ]);
};

/**
 * Replays queued mutations against Appwrite. Stops on the first failure and
 * leaves the remaining mutations queued for the next online event.
 */
export const flushSyncQueue = async () => {
  if (!isWatchlistSyncConfigured || !hasWindow()) {
    return { flushed: 0, pending: readSyncQueue().length };
  }

  const deviceKey = getOrCreateDeviceKey();
  if (!deviceKey) return { flushed: 0, pending: readSyncQueue().length };

  let queue = readSyncQueue();
  let flushed = 0;

  while (queue.length > 0) {
    const [mutation, ...rest] = queue;

    try {
      if (mutation.op === 'add') {
        await upsertWatchlistSyncDocument(deviceKey, mutation.movie);
      } else {
        await deleteWatchlistSyncDocument(deviceKey, mutation.movieId);
      }
    } catch (error) {
      console.warn('Watchlist sync is paused; mutations stay queued for later.', error);
      break;
    }

    queue = rest;
    writeSyncQueue(queue);
    flushed += 1;
  }

  return { flushed, pending: queue.length };
};

export const parseRemoteWatchlistDocuments = (documents) => {
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

export const fetchRemoteWatchlist = async () => {
  if (!isWatchlistSyncConfigured) return [];

  const deviceKey = getOrCreateDeviceKey();
  if (!deviceKey) return [];

  try {
    const remoteDocuments = await getWatchlistSyncDocuments(deviceKey);
    return parseRemoteWatchlistDocuments(remoteDocuments);
  } catch (error) {
    console.warn('Watchlist sync hydrate failed. Continuing with local data.', error);
    return [];
  }
};

