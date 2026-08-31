import React from 'react'

const Search = ({ searchTerm, setSearchTerm, recentSearches = [], onSelectRecentSearch }) => {
  return (
    <div className='search-wrap'>
      <div className='search'>
        <div>
          <img src="search.svg" alt="Search Icon" />

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for movies or TV series"
            aria-label="Search movies"
          />
        </div>
      </div>

      {recentSearches.length > 0 && (
        <div className='recent-searches' aria-label='Recent searches'>
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