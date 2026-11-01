import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPosterImageSource,
  getPosterSrcSet,
  PLACEHOLDER_POSTER,
} from '../lib/poster';
import { getDownloadProviderUrl, getWatchProviderUrls, openExternalUrl } from '../lib/watchLinks';

const GENRE_NAMES = {
  12: 'Adventure', 14: 'Fantasy', 16: 'Animation', 18: 'Drama', 27: 'Horror',
  28: 'Action', 35: 'Comedy', 36: 'History', 37: 'Western', 53: 'Thriller',
  80: 'Crime', 99: 'Documentary', 878: 'Sci-Fi', 9648: 'Mystery',
  10402: 'Music', 10749: 'Romance', 10751: 'Family', 10752: 'War', 10770: 'TV Movie',
};

const MovieCard = ({ movie, onClick, isSaved, onToggleWatchlist, index = 0, hidePopularBadge = false }) => {
  const {
    id,
    title = 'Untitled movie',
    vote_average: voteAverage,
    poster_path: posterPath,
    release_date: releaseDate,
    original_language: originalLanguage,
    overview,
    genre_ids: genreIds = [],
    popularity,
    runtime,
    certification,
  } = movie;

  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [accentColor, setAccentColor] = useState('rgba(124, 93, 218, 0.22)');

  const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
  const rating = typeof voteAverage === 'number' && voteAverage > 0 ? voteAverage.toFixed(1) : 'N/A';
  const genres = genreIds.map((genreId) => GENRE_NAMES[genreId]).filter(Boolean).slice(0, 2);
  const releaseYear = Number(year);
  const badges = [
    voteAverage >= 8 ? 'Top Rated' : null,
    !hidePopularBadge && popularity >= 100 ? 'Popular' : null,
    releaseYear >= new Date().getFullYear() - 1 ? 'New' : null,
  ].filter(Boolean).slice(0, 2);

  const handlePosterLoad = (event) => {
    setImageLoaded(true);
    try {
      const image = event.currentTarget;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      setAccentColor(`rgba(${red}, ${green}, ${blue}, 0.28)`);
    } catch {
      // Cross-origin poster images can block pixel sampling; use the theme fallback.
    }
  };

  const handleOpenDetailsClick = onClick
    ? (event) => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
          onClick(event);
        }
      }
    : undefined;

  return (
    <li className="movie-card" style={{ '--card-accent': accentColor, '--card-delay': `${Math.min(index, 7) * 45}ms` }}>
      <div className="movie-card-poster-wrap">
        <Link
          to={`/movie/${id}`}
          className="movie-card-poster-button"
          onClick={handleOpenDetailsClick}
          aria-label={`Open details for ${title}`}
        >
          <img
            className="movie-card-poster"
            src={imageFailed ? PLACEHOLDER_POSTER : getPosterImageSource(posterPath)}
            srcSet={imageFailed ? undefined : getPosterSrcSet(posterPath)}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
            alt={`${title} poster`}
            loading="lazy"
            decoding="async"
            onLoad={handlePosterLoad}
            onError={() => {
              setImageFailed(true);
              setImageLoaded(true);
            }}
          />
          {!imageLoaded && <span className="movie-card-image-skeleton" aria-hidden="true" />}
          <span className="movie-card-preview">
            <strong>View details</strong>
            <span>{overview || 'Explore the cast, rating, synopsis, and more.'}</span>
          </span>
        </Link>
        <button
          type="button"
          className={`movie-save-button ${isSaved ? 'is-saved' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleWatchlist?.();
          }}
          aria-label={isSaved ? `Remove ${title} from watchlist` : `Save ${title} to watchlist`}
          aria-pressed={isSaved}
        >
          <span className="bookmark-icon" aria-hidden="true">
            {isSaved ? '★' : '☆'}
          </span>
          <span className="sr-only">{isSaved ? 'Saved' : 'Save'}</span>
        </button>
        {badges.length > 0 && (
          <div className="movie-card-badges" aria-label="Movie highlights">
            {badges.map((badge) => <span key={badge}>{badge}</span>)}
          </div>
        )}
      </div>

      <div className="movie-card-body">
        <div className="movie-card-title-row">
          <h3 title={title}>
            <Link
              to={`/movie/${id}`}
              className="hover:text-purple-400 transition"
              onClick={handleOpenDetailsClick}
            >
              {title}
            </Link>
          </h3>
          <span className="movie-card-year">{year}</span>
        </div>

        <div className="movie-card-meta">
          <span className="movie-card-rating">
            <img src="/star.svg" alt="" aria-hidden="true" />
            {rating}
          </span>
          <span className="movie-card-dot" aria-hidden="true">•</span>
          <span>{originalLanguage?.toUpperCase() || 'EN'}</span>
          {runtime ? <span>{runtime}m</span> : null}
          {certification ? <span>{certification}</span> : null}
        </div>

        {genres.length > 0 && (
          <div className="movie-card-genres" aria-label="Genres">
            {genres.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        )}

        <div className="movie-card-actions">
          <button
            type="button"
            className="movie-card-action movie-card-action-watch"
            onClick={(event) => {
              event.stopPropagation();
              const [primaryUrl] = getWatchProviderUrls(id);
              openExternalUrl(primaryUrl);
            }}
          >
            Watch
          </button>
          <button
            type="button"
            className="movie-card-action movie-card-action-download"
            onClick={(event) => {
              event.stopPropagation();
              openExternalUrl(getDownloadProviderUrl(id));
            }}
            aria-label={`Download ${title}`}
          >
            Download
          </button>
        </div>
      </div>
    </li>
  );
};

export default MovieCard;
