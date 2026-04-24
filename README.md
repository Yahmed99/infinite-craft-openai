# Infinite Craft-style app with OpenAI embeddings

A small full-stack starter inspired by Neal Agarwal's Infinite Craft mechanic:
combine two elements, cache the result, and use OpenAI + embeddings to make new combinations feel consistent.

## Stack

- React + Vite frontend
- Express backend
- SQLite local database
- OpenAI embeddings for similarity memory
- OpenAI chat completion for generating new item results

## Setup

```bash
cd infinite-craft-openai
npm run install:all
cp server/.env.example server/.env
```

Edit `server/.env`:

```bash
OPENAI_API_KEY=your_key_here
PORT=8787
```

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## How it works

1. The frontend sends `{ a, b }` to `/api/combine`.
2. The backend sorts and normalizes the pair into a stable key.
3. If the recipe already exists, it returns the cached result.
4. If not, it embeds the pair text and retrieves similar past recipes.
5. It asks the model for one concise, intuitive result.
6. It saves the recipe and the new element.