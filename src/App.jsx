import React, { useEffect, useState } from 'react'
import Search from './components/Search'
import Spinner from './components/Spin'
import { useDebounce } from 'react-use'
import MovieCard from './components/MovieCard'
import { getTrendingSearches, updateSearchCount } from './appwrite'
import { Helmet } from "react-helmet-async";


import { API_OPTIONS } from './api/tmdb';
const API_BASE_URL = 'https://api.themoviedb.org/3/';

const API_KEY = import.meta.env.VITE_API_KEY;

// const API_OPTIONS = {
//   method: 'GET',
//   headers: {
//     accept: 'application/json',
//     Authorization: `Bearer ${API_KEY}`,
//   },
// }

const App = () => {


  const [searchTerm, setSearchTerm] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  const [moviesList, setMoviesList] = useState([]);

  const [isLoading, setIsLoading] = useState(false);

  const [trendingMovies, setTrendingMovies] = useState([]);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useDebounce(() => {
    setDebouncedSearchTerm(searchTerm);
  }, 500, [searchTerm])




  const loadTrendingMovies = async () => {
    try {
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

      if (query && data.results.length > 0) {
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
      
      <Helmet>
        <title>MovieVerse | Discover Trending & Popular Movies</title>

        <meta
          name="description"
          content="Search and explore trending movies with cinematic UI, real-time popularity, ratings, and direct IMDb links."
        />

        <meta name="keywords" content="movies, trending movies, IMDb, TMDB, movie search, film discovery" />

        {/* Open Graph for social sharing */}
        <meta property="og:title" content="MovieVerse – Discover Movies You'll Enjoy" />
        <meta
          property="og:description"
          content="A futuristic movie discovery platform with trending analytics and IMDb integration."
        />
        <meta property="og:image" content="/hero.png" />
        <meta property="og:type" content="website" />

        {/* Twitter preview */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MovieVerse – Discover Movies You'll Enjoy" />
        <meta
          name="twitter:description"
          content="Search trending and popular movies with ratings and direct IMDb access."
        />
        <meta name="twitter:image" content="/hero.png" />
      </Helmet>


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

        {trendingMovies.length > 0 && (
          <section className="trending">
            <h2 className="text-white text-2xl font-bold mb-4">
              Trending Searches
            </h2>
            <ul>
              {trendingMovies.map((movie, index) => (
                <li
                  key={movie.$id}
                  className="trending-item cursor-pointer"
                  onClick={async () => {
                    const newTab = window.open('', '_blank'); // open instantly

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
                      console.error("Failed to fetch IMDb ID", err);
                    }
                  }}
                >
                  <p>{index + 1}</p>
                  <img src={movie.poster_url} alt={movie.searchTerm} />
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
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onClick={async () => {
                      const newTab = window.open('', '_blank'); // opens immediately

                      try {
                        const res = await fetch(
                          `https://api.themoviedb.org/3/movie/${movie.id}`,
                          API_OPTIONS
                        );
                        const data = await res.json();

                        if (data.imdb_id) {
                          newTab.location.href = `https://www.imdb.com/title/${data.imdb_id}`;
                        }
                      } catch (err) {
                        newTab.close();
                        console.error("Failed to fetch IMDb ID", err);
                      }
                    }}
                  />

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