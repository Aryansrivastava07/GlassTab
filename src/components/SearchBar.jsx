import React, { useState, useEffect } from 'react';

const SearchBar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.id === 'searchInput') {
        if (e.ctrlKey && e.key === 'z') {
          e.preventDefault();
          setSearchQuery('');
        } else if (e.ctrlKey && e.key === 'v') {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            setSearchQuery(text);
          });
        } else if (e.shiftKey && e.key === 'Backspace') {
          e.preventDefault();
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    let searchUrl = '';
    const query = searchQuery.trim();

    if (query.startsWith('g ')) {
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query.substring(2))}`;
    } else if (query.startsWith('b ')) {
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query.substring(2))}`;
    } else if (query.startsWith('y ')) {
      searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.substring(2))}`;
    } else {
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }

    window.open(searchUrl, '_blank');
    setSearchHistory([...searchHistory, query]);
    setSearchQuery('');
  };

  return (
    <div className="flex justify-center items-center">
      <form onSubmit={handleSearch} className="relative w-full max-w-2xl">
        <div className="search-container rounded-full">
          <input
            id="searchInput"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the web..."
            className="w-full px-6 py-4 text-lg text-white bg-transparent border-none rounded-full focus:outline-none placeholder-gray-400"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/10 text-white px-6 py-2 rounded-full hover:bg-white/20 transition-all duration-200 border border-white/10"
          >
            Search
          </button>
          {/* <div className='h-20 w-20 bg-amber-100 backdrop-blur-0'></div> */}
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
