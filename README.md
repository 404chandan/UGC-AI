# 🎬 UGC Creator Studio

An AI-powered automated User Generated Content (UGC) video marketing engine. It converts raw product descriptions and website URLs into trendy, viral 9:16 vertical shorts (TikTok/Reels format) complete with vertical background footage, reaction GIFs, styled glassmorphic captions, and synced background music in under 15 seconds.

[![Demo Link](https://img.shields.io/badge/Demo-Live%20Site-brightgreen?style=for-the-badge)](https://ugc-ai-three.vercel.app)
[![GitHub Link](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge)](https://github.com/404chandan/UGC-AI)

---

## 🚀 Key Features

*   **URL Context Scraper**: Scrapes metadata, headings, and description context from any product link in seconds.
*   **Gen-Z Copywriting Engine**: Automatically generates trendy, self-aware hooks, memes, and product taglines.
*   **Automatic 9:16 Vertical Compositing**: Crops landscape stock footage to a vertical aspect ratio, loops overlay reaction GIFs, overlays caption bubbles, and blends audio.
*   **Dynamic Playlist Selector**: Randomizes background music and concept templates for each pitch to ensure content variety.
*   **Sleek Laptop-Optimized UI**: Responsive dark-mode studio featuring an iMessage-style AI chat thread and a vertical smartphone preview frame.
*   **Persistent Chat & Video History**: Full sidebar selection that swaps active video details and synchronizes chat logs seamlessly.

---

## 🛠️ Technology Stack & Core Tools

| Tool / Technology | What It Is | Why We Used It |
| :--- | :--- | :--- |
| **Vite + React (Frontend)** | Modern single-page app framework | Enables lightning-fast rendering, HMR (Hot Module Replacement), and clean modular component management. |
| **Vanilla CSS** | Core styling layer | Used for custom dark-mode aesthetics, responsive glassmorphic cards, and absolute layout responsiveness without Tailwind utility bloating. |
| **Node.js + Express (Backend)** | Server environment & API routing | Orchestrates the multi-layered scraping, AI concept generation, file downloads, and video compositing pipelines. |
| **FFmpeg Compositing Engine** | Command-line media processor | Instantly clips, scales background videos to true vertical 9:16 frames, overlays GIFs/text PNGs, and mixes/fades custom audio tracks. |
| **Playwright Header-Scraper** | Headless browser context scraper | Safely bypasses basic anti-scraping blockers to retrieve text metadata, OpenGraph tags, and page content from target links. |
| **Playwright Caption Renderer** | Headless HTML-to-PNG screen capturer | Renders gorgeous text captions with rounded corners, drop shadows, custom Outfit fonts, and full emoji support to bypass raw FFmpeg styling limits. |
| **Google Gemini AI SDK** | Gen-Z UGC planner model | Decides hooks, stock search keywords, GIF prompts, and matching sound vibes from scraped inputs. |
| **Cloudinary Media API** | Cloud-based media storage and hosting | Uploads and serves finished videos via CDN. Bypasses Render's ephemeral filesystem (which deletes local files on sleep/redeploy). |
| **MongoDB Atlas** | Cloud database | Saves chat conversations, active states, and URLs. |
| **JSON Fallback Engine** | Custom offline file database (`db_fallback.json`) | Ensures the application remains functional with offline saving during local development if MongoDB is unreachable. |

---

## 📁 Project Structure

```
├── client/                 # React Frontend
│   ├── src/                # App code, pages, and components
│   ├── public/             # Favicons and static assets
│   ├── .env                # API Base configuration
│   └── package.json
└── server/                 # Express Backend
    ├── public/             # Static public folder hosting videos/audio
    │   ├── audio/          # Curated background tracks
    │   ├── outputs/        # Locally rendered MP4 files
    │   └── cache/          # Temporary downloaded assets & caption frames
    ├── db_fallback.json    # Local JSON storage fallback
    ├── server.js           # Server routes & rendering scheduler
    ├── renderer.js         # FFmpeg composite engine
    ├── gemini.js           # LLM copywriting & concept analyzer
    ├── .env                # Secrets (Gemini, Giphy, Pexels, Cloudinary)
    └── package.json
```

---

## ⚙️ Environment Configurations

### 1. Backend Configuration (`server/.env`)
Create a `.env` file in the `/server` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_google_gemini_api_key
PEXELS_API_KEY=your_pexels_stock_videos_api_key
GIPHY_API_KEY=your_giphy_api_key

# Cloudinary Integration (Optional - Falls back to local folders if empty)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 2. Frontend Configuration (`client/.env`)
Create a `.env` file in the `/client` directory:
```env
VITE_API_BASE=http://localhost:5000
```
*(Point this to your deployed Render URL in production)*

---

## 🚀 Installation & Local Development

### 1. Start the Backend Server
```bash
cd server
npm install
npm run dev # Starts express server on http://localhost:5000
```
*Note: On startup, the server automatically downloads standard curations (MP3 tracks, Outfit fonts, and Playwright binaries).*

### 2. Start the Frontend client
```bash
cd client
npm install
npm run dev # Starts Vite server on http://localhost:5173
```

---

## ☁️ Persistent Hosting & Cloud Deployment

If you deploy your backend to **Render** and frontend to **Vercel**, you must configure the following to prevent generated videos from disappearing (due to Render's ephemeral filesystem):

### Step 1: Whitelist Render in MongoDB Atlas
1. Log into your **MongoDB Atlas Console**.
2. Go to **Network Access** (Security section on the left sidebar).
3. Click **Add IP Address**.
4. Select **Allow Access From Anywhere** (`0.0.0.0/0`) since Render IPs change dynamically.

### Step 2: Configure Cloudinary Env Variables
1. Sign up for a free account on [Cloudinary](https://cloudinary.com/).
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from the Cloudinary dashboard.
3. Open your **Render Server Dashboard** $\rightarrow$ **Environment** settings.
4. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
5. Save changes. The server will redeploy. All future videos will host permanently on Cloudinary's secure media servers.
