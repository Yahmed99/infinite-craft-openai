# NYCrafts

A NYC-themed crafting game where players combine concepts to unlock iconic landmarks, foods, neighborhoods, sports teams, slang, famous New Yorkers, and cultural references inspired by New York City.

[Visit the deployed app!](https://nycrafts.vercel.app)

## Features

### Crafting System

**Combine NYC Concepts**

* Discover new items by combining two existing concepts
* Progress from starter elements to iconic NYC discoveries
* Unlock handcrafted NYC-themed recipes and AI-generated combinations

**Examples**

* Food + Money → Dollar Slice
* MetroCard + Subway Station → MTA
* Hip Hop + Brooklyn → Jay-Z

### Game Modes

#### Daily Challenge

* Race to craft the daily target item
* Compare fastest runs on the leaderboard
* Restart or continue active challenge sessions

#### Practice Mode

* Choose a specific craft as your target
* Practice finding a path without daily challenge pressure
* Search available crafts and work toward your selected goal

#### Sandbox Mode

* Freely combine elements
* Experiment with known and generated recipes
* Discover new NYC-themed crafts at your own pace

### Interactive Crafting Map

**3D Craft Graph**

* Explore the full global recipe graph
* Search for specific crafts
* View parent and child craft relationships

### Progress Tracking

* Crafted item collection
* Reset progress option
* Persistent challenge sessions

## Installation

### Prerequisites

* Node.js
* npm
* OpenAI API Key

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

3. Create a `.env` file inside the `server/` folder

```env
OPENAI_API_KEY=your_api_key_here
PORT=8787
```

4. Start both frontend and backend

```bash
npm run dev
```

5. Open the app

```text
http://localhost:5173
```

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── db.js
│   │   ├── index.js
│   │   ├── openai.js
│   │   ├── similarity.js
│   │   └── utils.js
│   ├── .env.example
│   └── package.json
│
├── package.json
├── package-lock.json
└── README.md
```

## API Endpoints

### Core

* `GET /api/health` — Check backend status
* `GET /api/elements` — Get device-specific discovered elements
* `GET /api/elements/global` — Get all global elements
* `POST /api/combine` — Combine two crafts
* `POST /api/reset` — Reset device progress

### Challenge & Practice

* `GET /api/challenge` — Get daily challenge target and leaderboard
* `POST /api/challenge/start` — Start a daily challenge
* `POST /api/challenge/pause` — Pause or resume a challenge
* `POST /api/challenge/cancel` — Cancel a challenge
* `POST /api/challenge/finish` — Submit a completed challenge
* `POST /api/practice/start` — Start practice mode with a selected target

### Graph

* `GET /api/graph/global` — Load the full recipe graph

## Technical Stack

### Frontend

* React
* Vite
* JavaScript
* CSS

### Backend

* Node.js
* Express

### Database

* SQLite

### AI

* OpenAI Embeddings
* GPT-powered craft generation
* Semantic similarity matching

### Visualization

* React Force Graph
* Three.js 3D graph rendering

### Deployment

* Vercel Frontend
* Render Backend
