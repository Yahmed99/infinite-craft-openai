export function normalizeElementName(value) {
  return String(value ?? "")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function pairKey(a, b) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join("+");
}
