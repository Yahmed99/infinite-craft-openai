# NYCrafts

A NYC-themed game where players combine concepts to unlock landmarks, foods, slang, celebrities, and cultural references inspired by New York City, featuring a competitive race mode, a 3D craft map, and AI-integrated exploration.

[Visit the deployed app!](https://nycrafts.vercel.app)

## Features

### Crafting System

**Combine NYC Concepts**

- **~100 pre-seeded recipes** (bodegas, boroughs, teams, slang, celebrities, and more)
- **AI-generated recipes** for novel pairs using OpenAI embeddings + GPT (`gpt-4.1-mini`)
- Three-tier lookup: device cache → global cache → AI generation

**Starter Elements**

Person, Food, Transit, City, Money, Time, Music, Sports, Culture, Words

**Examples**

- Food + City → Bodega
- MetroCard + Subway Station → MTA
- Hip Hop + Brooklyn → Jay-Z

### Race Mode

**Daily Challenge**

- Race to craft the daily target word on a timed run
- Leaderboard ranked by fastest completion time
- Pause, resume, cancel, and restart active sessions

**Practice Mode**

- Pick any unlocked (non-starter) craft as your target
- Practice finding a crafting path without leaderboard pressure
- Uses the same sandbox crafting board as free play

### Sandbox Mode

- Freely combine elements at your own pace
- Experiment with seeded and AI-discovered recipes
- Build your personal collection on this device

### 3D Craft Map

**Global Recipe Graph**

- Interactive 3D force-directed graph of all global recipes
- Search crafts by name (up to 25 results)
- Click nodes to highlight parent/child relationships

## Installation

### Prerequisites

- Node.js
- npm
- OpenAI API key (required for new crafts)

### Setup

1. Clone the repository

```bash
git clone https://github.com/Yahmed99/NYCrafts.git
cd NYCrafts
```

2. Install all dependencies

```bash
npm run install:all
```

3. Create environment file

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
OPENAI_API_KEY=your_api_key_here
PORT=8787
DATABASE_PATH=craft.db
CORS_ORIGINS=http://localhost:5173,https://nycrafts.vercel.app
# CHALLENGE_DAILY_TZ=America/New_York
```

4. Start frontend and backend together

```bash
npm run dev
```

5. Open the app

```text
http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8787`. In production, Vercel rewrites `/api` to the Render backend.

## Data

- **SQLite** database (`craft.db` by default, configurable via `DATABASE_PATH`)
- **10 starter elements** and **~100 seeded recipes** are inserted on server startup (`server/src/db.js`)
- New AI combinations are saved globally and synced to the requesting device

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── main.jsx              # App UI: Race, Sandbox, Map, Reset
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   ├── vercel.json               # Proxies /api to Render in production
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── index.js              # Express API routes
│   │   ├── db.js                 # SQLite schema, seeds, challenge logic
│   │   ├── openai.js             # Embeddings + craft generation
│   │   ├── similarity.js         # Cosine similarity for recipe neighbors
│   │   └── utils.js              # Pair keys and name normalization
│   ├── scripts/                  # Recipe validation and DB inspection utilities
│   ├── .env.example
│   └── package.json
│
├── package.json                  # Root scripts: install:all, dev
├── package-lock.json
└── README.md
```

## Deployment

### Vercel (Frontend)

Production: [https://nycrafts.vercel.app](https://nycrafts.vercel.app)

- Build command: `npm run build --prefix client`
- Output directory: `client/dist`
- `client/vercel.json` rewrites `/api/*` → `https://infinite-craft-openai.onrender.com/api/*`

### Render (Backend)

- Host the `server/` Express app as a Web Service
- Set `OPENAI_API_KEY`, `PORT`, `DATABASE_PATH`, and `CORS_ORIGINS` (include your Vercel URL)
- Persistent disk recommended so `craft.db` survives redeploys

## API Endpoints

All device-scoped routes require header: `X-Device-Id: <uuid-v4>`

### Core

- `GET /api/health` — Backend health check
- `GET /api/elements` — Device-specific discovered elements
- `GET /api/elements/global` — All global elements
- `POST /api/combine` — Combine two crafts (`{ "a": "Food", "b": "City" }`)
- `POST /api/reset` — Reset device progress to starters

### Challenge & Practice

- `GET /api/challenge` — Daily target and leaderboard
- `POST /api/challenge/start` — Start daily challenge (`{ "playerName": "..." }`)
- `POST /api/challenge/pause` — Pause or resume timer (`{ "sessionId", "paused" }`)
- `POST /api/challenge/cancel` — Cancel active challenge
- `POST /api/challenge/finish` — Submit completed run (`{ "sessionId", "resultName" }`)
- `POST /api/practice/start` — Start practice (`{ "targetName": "Spider-Man" }`)

### Graph

- `GET /api/graph/global` — Full recipe graph (`nodes`, `edges`)

### Response Examples

**Combine (Cached Recipe)**

```json
{
  "source": "global-cache",
  "result": {
    "name": "Bodega",
    "emoji": "🏪"
  }
}
```

**Daily Challenge**

```json
{
  "target": {
    "name": "Spider-Man",
    "emoji": "🕷️"
  },
  "leaderboard": [
    {
      "playerName": "finaltest",
      "targetName": "Spider-Man",
      "durationMs": 6288,
      "completedAt": "2026-06-01 16:48:49"
    }
  ]
}
```

## Technical Stack

### Frontend

- React 19
- Vite 6
- JavaScript, CSS
- react-force-graph-3d, Three.js

### Backend

- Node.js, Express 4
- Zod request validation
- better-sqlite3 (SQLite)

### AI

- OpenAI `text-embedding-3-small` for semantic neighbors
- OpenAI `gpt-4.1-mini` for JSON craft generation
- Cosine similarity over stored pair embeddings

### Deployment

- **Vercel** — static frontend + `/api` proxy
- **Render** — Express API + SQLite

## Requirements

Root (`package.json`):

- `concurrently` (dev)

Server (`server/package.json`):

- `express`, `cors`, `dotenv`, `zod`, `better-sqlite3`, `openai`

Client (`client/package.json`):

- `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `react-force-graph-3d`, `three`

**Note:** An OpenAI API key is required for combinations that are not already in the global recipe cache.
