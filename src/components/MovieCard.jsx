import React from 'react'

const MovieCard = ({ movie: { id, title, vote_average, poster_path, release_date, original_language }, onClick }) => {
  const handleActionClick = (event, url) => {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openWithFallbacks = async (event, primaryUrl, fallbackUrls = []) => {
    event.stopPropagation();

    const urls = [primaryUrl, ...fallbackUrls];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (newWindow) {
          return;
        }

        return;
      } catch {
        continue;
      }
    }

    window.open(primaryUrl, '_blank', 'noopener,noreferrer');
  };

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

      <div className='movie-image' onClick={onClick}>
        <img src={`${poster_path ? 'https://image.tmdb.org/t/p/w500' + poster_path : '/no-movie.png'}`} alt={title} />
      </div>

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

        <div className='movie-actions mt-4 flex items-center justify-between gap-2'>
          <button
            type='button'
            className='movie-action-btn rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-600'
            onClick={(event) => openWithFallbacks(event, `https://cinespot.to/movie/${id}`, [
              `https://doomflix.to/movie/${id}`,
              `https://guideflix.to/movie/${id}`,
              `https://indexflix.to/movie/${id}`,
              `https://streamiloo.to/movie/${id}`,
              `https://streamzy.to/movie/${id}`,
            ])}
          >
            Watch
          </button>
          <button
            type='button'
            className='movie-action-btn ml-auto rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600'
            onClick={(event) => handleActionClick(event, `https://vidvault.ru/movie/${id}`)}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

export default MovieCard