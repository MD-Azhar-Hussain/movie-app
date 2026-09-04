import React from 'react'

const MovieCardSkeleton = () => (
  <li className='movie-card movie-card-skeleton' aria-hidden='true'>
    <div className='skeleton-poster' />
    <div className='skeleton-line skeleton-title' />
    <div className='skeleton-line skeleton-meta' />
    <div className='skeleton-actions'>
      <div className='skeleton-button' />
      <div className='skeleton-button skeleton-button-wide' />
    </div>
  </li>
)

export default MovieCardSkeleton