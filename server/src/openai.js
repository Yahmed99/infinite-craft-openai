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
You are generating results for an Infinite Craft-style crafting game.

Return ONLY valid JSON:
{"name":"Result","emoji":"✨"}

The result must:
- Be a real recognizable word or short phrase
- Be 1 or 2 words, rarely 3
- Usually be a noun
- Feel like a natural combination of the two inputs
- Prefer common concepts over weird invented ones
- Reuse existing game-like concepts when possible
- Avoid made-up compound phrases like "Sandy Wave Rider"
- Avoid simply gluing the input words together
- Avoid adjectives unless the phrase is very common
- Avoid overly specific results

Good examples:
Water + Fire = Steam
Earth + Water = Mud
Fire + Earth = Lava
Wind + Water = Wave
Wave + Beach = Surf
Human + Fire = Cook
Tree + Fire = Ash

Bad examples:
Sandy Wave Rider
Oceanic Flame Person
Fire Water Thing
Windy Earth Object
        `.trim()
      },
      {
        role: "user",
        content: `
Combine:
${a} + ${b}

Similar existing recipes:
${neighborText}

Return one clean result.
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
