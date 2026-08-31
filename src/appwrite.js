const projectID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const collectionID = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
const watchlistCollectionID = import.meta.env.VITE_APPWRITE_WATCHLIST_COLLECTION_ID;
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;

import { Client, Databases, ID, Query } from 'appwrite';

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

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectID);

const database = new Databases(client);

export const isWatchlistSyncConfigured = Boolean(
    projectID && databaseID && endpoint && watchlistCollectionID
);

const getWatchlistSyncCollectionId = () => {
    if (!watchlistCollectionID || !databaseID) return null;
    return { databaseId: databaseID, collectionId: watchlistCollectionID };
};

export const updateSearchCount = async (searchTerm, movie) => {
    // console.log(projectID,databaseID,collectionID,endpoint);

    //1. Use Appwrite API fro search term that already exists, then update its count
    try{
        const result = await database.listDocuments(databaseID,collectionID,[
            Query.equal('searchTerm',searchTerm),
        ]);
        if(result.documents.length > 0){
            const doc = result.documents[0];

            await database.updateDocument(databaseID,collectionID,doc.$id,{
                count: doc.count + 1,
            });
            console.log(`Updated search count for "${searchTerm}" to ${doc.count + 1}`);
            return;
        } else {
             //2. If search term does not exist, create a new document with count 1

             await database.createDocument(databaseID,collectionID,ID.unique(),{
                searchTerm,
                count :1 ,
                movie_id : movie.id,
                poster_url : getPosterImageSource(movie.poster_path),
            })      
        }

    } catch(error){
        console.error('Error updating search count:', error);
    }

}

export const getTrendingSearches = async () => {
    try{
        const result = await database.listDocuments(databaseID,collectionID,[
            Query.orderDesc('count'),
            Query.limit(10),
        ]);
        return result.documents;
    } catch(error){
        console.error('Error fetching trending searches:', error);
        return [];
    }
};

export const getWatchlistSyncDocuments = async (deviceKey) => {
    const syncCollection = getWatchlistSyncCollectionId();
    if (!syncCollection || !deviceKey) return [];

    try {
        const result = await database.listDocuments(syncCollection.databaseId, syncCollection.collectionId, [
            Query.equal('device_key', deviceKey),
            Query.orderDesc('updated_at'),
            Query.limit(200),
        ]);

        return result.documents;
    } catch (error) {
        console.error('Error fetching watchlist sync documents:', error);
        throw error;
    }
};

export const upsertWatchlistSyncDocument = async (deviceKey, movie) => {
    const syncCollection = getWatchlistSyncCollectionId();
    if (!syncCollection || !deviceKey || !movie || movie.id === undefined || movie.id === null) {
        return;
    }

    const numericMovieId = Number(movie.id);
    if (Number.isNaN(numericMovieId)) return;

    const now = new Date().toISOString();
    const data = {
        device_key: deviceKey,
        movie_id: numericMovieId,
        payload: JSON.stringify(movie),
        updated_at: now,
    };

    try {
        const existing = await database.listDocuments(syncCollection.databaseId, syncCollection.collectionId, [
            Query.equal('device_key', deviceKey),
            Query.equal('movie_id', numericMovieId),
            Query.limit(1),
        ]);

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
        console.error('Error upserting watchlist sync document:', error);
        throw error;
    }
};

export const deleteWatchlistSyncDocument = async (deviceKey, movieId) => {
    const syncCollection = getWatchlistSyncCollectionId();
    if (!syncCollection || !deviceKey || movieId === undefined || movieId === null) {
        return;
    }

    const numericMovieId = Number(movieId);
    if (Number.isNaN(numericMovieId)) return;

    try {
        const existing = await database.listDocuments(syncCollection.databaseId, syncCollection.collectionId, [
            Query.equal('device_key', deviceKey),
            Query.equal('movie_id', numericMovieId),
            Query.limit(50),
        ]);

        for (const document of existing.documents) {
            await database.deleteDocument(syncCollection.databaseId, syncCollection.collectionId, document.$id);
        }
    } catch (error) {
        console.error('Error deleting watchlist sync document:', error);
        throw error;
    }
};