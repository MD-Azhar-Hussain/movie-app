const projectID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const collectionID = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;

import { Client, Databases, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectID);

const database = new Databases(client);

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
                poster_url : `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
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