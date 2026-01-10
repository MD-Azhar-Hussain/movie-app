import React from 'react'

const MovieCard = ({ movie: { id, title, vote_average, poster_path, release_date, original_language } }) => {
  return (
    <div className='movie-card' onMouseMove={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      e.currentTarget.style.setProperty('--x', `${x}%`);
      e.currentTarget.style.setProperty('--y', `${y}%`);
    }}
    >
      {/* <p key={id} className='text-white'>{title}</p> */}

      <img src={`${poster_path ? 'https://image.tmdb.org/t/p/w500' + poster_path : '/no-movie.png'}`} alt={title} />

      <div className='mt-4'>
        <h3>{title}</h3>

        <div className='content'>
          <div className='rating'>
            <img src="star.svg" alt="🔥" />
            <p>{vote_average ? vote_average.toFixed(1) : 'N/A'}</p>
          </div>

          <span>💠</span>

          <p className='lang'>{original_language}</p>

          <span className='year'>
            {
              release_date ? release_date.split('-')[0] : 'N/A'
            }
          </span>
        </div>

      </div>
    </div>
  )
}

export default MovieCard