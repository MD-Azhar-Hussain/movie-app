import { Client, Databases, ID, Query } from 'appwrite';
import { getPosterImageSource } from './lib/poster';

const projectID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const collectionID = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
const watchlistCollectionID = import.meta.env.VITE_APPWRITE_WATCHLIST_COLLECTION_ID;
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;

const isSearchTrackingConfigured = Boolean(projectID && databaseID && collectionID && endpoint);

// Trending is optional: set VITE_APPWRITE_TRENDING=off to skip the request
// entirely (useful when the collection does not allow anonymous reads, which
// otherwise logs a 403 in the browser console on every page load).
const isTrendingDisabled =
  String(import.meta.env.VITE_APPWRITE_TRENDING || '').toLowerCase() === 'off';
const TRENDING_FAILURE_KEY = 'movie-trending-unavailable';

const hasTrendingFailedThisSession = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(TRENDING_FAILURE_KEY) === '1';
  } catch {
    return false;
  }
};

const rememberTrendingFailure = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(TRENDING_FAILURE_KEY, '1');
  } catch {
    // Session storage may be unavailable.
  }
};

const client = isSearchTrackingConfigured ||
  Boolean(projectID && databaseID && endpoint && watchlistCollectionID)
  ? new Client().setEndpoint(endpoint).setProject(projectID)
  : null;

const database = client ? new Databases(client) : null;

export const isWatchlistSyncConfigured = Boolean(
  projectID && databaseID && endpoint && watchlistCollectionID
);

const getWatchlistSyncCollectionId = () => {
  if (!watchlistCollectionID || !databaseID) return null;
  return { databaseId: databaseID, collectionId: watchlistCollectionID };
};

export const updateSearchCount = async (searchTerm, movie) => {
  if (!isSearchTrackingConfigured || !database) return;

  try {
    // 1. Look up an existing document for this search term and bump its count.
    const result = await database.listDocuments(databaseID, collectionID, [
      Query.equal('searchTerm', searchTerm),
    ]);

    if (result.documents.length > 0) {
      const doc = result.documents[0];

      await database.updateDocument(databaseID, collectionID, doc.$id, {
        count: doc.count + 1,
      });
      return;
    }

    // 2. Otherwise create a new document with count 1.
    await database.createDocument(databaseID, collectionID, ID.unique(), {
      searchTerm,
      count: 1,
      movie_id: movie?.id,
      poster_url: getPosterImageSource(movie?.poster_path),
    });
  } catch (error) {
    console.warn('Unable to update search analytics:', error);
  }
};

export const getTrendingSearches = async () => {
  if (!isSearchTrackingConfigured || !database || isTrendingDisabled) return [];
  if (hasTrendingFailedThisSession()) return [];

  try {
    const result = await database.listDocuments(databaseID, collectionID, [
      Query.orderDesc('count'),
      Query.limit(10),
    ]);
    return result.documents;
  } catch (error) {
    // 401/403 means the collection is not readable anonymously. Remember it for
    // the session so the console is not spammed on every navigation.
    if ([401, 403].includes(Number(error?.code))) rememberTrendingFailure();
    console.warn('Trending searches are unavailable:', error?.message || error);
    return [];
  }
};

export const getWatchlistSyncDocuments = async (deviceKey) => {
  const syncCollection = getWatchlistSyncCollectionId();
  if (!syncCollection || !deviceKey || !database) return [];

  try {
    const result = await database.listDocuments(
      syncCollection.databaseId,
      syncCollection.collectionId,
      [Query.equal('device_key', deviceKey), Query.orderDesc('updated_at'), Query.limit(200)]
    );

    return result.documents;
  } catch (error) {
    console.warn('Unable to read remote watchlist documents:', error);
    throw error;
  }
};

export const upsertWatchlistSyncDocument = async (deviceKey, movie) => {
  const syncCollection = getWatchlistSyncCollectionId();
  if (!syncCollection || !deviceKey || !database || !movie || movie.id === undefined || movie.id === null) {
    return;
  }

  const numericMovieId = Number(movie.id);
  if (Number.isNaN(numericMovieId)) return;

  const data = {
    device_key: deviceKey,
    movie_id: numericMovieId,
    payload: JSON.stringify(movie),
    updated_at: new Date().toISOString(),
  };

  try {
    const existing = await database.listDocuments(
      syncCollection.databaseId,
      syncCollection.collectionId,
      [Query.equal('device_key', deviceKey), Query.equal('movie_id', numericMovieId), Query.limit(1)]
    );

    if (existing.documents.length > 0) {
      await database.updateDocument(
        syncCollection.databaseId,
        syncCollection.collectionId,
        existing.documents[0].$id,
        data
      );
      return;
    }

    await database.createDocument(
      syncCollection.databaseId,
      syncCollection.collectionId,
      ID.unique(),
      data
    );
  } catch (error) {
    console.warn('Unable to upsert the remote watchlist document:', error);
    throw error;
  }
};

export const deleteWatchlistSyncDocument = async (deviceKey, movieId) => {
  const syncCollection = getWatchlistSyncCollectionId();
  if (!syncCollection || !deviceKey || !database || movieId === undefined || movieId === null) {
    return;
  }

  const numericMovieId = Number(movieId);
  if (Number.isNaN(numericMovieId)) return;

  try {
    const existing = await database.listDocuments(
      syncCollection.databaseId,
      syncCollection.collectionId,
      [Query.equal('device_key', deviceKey), Query.equal('movie_id', numericMovieId), Query.limit(50)]
    );

    for (const document of existing.documents) {
      await database.deleteDocument(
        syncCollection.databaseId,
        syncCollection.collectionId,
        document.$id
      );
    }
  } catch (error) {
    console.warn('Unable to delete the remote watchlist document:', error);
    throw error;
  }
};
