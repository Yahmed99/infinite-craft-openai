import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  allElements,
  allRecipesWithEmbeddings,
  allDeviceElements,
  getRecipe,
  insertRecipe,
  getDeviceRecipe,
  insertDeviceRecipe,
  insertDeviceElement,
  resetDeviceData
} from "./db.js";

import { createEmbedding, generateCombination } from "./openai.js";
import { topSimilarRecipes } from "./similarity.js";
import { normalizeElementName, pairKey } from "./utils.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://infinite-craft-openai.vercel.app"
  ]
}));app.use(express.json({ limit: "1mb" }));

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
    const recipes = allRecipesWithEmbeddings();
    const neighbors = topSimilarRecipes(pairEmbedding, recipes, 8);

    const result = await generateCombination({ a, b, neighbors });

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
