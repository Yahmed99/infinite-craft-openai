export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -1;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function topSimilarRecipes(targetEmbedding, recipes, limit = 8) {
  return recipes
    .map((recipe) => {
      let embedding = [];
      try {
        embedding = JSON.parse(recipe.pairEmbeddingJson || "[]");
      } catch {
        embedding = [];
      }

      return {
        ...recipe,
        score: cosineSimilarity(targetEmbedding, embedding)
      };
    })
    .filter((r) => Number.isFinite(r.score) && r.score > -1)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

export function averageVectors(vectors) {
  if (!vectors.length) return [];

  const length = vectors[0].length;
  const result = new Array(length).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < length; i++) {
      result[i] += vector[i];
    }
  }

  return result.map((value) => value / vectors.length);
}

export function nearestElementByVector(targetVector, elements, excludeNames = []) {
  const exclude = new Set(excludeNames.map((n) => n.toLowerCase()));

  let best = null;

  for (const element of elements) {
    if (exclude.has(element.name.toLowerCase())) continue;

    let embedding = [];

    try {
      embedding = JSON.parse(element.embeddingJson || "[]");
    } catch {
      continue;
    }

    const score = cosineSimilarity(targetVector, embedding);

    if (!best || score > best.score) {
      best = {
        name: element.name,
        emoji: element.emoji,
        score
      };
    }
  }

  return best;
}