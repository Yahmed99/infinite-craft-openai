import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { pairKey } from "./utils.js";

export const db = new Database(
  process.env.DATABASE_PATH || "craft.db"
);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '✨',
  embedding_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_key TEXT NOT NULL UNIQUE,
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  result_name TEXT NOT NULL,
  result_emoji TEXT NOT NULL DEFAULT '✨',
  pair_embedding_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, name)
);

CREATE TABLE IF NOT EXISTS device_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  pair_key TEXT NOT NULL,
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  result_name TEXT NOT NULL,
  result_emoji TEXT NOT NULL DEFAULT '✨',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, pair_key)
);

CREATE TABLE IF NOT EXISTS challenge_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  duration_ms INTEGER,
  paused_ms INTEGER NOT NULL DEFAULT 0,
  paused_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS challenge_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_challenge_targets (
  date_key TEXT PRIMARY KEY,
  recipe_id INTEGER NOT NULL
);
`);

const challengeSessionColumns = db
  .prepare(`PRAGMA table_info(challenge_sessions)`)
  .all()
  .map((column) => column.name);

if (!challengeSessionColumns.includes("paused_ms")) {
  db.exec(
    `ALTER TABLE challenge_sessions ADD COLUMN paused_ms INTEGER NOT NULL DEFAULT 0`,
  );
}

if (!challengeSessionColumns.includes("paused_at_ms")) {
  db.exec(`ALTER TABLE challenge_sessions ADD COLUMN paused_at_ms INTEGER`);
}

function getDailyChallengeDateKey() {
  const timeZone =
    process.env.CHALLENGE_DAILY_TZ?.trim() || "America/New_York";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  if (!y || !m || !d) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${y}-${m}-${d}`;
}

function dailyTargetPickIndex(seed, modulo) {
  if (modulo <= 0) return 0;

  const hash = createHash("sha256").update(seed).digest();
  const n =
    (hash.readUInt32BE(0) ^ hash.readUInt32BE(4) ^ hash.readUInt32BE(8)) >>> 0;

  return n % modulo;
}

const seedElements = [
  ["Person", "🧍"],
  ["Food", "🍽️"],
  ["Transit", "🚇"],
  ["City", "🏙️"],
  ["Money", "💸"],
  ["Time", "⏰"],
  ["Music", "🎵"],
  ["Sports", "🏆"],
  ["Culture", "🎭"],
  ["Words", "🗣️"],
];

const starterRecipes = [
  // Tier 1 — starter pairs
  ["food+city", "Food", "City", "Bodega", "🏪"],
  ["food+money", "Food", "Money", "Dollar Slice", "🍕"],
  ["food+person", "Food", "Person", "New Yorker", "🗽"],
  ["food+time", "Food", "Time", "Late Night Snack", "🌙"],
  ["culture+food", "Culture", "Food", "Street Food", "🥙"],
  ["transit+city", "Transit", "City", "Subway Station", "🚉"],
  ["money+transit", "Money", "Transit", "MetroCard", "💳"],
  ["person+transit", "Person", "Transit", "Commuter", "🧑‍💼"],
  ["time+transit", "Time", "Transit", "Rush Hour", "😵‍💫"],
  ["culture+transit", "Culture", "Transit", "Subway Performer", "🎷"],
  ["music+transit", "Music", "Transit", "Subway Musician", "🎸"],
  ["city+culture", "City", "Culture", "NYC Icon", "⭐"],
  ["person+city", "Person", "City", "Tourist", "📸"],
  ["money+city", "Money", "City", "Rent", "🏠"],
  ["city+city", "City", "City", "Borough", "🗺️"],
  ["words+city", "Words", "City", "NYC Slang", "💬"],
  ["sports+city", "Sports", "City", "NY Sports", "🏅"],
  ["music+city", "Music", "City", "Broadway", "🎭"],
  ["person+time", "Person", "Time", "Busy New Yorker", "🏃"],
  ["person+culture", "Person", "Culture", "Street Artist", "🎨"],
  ["money+person", "Money", "Person", "Side Hustle", "💼"],
  ["money+time", "Money", "Time", "Payday", "🤑"],
  ["music+culture", "Music", "Culture", "Hip Hop", "🎤"],

  // Food
  ["bodega+food", "Bodega", "Food", "Chopped Cheese", "🥪"],
  ["bodega+money", "Bodega", "Money", "Bodega Cat", "🐈"],
  ["bodega+time", "Bodega", "Time", "Midnight Bodega Run", "🌃"],
  ["dollar slice+new yorker", "Dollar Slice", "New Yorker", "Pizza Rat", "🐀"],
  ["dollar slice+time", "Dollar Slice", "Time", "2 AM Slice", "🕛"],
  ["money+street food", "Money", "Street Food", "Halal Cart", "🌯"],
  ["halal cart+new yorker", "Halal Cart", "New Yorker", "White Sauce Debate", "🥫"],
  ["late night snack+money", "Late Night Snack", "Money", "Coffee", "☕"],
  ["nyc slang+food", "NYC Slang", "Food", "Ocky Way", "🧀"],
  ["yankees+food", "Yankees", "Food", "Stadium Hot Dog", "🌭"],
  ["mets+food", "Mets", "Food", "Citi Field", "🏟️"],
  ["food+queens", "Food", "Queens", "Queens Night Market", "🍢"],

  // Transit
  ["metrocard+subway station", "MetroCard", "Subway Station", "MTA", "🚇"],
  ["mta+time", "MTA", "Time", "Train Delay", "⏳"],
  ["money+mta", "Money", "MTA", "Fare Hike", "📈"],
  ["culture+mta", "Culture", "MTA", "Subway Showtime", "🕺"],
  ["commuter+train delay", "Commuter", "Train Delay", "Late to Work", "😰"],
  ["coffee+train delay", "Coffee", "Train Delay", "Emotional Support Coffee", "🫖"],
  ["subway performer+tourist", "Subway Performer", "Tourist", "Viral Video", "📱"],
  ["tourist+culture", "Tourist", "Culture", "Times Square", "🌆"],
  ["subway station+times square", "Subway Station", "Times Square", "42nd Street", "🛤️"],
  ["grand central+time", "Grand Central", "Time", "Commute Rush", "🚶‍♂️"],
  ["staten island+transit", "Staten Island", "Transit", "Ferry Ride", "🛥️"],

  // Boroughs & landmarks
  ["borough+music", "Borough", "Music", "Brooklyn", "🌉"],
  ["borough+food", "Borough", "Food", "Queens", "🌎"],
  ["borough+sports", "Borough", "Sports", "Bronx", "🧭"],
  ["borough+money", "Borough", "Money", "Manhattan", "🌇"],
  ["borough+transit", "Borough", "Transit", "Staten Island", "🏝️"],
  ["brooklyn+city", "Brooklyn", "City", "Brooklyn Bridge", "🌁"],
  ["brooklyn+culture", "Brooklyn", "Culture", "Williamsburg", "🧋"],
  ["manhattan+city", "Manhattan", "City", "Empire State Building", "🏢"],
  ["manhattan+transit", "Manhattan", "Transit", "Grand Central", "🏛️"],
  ["queens+transit", "Queens", "Transit", "7 Train", "7️⃣"],
  ["bronx+city", "Bronx", "City", "Yankee Stadium", "🎯"],

  // Sports
  ["ny sports+bronx", "NY Sports", "Bronx", "Yankees", "⚾"],
  ["ny sports+queens", "NY Sports", "Queens", "Mets", "🍎"],
  ["ny sports+brooklyn", "NY Sports", "Brooklyn", "Nets", "🖤"],
  ["ny sports+manhattan", "NY Sports", "Manhattan", "Knicks", "🏀"],
  ["yankees+person", "Yankees", "Person", "Aaron Judge", "👨‍⚖️"],
  ["knicks+person", "Knicks", "Person", "Jalen Brunson", "👟"],
  ["7 train+tourist", "7 Train", "Tourist", "Mets Game", "🎟️"],
  ["new yorker+yankees", "New Yorker", "Yankees", "Yankees Fan", "🧢"],
  ["nyc slang+sports", "NYC Slang", "Sports", "Yerrrr", "📣"],
  ["sports+transit", "Sports", "Transit", "Game Day Train", "🚆"],
  ["mets+person", "Mets", "Person", "Mets Fan", "🎗️"],
  ["nets+culture", "Nets", "Culture", "Barclays Center", "🔶"],
  ["yankee stadium+sports", "Yankee Stadium", "Sports", "Home Run", "💥"],
  ["knicks+sports", "Knicks", "Sports", "Madison Square Garden", "🎪"],
  ["aaron judge+sports", "Aaron Judge", "Sports", "MVP Season", "👑"],
  ["sports+food", "Sports", "Food", "Stadium Pretzel", "🥨"],

  // Music
  ["hip hop+brooklyn", "Hip Hop", "Brooklyn", "Jay-Z", "🎙️"],
  ["hip hop+queens", "Hip Hop", "Queens", "Nas", "📀"],
  ["music+manhattan", "Music", "Manhattan", "Alicia Keys", "🎹"],
  ["hip hop+person", "Hip Hop", "Person", "Cardi B", "💅"],
  ["brooklyn+street artist", "Brooklyn", "Street Artist", "Spike Lee", "🎬"],
  ["culture+staten island", "Culture", "Staten Island", "Pete Davidson", "😂"],
  ["broadway+culture", "Broadway", "Culture", "Hamilton", "🎵"],
  ["subway musician+culture", "Subway Musician", "Culture", "Showtime", "💃"],

  // Slang
  ["nyc slang+person", "NYC Slang", "Person", "Deadass", "😐"],
  ["nyc slang+knicks", "NYC Slang", "Knicks", "Bing Bong", "📢"],
  ["nyc slang+culture", "NYC Slang", "Culture", "Brick", "🧱"],
  ["bodega cat+words", "Bodega Cat", "Words", "Ock", "👨‍🍳"],
  ["chopped cheese+ock", "Chopped Cheese", "Ock", "The Ocky Way", "🥖"],
  ["deadass+culture", "Deadass", "Culture", "No Cap", "🚫"],

  // Pop culture & famous New Yorkers
  ["nyc icon+person", "NYC Icon", "Person", "Spider-Man", "🕷️"],
  ["nyc icon+culture", "NYC Icon", "Culture", "Ghostbusters", "👻"],
  ["nyc icon+music", "NYC Icon", "Music", "Empire State of Mind", "🎶"],
  ["empire state building+tourist", "Empire State Building", "Tourist", "King Kong", "🦍"],
  ["tourist+times square", "Tourist", "Times Square", "Broadway Ticket", "🎫"],
  ["viral video+person", "Viral Video", "Person", "Influencer", "📲"],
  ["spike lee+culture", "Spike Lee", "Culture", "Do the Right Thing", "✊"],

  // Lifestyle & money
  ["rent+person", "Rent", "Person", "Roommate", "🛏️"],
  ["rent+manhattan", "Rent", "Manhattan", "Luxury Apartment", "💎"],
  ["rent+brooklyn", "Rent", "Brooklyn", "Gentrification", "🏗️"],
  ["busy new yorker+new yorker", "Busy New Yorker", "New Yorker", "Walking Fast", "💨"],
  ["tourist+walking fast", "Tourist", "Walking Fast", "Sidewalk Rage", "😤"],
  ["payday+rent", "Payday", "Rent", "Broke Till Friday", "📉"],
];


const insertElement = db.prepare(`
  INSERT OR IGNORE INTO elements (name, emoji)
  VALUES (?, ?)
`);

for (const [name, emoji] of seedElements) {
  insertElement.run(name, emoji);
}

const insertRecipeSeed = db.prepare(`
  INSERT OR IGNORE INTO recipes
  (pair_key, a, b, result_name, result_emoji, pair_embedding_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const [, a, b, resultName, emoji] of starterRecipes) {
  const key = pairKey(a, b);

  insertRecipeSeed.run(
    key,
    a,
    b,
    resultName,
    emoji,
    JSON.stringify([])
  );

  insertElement.run(resultName, emoji);
}

function seedDailyChallengeTarget(resultName) {
  const recipe = db
    .prepare(`SELECT id FROM recipes WHERE result_name = ?`)
    .get(resultName);

  if (!recipe) {
    return;
  }

  db.prepare(`
    INSERT OR REPLACE INTO daily_challenge_targets (date_key, recipe_id)
    VALUES (?, ?)
  `).run(getDailyChallengeDateKey(), recipe.id);
}

seedDailyChallengeTarget("Spider-Man");

export function ensureDeviceStarters(deviceId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO device_elements (device_id, name, emoji)
    VALUES (?, ?, ?)
  `);

  for (const [name, emoji] of seedElements) {
    stmt.run(deviceId, name, emoji);
  }
}

export function allElements() {
  return db.prepare(`
    SELECT name, emoji, created_at AS createdAt
    FROM elements
    ORDER BY created_at ASC, name ASC
  `).all();
}

export function allDeviceElements(deviceId) {
  ensureDeviceStarters(deviceId);

  return db.prepare(`
    SELECT name, emoji, created_at AS createdAt
    FROM device_elements
    WHERE device_id = ?
    ORDER BY created_at ASC, name ASC
  `).all(deviceId);
}

export function insertDeviceElement({ deviceId, name, emoji }) {
  return db.prepare(`
    INSERT OR IGNORE INTO device_elements (device_id, name, emoji)
    VALUES (?, ?, ?)
  `).run(deviceId, name, emoji);
}

export function getRecipe(pairKey) {
  return db.prepare(`
    SELECT pair_key AS pairKey, a, b, result_name AS name, result_emoji AS emoji
    FROM recipes
    WHERE pair_key = ?
  `).get(pairKey);
}

export function getDeviceRecipe(deviceId, pairKey) {
  return db.prepare(`
    SELECT
      pair_key AS pairKey,
      a,
      b,
      result_name AS name,
      result_emoji AS emoji
    FROM device_recipes
    WHERE device_id = ? AND pair_key = ?
  `).get(deviceId, pairKey);
}

export function insertRecipe({
  pairKey,
  a,
  b,
  resultName,
  resultEmoji,
  pairEmbedding
}) {
  db.prepare(`
    INSERT OR IGNORE INTO recipes
      (pair_key, a, b, result_name, result_emoji, pair_embedding_json)
    VALUES
      (?, ?, ?, ?, ?, ?)
  `).run(
    pairKey,
    a,
    b,
    resultName,
    resultEmoji,
    JSON.stringify(pairEmbedding ?? [])
  );

  db.prepare(`
    INSERT OR IGNORE INTO elements (name, emoji)
    VALUES (?, ?)
  `).run(resultName, resultEmoji);
}

export function insertDeviceRecipe({
  deviceId,
  pairKey,
  a,
  b,
  resultName,
  resultEmoji
}) {
  db.prepare(`
    INSERT OR IGNORE INTO device_recipes
      (device_id, pair_key, a, b, result_name, result_emoji)
    VALUES
      (?, ?, ?, ?, ?, ?)
  `).run(deviceId, pairKey, a, b, resultName, resultEmoji);

  insertDeviceElement({
    deviceId,
    name: resultName,
    emoji: resultEmoji
  });
}

export function allRecipesWithEmbeddings() {
  return db.prepare(`
    SELECT
      pair_key AS pairKey,
      a,
      b,
      result_name AS resultName,
      result_emoji AS resultEmoji,
      pair_embedding_json AS pairEmbeddingJson
    FROM recipes
    WHERE pair_embedding_json IS NOT NULL
  `).all();
}

export function allRecipesForSimilarity() {
  return db.prepare(`
    SELECT
      id,
      pair_key AS pairKey,
      a,
      b,
      result_name AS resultName,
      result_emoji AS resultEmoji,
      pair_embedding_json AS pairEmbeddingJson
    FROM recipes
  `).all();
}

export function updateRecipePairEmbedding(id, pairEmbedding) {
  return db.prepare(`
    UPDATE recipes
    SET pair_embedding_json = ?
    WHERE id = ?
  `).run(JSON.stringify(pairEmbedding ?? []), id);
}

export function resetDeviceData(deviceId) {
  const deleteElements = db.prepare(`
    DELETE FROM device_elements
    WHERE device_id = ?
  `);

  const deleteRecipes = db.prepare(`
    DELETE FROM device_recipes
    WHERE device_id = ?
  `);

  const transaction = db.transaction(() => {
    deleteElements.run(deviceId);
    deleteRecipes.run(deviceId);
    ensureDeviceStarters(deviceId);
  });

  transaction();
}

export function getElementByName(name) {
  return db.prepare(`
    SELECT name, emoji
    FROM elements
    WHERE LOWER(name) = LOWER(?)
  `).get(name);
}

export function isStarterElement(name) {
  return seedElements.some(
    ([starterName]) =>
      starterName.toLowerCase() === String(name ?? "").trim().toLowerCase(),
  );
}

export function getGlobalGraphRows() {
  return db.prepare(`
    SELECT
      r.id AS recipe_id,

      r.a AS input_a_name,
      input_a.emoji AS input_a_emoji,

      r.b AS input_b_name,
      input_b.emoji AS input_b_emoji,

      r.result_name AS result_name,
      r.result_emoji AS result_emoji

    FROM recipes r
    LEFT JOIN elements input_a
      ON LOWER(input_a.name) = LOWER(r.a)

    LEFT JOIN elements input_b
      ON LOWER(input_b.name) = LOWER(r.b)

    ORDER BY r.id ASC
  `).all();
}

export function getChallengeTarget() {
  const dateKey = getDailyChallengeDateKey();

  const cached = db.prepare(`
    SELECT r.result_name AS name, r.result_emoji AS emoji
    FROM daily_challenge_targets d
    JOIN recipes r ON r.id = d.recipe_id
    WHERE d.date_key = ?
  `).get(dateKey);

  if (cached) {
    return cached;
  }

  const rows = db.prepare(`
    SELECT id, result_name AS name, result_emoji AS emoji
    FROM recipes
    WHERE result_name NOT IN ('Bodega', 'MetroCard', 'Borough')
    ORDER BY id ASC
  `).all();

  if (!rows.length) {
    return null;
  }

  const idx = dailyTargetPickIndex(`nycrafts-daily-target:v1:${dateKey}`, rows.length);
  const picked = rows[idx];

  db.prepare(`
    INSERT OR IGNORE INTO daily_challenge_targets (date_key, recipe_id)
    VALUES (?, ?)
  `).run(dateKey, picked.id);

  return db.prepare(`
    SELECT r.result_name AS name, r.result_emoji AS emoji
    FROM daily_challenge_targets d
    JOIN recipes r ON r.id = d.recipe_id
    WHERE d.date_key = ?
  `).get(dateKey);
}

export function createChallengeSession({
  id,
  deviceId,
  playerName,
  targetName,
  startedAtMs
}) {
  db.prepare(`
    INSERT INTO challenge_sessions
      (id, device_id, player_name, target_name, started_at_ms)
    VALUES
      (?, ?, ?, ?, ?)
  `).run(id, deviceId, playerName, targetName, startedAtMs);
}

export function getChallengeSession(id) {
  return db.prepare(`
    SELECT
      id,
      device_id AS deviceId,
      player_name AS playerName,
      target_name AS targetName,
      started_at_ms AS startedAtMs,
      completed_at_ms AS completedAtMs,
      duration_ms AS durationMs,
      paused_ms AS pausedMs,
      paused_at_ms AS pausedAtMs
    FROM challenge_sessions
    WHERE id = ?
  `).get(id);
}

export function getChallengeActiveDurationMs(session, now = Date.now()) {
  if (!session) return 0;

  let pausedMs = session.pausedMs || 0;

  if (session.pausedAtMs) {
    pausedMs += now - session.pausedAtMs;
  }

  return Math.max(0, now - session.startedAtMs - pausedMs);
}

export function setChallengePause({ id, paused, now = Date.now() }) {
  const session = getChallengeSession(id);

  if (!session || session.completedAtMs) {
    return session;
  }

  if (paused && !session.pausedAtMs) {
    db.prepare(`
      UPDATE challenge_sessions
      SET paused_at_ms = ?
      WHERE id = ?
    `).run(now, id);
  } else if (!paused && session.pausedAtMs) {
    db.prepare(`
      UPDATE challenge_sessions
      SET
        paused_ms = paused_ms + (? - paused_at_ms),
        paused_at_ms = NULL
      WHERE id = ?
    `).run(now, id);
  }

  return getChallengeSession(id);
}

export function cancelChallengeSession({ id, cancelledAtMs = Date.now() }) {
  const session = getChallengeSession(id);

  if (!session || session.completedAtMs) {
    return session;
  }

  if (session.pausedAtMs) {
    setChallengePause({ id, paused: false, now: cancelledAtMs });
  }

  db.prepare(`
    UPDATE challenge_sessions
    SET completed_at_ms = ?
    WHERE id = ?
  `).run(cancelledAtMs, id);

  return getChallengeSession(id);
}

export function finishChallengeSession({ id, completedAtMs, durationMs }) {
  const session = getChallengeSession(id);

  if (!session || session.completedAtMs) {
    return session;
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE challenge_sessions
      SET completed_at_ms = ?, duration_ms = ?
      WHERE id = ?
    `).run(completedAtMs, durationMs, id);

    db.prepare(`
      INSERT OR IGNORE INTO challenge_scores
        (session_id, device_id, player_name, target_name, duration_ms)
      VALUES
        (?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.deviceId,
      session.playerName,
      session.targetName,
      durationMs
    );
  });

  transaction();

  return getChallengeSession(id);
}

export function getChallengeLeaderboard(targetName, limit = 10) {
  return db.prepare(`
    SELECT
      player_name AS playerName,
      target_name AS targetName,
      duration_ms AS durationMs,
      completed_at AS completedAt
    FROM challenge_scores
    WHERE LOWER(target_name) = LOWER(?)
    ORDER BY duration_ms ASC, completed_at ASC
    LIMIT ?
  `).all(targetName, limit);
}

export function getChallengeScoreStanding(sessionId) {
  return db.prepare(`
    WITH ranked_scores AS (
      SELECT
        session_id AS sessionId,
        target_name AS targetName,
        duration_ms AS durationMs,
        completed_at AS completedAt,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(target_name)
          ORDER BY duration_ms ASC, completed_at ASC
        ) AS standing,
        COUNT(*) OVER (PARTITION BY LOWER(target_name)) AS totalRuns
      FROM challenge_scores
    )
    SELECT sessionId, targetName, durationMs, completedAt, standing, totalRuns
    FROM ranked_scores
    WHERE sessionId = ?
  `).get(sessionId);
}
