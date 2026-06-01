# NYCrafts

A NYC-themed game where players combine crafts to unlock iconic landmarks, foods, neighborhoods, slang, and other famous cultural references to celebrate New York City!

[Visit the deployed app!](https://nycrafts.vercel.app)

## Features

### Crafting System

**Combine NYC Concepts**

* Discover new items by combining two existing concepts
* Progress from simple starter nodes to iconic NYC discoveries
* Explore hundreds of handcrafted relationships inspired by New York City culture

**Examples**

* Pizza + Fold → New York Slice
* Bronx + Baseball → Yankees
* Subway + Card → MetroCard

### Multiple Game Modes

#### Race Mode

* Compete to discover a randomly selected NYC target item
* Track crafting progress and discovery chains
* Challenge friends to find the fastest path

#### Practice Mode

* Learn crafting mechanics without competitive pressure
* Experiment with combinations
* Explore the knowledge graph freely

#### Sandbox Mode

* Unlimited exploration
* Access the complete crafting system
* Discover hidden recipes and rare combinations

### Interactive 3D Craft Map

**Knowledge Graph Visualization**

* Explore the entire crafting universe in 3D
* Visualize relationships between crafts
* Identify crafting paths and discovery chains

**Graph Features**

* Zoom, rotate, and navigate freely
* Visualize parent-child relationships
* Track progression through the graph

### Progress Tracking

* Crafted item collection
* Reset progress functionality
* Daily challenges and competitive gameplay

## Installation

### Prerequisites

* Node.js 18+
* npm
* OpenAI API Key

### Setup

1. Clone the repository

```bash
git clone https://github.com/Yahmed99/NYCrafts.git
cd NYCrafts
```

2. Install dependencies

```bash
npm install
```

3. Create environment file

```bash
OPENAI_API_KEY=your_api_key_here
```

4. Start the backend

```bash
npm run server
```

5. Start the frontend

```bash
npm run client
```

6. Open

```text
http://localhost:5173
```

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── graph/
│   │   ├── game/
│   │   └── assets/
│
├── server/
│   ├── routes/
│   ├── database/
│   ├── embeddings/
│   └── api/
│
├── recipes.db
├── package.json
├── README.md
└── vite.config.js
```

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

### Visualization

* React Force Graph 3D
* Three.js

### Deployment

* Vercel
* Render
