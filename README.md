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
