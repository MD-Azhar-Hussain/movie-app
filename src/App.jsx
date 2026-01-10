import React, { use, useEffect, useState } from 'react'
import Search from './components/search'
import Spinner from './components/Spin'
import {useDebounce} from 'react-use'
import MovieCard from './components/MovieCard';
import { getTrendingSearches, updateSearchCount } from './appwrite';

const API_BASE_URL = 'https://api.themoviedb.org/3/';

const API_KEY = import.meta.env.VITE_API_KEY;

const API_OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  },
}

const App = () => {


  const [searchTerm, setSearchTerm] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  const [moviesList, setMoviesList] = useState([]);

  const [isLoading, setIsLoading] = useState(false);

  const [trendingMovies, setTrendingMovies] = useState([]);

  const[debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useDebounce( () =>{
    setDebouncedSearchTerm(searchTerm);
  }, 500, [searchTerm] )


  const loadTrendingMovies = async () => {
    try{
      const movies = await getTrendingSearches();

      setTrendingMovies(movies);
      console.log('Trending Movies:', movies);
    } catch (error) {
      console.log(`Error Fetching Trending Movies : ${error}`);
      // setErrorMessage('Failed to fetch trending movies. Please try again later.'); -- DOnt use couse it breaks
    }
  }

  const fetchMovies = async (query = '') => {

    setIsLoading(true);
    setErrorMessage('');
    try {
      const endpoint = query ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}` : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;
      const response = await fetch(endpoint, API_OPTIONS);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log(data.results);
      setMoviesList(data.results);
     
      if(query && data.results.length > 0){
        await updateSearchCount(query, data.results[0]);
      }
      
    } catch (error) {
      console.error('Error fetching movies:', error);
      setErrorMessage('Failed to fetch movies. Please try again later.');
    } finally {
      setIsLoading(false);
      
    }
  }

  useEffect(() => {
    fetchMovies(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    loadTrendingMovies();
  }, []);
  return (
    <main>
      <div className="pattern" />

      <div className="wrapper">
        <header>
          <img src="./hero.png" alt="Hero Banner" />
          <h1>Find <span className="text-gradient">Movies</span> You'll Enjoy</h1>

          <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          {/* <h1 text-white text-3xl>
        You are searching for: {searchTerm}
      </h1> */}

        </header>
          
        {trendingMovies.length > 0 &&(
          <section className="trending">
            <h2 className="text-white text-2xl font-bold mb-4">
              Trending Searches
            </h2> 
            <ul>
              {trendingMovies.map((movie, index) => (
                <li key={movie.$id} className="trending-item">
                  <p>{index+1}</p>
                  <img src={movie.poster_url} alt={movie.title} />
                </li>
              ))}
            </ul>
          </section>  
        )

        }

        <section className="all-movies">

          <h2 className="text-white text-2xl font-bold mb-40px mt-[40px]" >
            All Movies
          </h2>

          {isLoading ? (
            <Spinner />
        
          ) : errorMessage ? (
            <p className='text-red-500'>{errorMessage}</p>
          ) : (
            <ul>
              {
                moviesList.map((movie) => (
                  // <p key ={movie.id} className='text-white'>{movie.title}</p>
                  <MovieCard key={movie.id} movie={movie} />
                 ))
              }
            </ul>
          )}
        </section>






      </div>

    </main>
  )
}

export default App