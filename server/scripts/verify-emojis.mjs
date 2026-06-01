import Database from "better-sqlite3";

const db = new Database("craft.db");

const sample = db
  .prepare(
    `
    SELECT name, emoji FROM elements
    WHERE name IN (
      'NYC Icon', 'Spider-Man', 'Jay-Z', 'Mets', 'Knicks',
      'Manhattan', 'New Yorker', 'No Cap', 'Bing Bong', 'Bronx', 'Nas'
    )
    ORDER BY name
  `,
  )
  .all();

const duplicates = db
  .prepare(
    `
    SELECT emoji, COUNT(*) AS count, GROUP_CONCAT(name, ', ') AS names
    FROM elements
    GROUP BY emoji
    HAVING count > 1
  `,
  )
  .all();

console.log("Sample crafts:");
for (const row of sample) {
  console.log(`  ${row.emoji}  ${row.name}`);
}

console.log(`\nDuplicate emojis in elements table: ${duplicates.length}`);
for (const row of duplicates) {
  console.log(`  ${row.emoji} (${row.count}x): ${row.names}`);
}

const expected = {
  "NYC Icon": "⭐",
  "Spider-Man": "🕷️",
  "Jay-Z": "🎙️",
  "Nas": "📀",
  "Mets": "🍎",
  "No Cap": "🚫",
};

let ok = true;
for (const [name, emoji] of Object.entries(expected)) {
  const row = sample.find((r) => r.name === name);
  if (!row || row.emoji !== emoji) {
    console.error(`Expected ${name} ${emoji}, got ${row?.emoji ?? "missing"}`);
    ok = false;
  }
}

process.exit(ok && duplicates.length === 0 ? 0 : 1);
