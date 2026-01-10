import React from 'react'

const Search = ({ searchTerm , setSearchTerm}) => {
  return (
    // <div className='text-white text-3xl'>{searchTerm}</div>

    <div className='search'>
        <div>
            <img src="search.svg" alt="Search Icon" />
        
            <input type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for movies or TV series"
            />        
        </div>

    </div>
  )
}

export default Search