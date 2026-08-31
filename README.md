🎬 FilmPoint – Movie Discovery App

Live Demo: https://filmpoint.vercel.app/

A modern movie discovery web app built with React + Vite + Appwrite + TMDB API.
Search movies, explore trending searches, and get real-time recommendations.

🚀 Features

Movie search using TMDB API

Trending searches powered by Appwrite Database

Debounced search for performance

Clean UI with Tailwind / custom styling

Fully deployed on Vercel

🛠 Tech Stack

React (Vite)

Appwrite (Database & API)

TMDB API

Vercel (Deployment)

📦 Installation
git clone https://github.com/MD-Azhar-Hussain/mchck.git
cd mchck
npm install

🔐 Environment Variables

Create a .env file in the root directory and add:

VITE_API_KEY=YOUR_TMDB_BEARER_TOKEN

VITE_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
VITE_APPWRITE_PROJECT_NAME=Movie-Suggestion
VITE_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
VITE_APPWRITE_DATABASE_ID=YOUR_DATABASE_ID
VITE_APPWRITE_COLLECTION_ID=YOUR_COLLECTION_ID

# Optional: enable watchlist background sync
VITE_APPWRITE_WATCHLIST_COLLECTION_ID=YOUR_WATCHLIST_COLLECTION_ID

🔑 How to Get These Keys
1️⃣ TMDB API Key

Go to: https://www.themoviedb.org/settings/api

Create an API key

Copy the Bearer Token (v4 auth)

Paste into:

VITE_API_KEY=eyJhbGciOi...

2️⃣ Appwrite Keys

Go to: https://cloud.appwrite.io

Create a Project

Go to Settings → General

Copy Project ID → VITE_APPWRITE_PROJECT_ID

Go to Databases

Create Database → Copy ID → VITE_APPWRITE_DATABASE_ID

Create Collection → Copy ID → VITE_APPWRITE_COLLECTION_ID

Endpoint will be:

https://nyc.cloud.appwrite.io/v1


Go to Integrations → Platforms

Add Web App

Hostname: localhost and *.vercel.app

🗂 Optional Watchlist Sync Collection

To enable the local-first + background sync watchlist flow, create a separate Appwrite collection and use its ID in VITE_APPWRITE_WATCHLIST_COLLECTION_ID.

Required attributes:
- device_key (string, required)
- movie_id (integer, required)
- payload (string, required)
- updated_at (string, required)

Recommended indexes:
- device_key
- movie_id
- optional combined index on device_key + movie_id

If VITE_APPWRITE_WATCHLIST_COLLECTION_ID is not set, watchlist stays fully local (localStorage only).

▶ Run Locally
npm run dev


App runs at:

http://localhost:5173

🌐 Deploy on Vercel

Push project to GitHub

Go to https://vercel.com/new

Import GitHub repo

Add same .env variables in:

Project → Settings → Environment Variables

Deploy 🎉

📸 Preview

Live Site: https://filmpoint.vercel.app/

👨‍💻 Author

MD Azhar Hussain
CSE (IoT) | Frontend Developer | Cloud & API Integrations
GitHub: https://github.com/MD-Azhar-Hussain
