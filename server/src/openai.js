import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Missing OPENAI_API_KEY. Set it in server/.env.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function createEmbedding(input) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input
  });

  return response.data[0].embedding;
}

export async function generateCombination({ a, b, neighbors }) {
  const neighborText = neighbors.length
    ? neighbors
      .map((n) => `- ${n.a} + ${n.b} = ${n.resultName}`)
      .join("\n")
    : "None";

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are generating results for an NYC-themed Infinite Craft-style crafting game.

Return ONLY valid JSON:
{"name":"Result","emoji":"✨"}

The result must:
- Be a real recognizable word, place, phrase, event, food, person type, landmark, neighborhood, transit concept, or NYC cultural reference
- Prefer New York City culture, places, foods, transit, slang, weather, events, boroughs, neighborhoods, and everyday city life
- Be 1 or 2 words, rarely 3
- Usually be a noun or common phrase
- Feel like a natural combination of the two inputs
- Prefer iconic, funny, or familiar NYC results over generic fantasy results
- Reuse existing game-like concepts when possible
- Avoid fake compound words like "Flareboard" or "Sandy Wave Rider"
- Avoid simply gluing the input words together
- Avoid overly obscure results unless they are clearly NYC-related
- Avoid unsafe, hateful, sexual, or private-person content

Good examples:
Food + Place = Bodega
Food + Money = Dollar Slice
Person + Transit = Commuter
Transit + Time = Rush Hour
Money + Place = Rent
Culture + Place = Times Square
Bodega + Food = Chopped Cheese
Subway Station + Time = Train Delay
Weather + Person = Forgot Umbrella
Brooklyn + Culture = Williamsburg
The Bronx + Culture = Hip Hop
Money + Time = Payday
Nightlife + Money = Cover Charge

Bad examples:
Sandy Wave Rider
Oceanic Flame Person
Transit Food Thing
Money Weather Object
Random Fantasy Kingdom
        `.trim()
      },
      {
        role: "user",
        content: `
Combine:
${a} + ${b}

Similar existing NYC-style recipes:
${neighborText}

Return one clean NYC-themed result. If no NYC-specific result makes sense, return a simple real-world result instead of inventing a word.
        `.trim()
      }
    ]
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    name: sanitizeName(parsed.name),
    emoji: sanitizeEmoji(parsed.emoji)
  };
}

function sanitizeName(value) {
  const fallback = "Mystery";
  if (typeof value !== "string") return fallback;

  const cleaned = value
    .replace(/[{}[\]"`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  return cleaned || fallback;
}

function sanitizeEmoji(value) {
  if (typeof value !== "string") return "✨";
  return value.trim().slice(0, 8) || "✨";
}
