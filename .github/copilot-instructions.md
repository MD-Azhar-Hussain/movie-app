# Copilot Instructions for FilmPoint

## Project overview
- Single-page React app built with Vite. Entry wiring is in src/main.jsx which mounts src/App.jsx.
- App data flow:
  - TMDB API requests are built in src/App.jsx using API options from src/api/tmdb.js.
  - Trending searches are stored in Appwrite; reads/writes are encapsulated in src/appwrite.js.
  - UI components live in src/components (Search, MovieCard, Spin) and are composed in App.jsx.

## External services & env vars
- TMDB: requires VITE_API_KEY (Bearer token). API options live in src/api/tmdb.js.
- Appwrite: requires VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, VITE_APPWRITE_COLLECTION_ID, VITE_APPWRITE_ENDPOINT. Appwrite client and queries are in src/appwrite.js.
- Appwrite documents store: searchTerm, count, movie_id, poster_url. Trending is derived by ordering by count.

## Key patterns & conventions
- Search is debounced in App.jsx using react-use useDebounce; UI should set searchTerm and rely on debouncedSearchTerm for API calls.
- Movie cards and trending items open IMDb links by fetching the TMDB movie detail endpoint for imdb_id before redirecting.
- TMDB image URLs are built with https://image.tmdb.org/t/p/w500 and the poster_path.
- Spinner UI uses Flowbite components in src/components/Spin.jsx.

## Developer workflows
- Install dependencies: npm install
- Run dev server: npm run dev (Vite, default http://localhost:5173)
- Build: npm run build
- Lint: npm run lint
- Preview build: npm run preview

## Files to reference
- App logic and API orchestration: src/App.jsx
- Appwrite integration and trending logic: src/appwrite.js
- TMDB request headers: src/api/tmdb.js
- UI components: src/components/*.jsx
- Environment setup and deployment notes: README.md
