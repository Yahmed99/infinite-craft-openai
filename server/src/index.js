import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  allElements,
  allRecipesForSimilarity,
  allDeviceElements,
  getRecipe,
  insertRecipe,
  getDeviceRecipe,
  insertDeviceRecipe,
  insertDeviceElement,
  resetDeviceData,
  getElementByName,
  isStarterElement,
  getGlobalGraphRows,
  getChallengeTarget,
  createChallengeSession,
  getChallengeSession,
  getChallengeActiveDurationMs,
  setChallengePause,
  cancelChallengeSession,
  finishChallengeSession,
  getChallengeLeaderboard,
  getChallengeScoreStanding,
  updateRecipePairEmbedding
} from "./db.js";

import { createEmbedding, createEmbeddings, generateCombination } from "./openai.js";
import { topSimilarRecipes } from "./similarity.js";
import { normalizeElementName, pairKey } from "./utils.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://nycrafts.vercel.app",
  "https://infinite-craft-openai.vercel.app",
];

const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json({ limit: "1mb" }));

function getDeviceId(req) {
  const id = req.header("X-Device-Id");

  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
    return null;
  }

  return id;
}

const combineSchema = z.object({
  a: z.string().min(1).max(40),
  b: z.string().min(1).max(40)
});

const insightSchema = z.object({
  a: z.string().min(1).max(60),
  b: z.string().min(1).max(60)
});

function hasUsableEmbedding(recipe) {
  try {
    const embedding = JSON.parse(recipe.pairEmbeddingJson || "[]");
    return Array.isArray(embedding) && embedding.length > 0;
  } catch {
    return false;
  }
}

async function recipesReadyForSimilarity() {
  const recipes = allRecipesForSimilarity();
  const missing = recipes.filter((recipe) => !hasUsableEmbedding(recipe));

  if (!missing.length) return recipes;

  const embeddings = await createEmbeddings(
    missing.map((recipe) => `${recipe.a} + ${recipe.b}`),
  );

  missing.forEach((recipe, index) => {
    const embedding = embeddings[index] || [];
    updateRecipePairEmbedding(recipe.id, embedding);
    recipe.pairEmbeddingJson = JSON.stringify(embedding);
  });

  return recipes;
}

const startChallengeSchema = z.object({
  playerName: z.string().trim().min(1).max(24)
});

const startPracticeSchema = z.object({
  targetName: z.string().trim().min(1).max(60)
});

const finishChallengeSchema = z.object({
  sessionId: z.string().uuid(),
  resultName: z.string().min(1).max(60)
});

const pauseChallengeSchema = z.object({
  sessionId: z.string().uuid(),
  paused: z.boolean()
});

const cancelChallengeSchema = z.object({
  sessionId: z.string().uuid()
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/elements", (req, res) => {
  const deviceId = getDeviceId(req);

  if (!deviceId) {
    return res.status(400).json({ error: "Missing or invalid device ID." });
  }

  res.json({
    elements: allDeviceElements(deviceId)
  });
});

app.get("/api/elements/global", (req, res) => {
  res.json({
    elements: allElements()
  });
});

app.get("/api/graph/global", (req, res) => {
  try {
    const rows = getGlobalGraphRows();

    const nodeMap = new Map();
    const edges = [];

    function normalizeId(name) {
      return String(name).trim().toLowerCase();
    }

    function addNode(name, emoji = "✨") {
      const id = normalizeId(name);

      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: name,
          emoji
        });
      }
    }

    for (const row of rows) {
      const inputA = normalizeId(row.input_a_name);
      const inputB = normalizeId(row.input_b_name);
      const result = normalizeId(row.result_name);
      const recipeId = String(row.recipe_id);

      addNode(row.input_a_name, row.input_a_emoji || "✨");
      addNode(row.input_b_name, row.input_b_emoji || "✨");
      addNode(row.result_name, row.result_emoji || "✨");

      edges.push({
        id: `${recipeId}:a`,
        source: inputA,
        target: result,
        recipeId
      });

      edges.push({
        id: `${recipeId}:b`,
        source: inputB,
        target: result,
        recipeId
      });
    }

    res.json({
      nodes: Array.from(nodeMap.values()),
      edges
    });
  } catch (err) {
    console.error("Graph endpoint error:", err);
    res.status(500).json({ error: "Failed to load global graph" });
  }
});

app.post("/api/insights/similarity", async (req, res) => {
  try {
    const body = insightSchema.parse(req.body);
    const a = normalizeElementName(body.a);
    const b = normalizeElementName(body.b);

    if (!a || !b) {
      return res.status(400).json({ error: "Choose two global words." });
    }

    const elementA = getElementByName(a) || { name: a, emoji: "âœ¨" };
    const elementB = getElementByName(b) || { name: b, emoji: "âœ¨" };

    const pairText = `${elementA.name} + ${elementB.name}`;
    const pairEmbedding = await createEmbedding(pairText);
    const recipes = await recipesReadyForSimilarity();
    const neighbors = topSimilarRecipes(pairEmbedding, recipes, 8).map(
      (recipe, index) => {
        let embedding = [];

        try {
          embedding = JSON.parse(recipe.pairEmbeddingJson || "[]");
        } catch {
          embedding = [];
        }

        return {
          id: recipe.pairKey || `${recipe.a}+${recipe.b}`,
          rank: index + 1,
          a: recipe.a,
          b: recipe.b,
          resultName: recipe.resultName,
          resultEmoji: recipe.resultEmoji,
          score: recipe.score,
          vectorPreview: embedding.slice(0, 12)
        };
      },
    );

    res.json({
      pair: {
        a: elementA,
        b: elementB,
        text: pairText
      },
      embedding: {
        model: "text-embedding-3-small",
        dimensions: pairEmbedding.length,
        preview: pairEmbedding.slice(0, 12)
      },
      neighbors,
      generationPayload: {
        model: "gpt-4.1-mini",
        neighborCount: neighbors.length,
        similarRecipes: neighbors.map((neighbor) => ({
          a: neighbor.a,
          b: neighbor.b,
          resultName: neighbor.resultName
        }))
      }
    });
  } catch (error) {
    console.error("Similarity insight endpoint error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Choose two global words." });
    }

    res.status(500).json({
      error: "Could not inspect similarity vectors."
    });
  }
});

app.get("/api/challenge", (req, res) => {
  const target = getChallengeTarget();

  if (!target) {
    return res.status(500).json({ error: "Challenge target is unavailable." });
  }

  res.json({
    target,
    leaderboard: getChallengeLeaderboard(target.name)
  });
});

app.post("/api/challenge/start", (req, res) => {
  try {
    const deviceId = getDeviceId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "Missing or invalid device ID." });
    }

    const body = startChallengeSchema.parse(req.body);
    const target = getChallengeTarget();

    if (!target) {
      return res.status(500).json({ error: "Challenge target is unavailable." });
    }

    const sessionId = randomUUID();
    const startedAtMs = Date.now();

    resetDeviceData(deviceId);
    createChallengeSession({
      id: sessionId,
      deviceId,
      playerName: body.playerName.trim(),
      targetName: target.name,
      startedAtMs
    });

    res.json({
      sessionId,
      startedAtMs,
      target,
      elements: allDeviceElements(deviceId)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Choose a player name." });
    }

    console.error(error);
    res.status(500).json({ error: "Could not start challenge." });
  }
});

app.post("/api/practice/start", (req, res) => {
  try {
    const deviceId = getDeviceId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "Missing or invalid device ID." });
    }

    const body = startPracticeSchema.parse(req.body);
    const target = getElementByName(body.targetName);

    if (!target) {
      return res.status(400).json({ error: "That craft is not available yet." });
    }

    if (isStarterElement(target.name)) {
      return res.status(400).json({
        error: "Starter elements are already available. Pick a craft to combine toward."
      });
    }

    resetDeviceData(deviceId);

    res.json({
      target: {
        name: target.name,
        emoji: target.emoji
      },
      elements: allDeviceElements(deviceId)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Choose a target craft." });
    }

    console.error(error);
    res.status(500).json({ error: "Could not start practice." });
  }
});

app.post("/api/challenge/pause", (req, res) => {
  try {
    const deviceId = getDeviceId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "Missing or invalid device ID." });
    }

    const body = pauseChallengeSchema.parse(req.body);
    const session = getChallengeSession(body.sessionId);

    if (!session || session.deviceId !== deviceId) {
      return res.status(404).json({ error: "Challenge session not found." });
    }

    if (session.completedAtMs) {
      return res.status(400).json({ error: "Challenge is already finished." });
    }

    const updated = setChallengePause({
      id: session.id,
      paused: body.paused
    });

    res.json({
      session: updated,
      elapsedMs: getChallengeActiveDurationMs(updated)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid pause request." });
    }

    console.error(error);
    res.status(500).json({ error: "Could not update challenge pause." });
  }
});

app.post("/api/challenge/cancel", (req, res) => {
  try {
    const deviceId = getDeviceId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "Missing or invalid device ID." });
    }

    const body = cancelChallengeSchema.parse(req.body);
    const session = getChallengeSession(body.sessionId);

    if (!session || session.deviceId !== deviceId) {
      return res.status(404).json({ error: "Challenge session not found." });
    }

    if (session.completedAtMs) {
      return res.status(400).json({ error: "Challenge is already finished." });
    }

    const cancelled = cancelChallengeSession({
      id: session.id
    });

    res.json({ session: cancelled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid cancel request." });
    }

    console.error(error);
    res.status(500).json({ error: "Could not cancel challenge." });
  }
});

app.post("/api/challenge/finish", (req, res) => {
  try {
    const deviceId = getDeviceId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "Missing or invalid device ID." });
    }

    const body = finishChallengeSchema.parse(req.body);
    const session = getChallengeSession(body.sessionId);

    if (!session || session.deviceId !== deviceId) {
      return res.status(404).json({ error: "Challenge session not found." });
    }

    if (session.targetName.toLowerCase() !== body.resultName.trim().toLowerCase()) {
      return res.status(400).json({ error: "That result is not the target word." });
    }

    const completedAtMs = Date.now();

    if (session.pausedAtMs) {
      setChallengePause({
        id: session.id,
        paused: false,
        now: completedAtMs
      });
    }

    const activeSession = getChallengeSession(session.id);
    const durationMs = getChallengeActiveDurationMs(activeSession, completedAtMs);
    const finished = finishChallengeSession({
      id: session.id,
      completedAtMs,
      durationMs
    });
    const standing = getChallengeScoreStanding(session.id);

    res.json({
      session: finished,
      standing,
      leaderboard: getChallengeLeaderboard(session.targetName)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid challenge finish request." });
    }

    console.error(error);
    res.status(500).json({ error: "Could not finish challenge." });
  }
});

app.post("/api/combine", async (req, res) => {
  try {
    const deviceId = getDeviceId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "Missing or invalid device ID." });
    }

    const body = combineSchema.parse(req.body);

    const a = normalizeElementName(body.a);
    const b = normalizeElementName(body.b);

    if (!a || !b) {
      return res.status(400).json({ error: "Both elements are required." });
    }

    const key = pairKey(a, b);

    // Check this device's known recipe first
    const userCached = getDeviceRecipe(deviceId, key);

    if (userCached) {
      return res.json({
        source: "device-cache",
        result: {
          name: userCached.name,
          emoji: userCached.emoji
        }
      });
    }

    // Check global recipe cache
    const globalCached = getRecipe(key);

    if (globalCached) {
      insertDeviceRecipe({
        deviceId,
        pairKey: key,
        a,
        b,
        resultName: globalCached.name,
        resultEmoji: globalCached.emoji
      });

      return res.json({
        source: "global-cache",
        result: {
          name: globalCached.name,
          emoji: globalCached.emoji
        }
      });
    }

    // Generate new recipe
    const pairEmbedding = await createEmbedding(`${a} + ${b}`);
    const recipes = await recipesReadyForSimilarity();
    const neighbors = topSimilarRecipes(pairEmbedding, recipes, 8);

    const result = await generateCombination({ a, b, neighbors });

    // If word has been generated (new combination old result) use the previous emoji
    const existingElement = getElementByName(result.name);
    if (existingElement) {
      result.emoji = existingElement.emoji;
    }

    // Save globally
    insertRecipe({
      pairKey: key,
      a,
      b,
      resultName: result.name,
      resultEmoji: result.emoji,
      pairEmbedding
    });

    // Save for this device
    insertDeviceRecipe({
      deviceId,
      pairKey: key,
      a,
      b,
      resultName: result.name,
      resultEmoji: result.emoji
    });

    res.json({
      source: "generated",
      result
    });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.errors
      });
    }

    res.status(500).json({
      error: "Could not combine elements."
    });
  }
});

app.post("/api/reset", (req, res) => {
  const deviceId = getDeviceId(req);

  if (!deviceId) {
    return res.status(400).json({ error: "Missing or invalid device ID." });
  }

  resetDeviceData(deviceId);

  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
