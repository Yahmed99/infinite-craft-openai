import { readFileSync } from "node:fs";
import { pairKey } from "../src/utils.js";

const src = readFileSync(new URL("../src/db.js", import.meta.url), "utf8");
const seedMatch = src.match(/const seedElements = \[([\s\S]*?)\];/);
const recipeMatch = src.match(/const starterRecipes = \[([\s\S]*?)\];/);

const seeds = [...seedMatch[1].matchAll(/\["([^"]+)"/g)].map((m) => m[1]);
const recipes = [
  ...recipeMatch[1].matchAll(
    /\[\s*"[^"]+",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g,
  ),
].map((m) => ({ a: m[1], b: m[2], result: m[3] }));

const keys = new Map();
for (const recipe of recipes) {
  const key = pairKey(recipe.a, recipe.b);

  if (keys.has(key)) {
    console.error("DUPLICATE KEY", key, keys.get(key), "vs", recipe.result);
    process.exit(1);
  }

  keys.set(key, recipe.result);
}

const known = new Set(seeds.map((name) => name.toLowerCase()));
let changed = true;

while (changed) {
  changed = false;

  for (const recipe of recipes) {
    if (!known.has(recipe.result.toLowerCase())) {
      known.add(recipe.result.toLowerCase());
      changed = true;
    }
  }
}

const missing = [];

for (const recipe of recipes) {
  if (!known.has(recipe.a.toLowerCase())) {
    missing.push(`${recipe.a} (in ${recipe.a} + ${recipe.b})`);
  }

  if (!known.has(recipe.b.toLowerCase())) {
    missing.push(`${recipe.b} (in ${recipe.a} + ${recipe.b})`);
  }
}

console.log(`starters: ${seeds.length}`);
console.log(`recipes: ${recipes.length}`);

if (missing.length) {
  console.error("unreachable inputs:", [...new Set(missing)]);
  process.exit(1);
}

console.log("ok: no duplicate pair keys; all recipes trace to starters");
