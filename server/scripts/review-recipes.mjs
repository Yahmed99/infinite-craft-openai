import { readFileSync } from "node:fs";
import { pairKey } from "../src/utils.js";

const src = readFileSync(new URL("../src/db.js", import.meta.url), "utf8");
const seedMatch = src.match(/const seedElements = \[([\s\S]*?)\];/);
const recipeMatch = src.match(/const starterRecipes = \[([\s\S]*?)\];/);

const seeds = [...seedMatch[1].matchAll(/\["([^"]+)",\s*"([^"]+)"/g)].map((m) => ({
  name: m[1],
  emoji: m[2],
}));

const recipes = [
  ...recipeMatch[1].matchAll(
    /\[\s*"[^"]+",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g,
  ),
].map((m) => ({ a: m[1], b: m[2], result: m[3], emoji: m[4] }));

const issues = [];
const warnings = [];

// Duplicate pair keys
const keys = new Map();
for (const recipe of recipes) {
  const key = pairKey(recipe.a, recipe.b);
  if (keys.has(key)) {
    issues.push(`Duplicate pair: ${key} → "${keys.get(key)}" and "${recipe.result}"`);
  }
  keys.set(key, recipe.result);
}

// Traceability
const known = new Set(seeds.map((s) => s.name.toLowerCase()));
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

for (const recipe of recipes) {
  if (!known.has(recipe.a.toLowerCase())) {
    issues.push(`Unreachable input "${recipe.a}" in ${recipe.a} + ${recipe.b} → ${recipe.result}`);
  }
  if (!known.has(recipe.b.toLowerCase())) {
    issues.push(`Unreachable input "${recipe.b}" in ${recipe.a} + ${recipe.b} → ${recipe.result}`);
  }
}

// Duplicate result names
const resultCounts = new Map();
for (const recipe of recipes) {
  resultCounts.set(recipe.result, (resultCounts.get(recipe.result) || 0) + 1);
}
for (const [name, count] of resultCounts) {
  if (count > 1) warnings.push(`Result "${name}" created by ${count} different pairs`);
}

// Duplicate emojis on different results (cosmetic)
const emojiMap = new Map();
for (const recipe of recipes) {
  if (!emojiMap.has(recipe.emoji)) emojiMap.set(recipe.emoji, []);
  emojiMap.get(recipe.emoji).push(recipe.result);
}
for (const [emoji, names] of emojiMap) {
  if (names.length > 1) {
    warnings.push(
      `Emoji ${emoji} reused ${names.length} times: ${names.join(", ")}`,
    );
  }
}

// Elements never used as input (dead ends only - informational)
const usedAsInput = new Set();
for (const recipe of recipes) {
  usedAsInput.add(recipe.a.toLowerCase());
  usedAsInput.add(recipe.b.toLowerCase());
}
const deadEnds = [];
for (const recipe of recipes) {
  if (
    !usedAsInput.has(recipe.result.toLowerCase()) &&
    !seeds.some((s) => s.name.toLowerCase() === recipe.result.toLowerCase())
  ) {
    deadEnds.push(recipe.result);
  }
}

// Spider-Man reachable?
const spider = recipes.find((r) => r.result === "Spider-Man");
if (!spider) issues.push("Spider-Man not in starter recipes");
else if (!known.has(spider.a.toLowerCase()) || !known.has(spider.b.toLowerCase())) {
  issues.push("Spider-Man recipe has unreachable inputs");
}

// Bing Bong needs Knicks
const bing = recipes.find((r) => r.result === "Bing Bong");
const knicksRecipe = recipes.find((r) => r.result === "Knicks");
if (bing && bing.b !== "Knicks" && bing.a !== "Knicks") {
  issues.push(`Bing Bong uses ${bing.a} + ${bing.b}, expected Knicks`);
}

// Tier-1 coverage: each starter should appear in at least one tier-1 recipe
const tier1 = recipes.slice(0, 23);
const startersInTier1 = new Set();
for (const recipe of tier1) {
  startersInTier1.add(recipe.a);
  startersInTier1.add(recipe.b);
}
for (const seed of seeds) {
  const count = tier1.filter((r) => r.a === seed.name || r.b === seed.name).length;
  if (count === 0) {
    warnings.push(`Starter "${seed.name}" not in any tier-1 pair`);
  } else if (count === 1) {
    warnings.push(`Starter "${seed.name}" only appears in 1 tier-1 recipe`);
  }
}

// Missing culture+time (removed nightlife) - optional
if (!tier1.some((r) => (r.a === "Culture" && r.b === "Time") || (r.a === "Time" && r.b === "Culture"))) {
  warnings.push("No Culture + Time tier-1 recipe (Nightlife was removed)");
}

console.log("=== NYCrafts recipe review ===\n");
console.log(`Starters: ${seeds.length}`);
console.log(`Recipes: ${recipes.length}`);
console.log(`Dead-end crafts (leaf nodes): ${deadEnds.length}\n`);

if (issues.length) {
  console.log("ERRORS:");
  for (const item of issues) console.log("  ✗", item);
  console.log();
} else {
  console.log("No structural errors found.\n");
}

if (warnings.length) {
  console.log("WARNINGS:");
  for (const item of warnings) console.log("  ⚠", item);
  console.log();
}

// Category rough counts
const categories = {
  food: 0,
  transit: 0,
  boroughs: 0,
  sports: 0,
  music: 0,
  slang: 0,
  pop: 0,
  lifestyle: 0,
  tier1: 23,
};
const foodKw = /bodega|food|slice|cheese|halal|coffee|pretzel|hot dog|citi|market|snack|rat/i;
const transitKw = /subway|mta|metro|train|commute|ferry|rush|delay|transit|42nd|grand central/i;
const sportKw = /yankee|mets|knicks|nets|sports|stadium|judge|brunson|game day|mvp|barclays|madison/i;
const musicKw = /hip hop|broadway|music|jay|nas|alicia|hamilton|showtime|cardi/i;
const slangKw = /slang|deadass|bing bong|brick|ock|yerrrr|no cap/i;

for (const recipe of recipes.slice(23)) {
  const text = `${recipe.a} ${recipe.b} ${recipe.result}`;
  if (foodKw.test(text)) categories.food++;
  else if (transitKw.test(text)) categories.transit++;
  else if (sportKw.test(text)) categories.sports++;
  else if (musicKw.test(text)) categories.music++;
  else if (slangKw.test(text)) categories.slang++;
  else if (/spider|ghost|king kong|influencer|spike|icon|tourist|viral/i.test(text)) categories.pop++;
  else if (/rent|roommate|gentrification|walking|sidewalk|payday|broke/i.test(text)) categories.lifestyle++;
  else if (/brooklyn|queens|bronx|manhattan|staten|borough|empire|williamsburg|bridge/i.test(text)) categories.boroughs++;
  else categories.lifestyle++;
}

console.log("Approx. distribution (tier 2+, overlapping heuristics):");
for (const [k, v] of Object.entries(categories)) {
  if (k !== "tier1") console.log(`  ${k}: ${v}`);
}

process.exit(issues.length ? 1 : 0);
