import React from 'react'

const Search = ({ searchTerm, setSearchTerm, recentSearches = [], onSelectRecentSearch, onClearRecentSearches, onRandomSearch, isLoading }) => {
  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <div className='search-wrap'>
      <div className='search-row'>
        <form className='search' onSubmit={handleSubmit} role='search'>
        <div>
          <img src="search.svg" alt="" aria-hidden="true" />

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for movies or TV series"
            aria-label="Search movies"
          />

          {searchTerm && (
            <button
              type='button'
              className='search-clear'
              onClick={() => setSearchTerm('')}
              aria-label='Clear search'
            >
              ×
            </button>
          )}
        </div>
        <span className='search-status' aria-live='polite'>
          {isLoading ? 'Searching...' : searchTerm ? 'Results update as you type' : 'Discover something new'}
        </span>
        </form>
        <button
          type='button'
          className='random-search-button'
          onClick={onRandomSearch}
          aria-label='Choose a personalized random movie search'
          title='Pick a movie based on your activity'
        >
          <span className='random-search-icon' aria-hidden='true'>✦</span>
          <span>Random pick</span>
        </button>
      </div>

      {recentSearches.length > 0 && (
        <div className='recent-searches' aria-label='Recent searches'>
          <div className='recent-searches-header'>
            <span>Recent searches</span>
            <button
              type='button'
              className='clear-recent-searches'
              onClick={onClearRecentSearches}
              aria-label='Clear search history'
              title='Clear search history'
            >
              <span aria-hidden='true'>×</span>
              <span>Clear</span>
            </button>
          </div>
          <div className='recent-searches-list'>
            {recentSearches.map((recentSearch) => (
              <button
                key={recentSearch}
                type='button'
                className='recent-search-chip'
                onClick={() => onSelectRecentSearch?.(recentSearch)}
                aria-label={`Search for ${recentSearch}`}
              >
                {recentSearch}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Search