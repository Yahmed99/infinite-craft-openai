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

// const seedElements = [
//   ["Water", "💧"],
//   ["Fire", "🔥"],
//   ["Earth", "🌍"],
//   ["Wind", "🌬️"],
//   ["Surfboard", "🏄"]
// ];
const seedElements = [
  ["Person", "🧍"],
  ["Place", "📍"],
  ["Food", "🍕"],
  ["Transit", "🚇"],
  ["Money", "💸"],
  ["Time", "⏰"],
  ["Weather", "🌧️"],
  ["Culture", "🎭"]
];

const starterRecipes = [

    // --- NYC / CULTURE STARTER RECIPES ---
  ["food+place", "Food", "Place", "Bodega", "🏪"],
  ["food+money", "Food", "Money", "Dollar Slice", "🍕"],
  ["food+person", "Food", "Person", "New Yorker", "🗽"],
  ["food+time", "Food", "Time", "Late Night Snack", "🌙"],
  ["culture+food", "Culture", "Food", "Street Food", "🥙"],
  ["food+weather", "Food", "Weather", "Soup Weather", "🍜"],
  ["place+transit", "Place", "Transit", "Subway Station", "🚉"],
  ["money+transit", "Money", "Transit", "MetroCard", "💳"],
  ["person+transit", "Person", "Transit", "Commuter", "🧑‍💼"],
  ["time+transit", "Time", "Transit", "Rush Hour", "😵‍💫"],
  ["transit+weather", "Transit", "Weather", "Subway Flooding", "🌊"],
  ["culture+transit", "Culture", "Transit", "Subway Performer", "🎷"],
  ["person+place", "Person", "Place", "Neighborhood", "🏘️"],
  ["money+place", "Money", "Place", "Rent", "🏠"],
  ["place+time", "Place", "Time", "Meetup Spot", "📍"],
  ["place+weather", "Place", "Weather", "Central Park", "🌳"],
  ["culture+place", "Culture", "Place", "Times Square", "🌆"],
  ["money+person", "Money", "Person", "Side Hustle", "💼"],
  ["person+time", "Person", "Time", "Busy New Yorker", "🏃"],
  ["person+weather", "Person", "Weather", "Forgot Umbrella", "🌧️"],
  ["culture+person", "Culture", "Person", "Street Artist", "🎨"],
  ["money+time", "Money", "Time", "Payday", "🤑"],
  ["money+weather", "Money", "Weather", "Umbrella Vendor", "☂️"],
  ["time+weather", "Time", "Weather", "Snow Day", "❄️"],

  ["bodega+food", "Bodega", "Food", "Chopped Cheese", "🥪"],
  ["bodega+money", "Bodega", "Money", "Bodega Cat", "🐈"],
  ["bodega+person", "Bodega", "Person", "Regular Customer", "🙂"],
  ["bodega+time", "Bodega", "Time", "Midnight Bodega Run", "🏃"],
  ["bodega+culture", "Bodega", "Culture", "Neighborhood Legend", "🏆"],
  ["bodega+weather", "Bodega", "Weather", "Steamy Deli Counter", "♨️"],

  ["dollar slice+new yorker", "Dollar Slice", "New Yorker", "Pizza Rat", "🐀"],
  ["dollar slice+time", "Dollar Slice", "Time", "2 AM Slice", "🌙"],
  ["dollar slice+money", "Dollar Slice", "Money", "Inflation Slice", "😳"],
  ["money+street food", "Money", "Street Food", "Halal Cart", "🥙"],
  ["halal cart+time", "Halal Cart", "Time", "Lunch Rush", "🥙"],
  ["halal cart+weather", "Halal Cart", "Weather", "Steam Cloud", "💨"],
  ["halal cart+new yorker", "Halal Cart", "New Yorker", "White Sauce Debate", "🥫"],
  ["new yorker+soup weather", "New Yorker", "Soup Weather", "Matzo Ball Soup", "🍲"],
  ["late night snack+money", "Late Night Snack", "Money", "Coffee", "☕"],
  ["chopped cheese+new yorker", "Chopped Cheese", "New Yorker", "Bodega Loyalty", "❤️"],

  ["metrocard+subway station", "MetroCard", "Subway Station", "MTA", "🚇"],
  ["mta+time", "MTA", "Time", "Train Delay", "⏳"],
  ["money+mta", "Money", "MTA", "Fare Hike", "📈"],
  ["mta+weather", "MTA", "Weather", "Service Alert", "⚠️"],
  ["culture+mta", "Culture", "MTA", "Subway Showtime", "🎤"],
  ["rush hour+subway station", "Rush Hour", "Subway Station", "Packed Platform", "🫠"],
  ["packed platform+weather", "Packed Platform", "Weather", "Summer Subway Heat", "🥵"],
  ["packed platform+person", "Packed Platform", "Person", "Personal Space Crisis", "😬"],

  ["person+times square", "Person", "Times Square", "Tourist", "📸"],
  ["subway performer+tourist", "Subway Performer", "Tourist", "Viral Video", "📱"],
  ["subway station+times square", "Subway Station", "Times Square", "Times Square-42 St", "🚉"],
  ["subway station+tourist", "Subway Station", "Tourist", "Subway Map Panic", "🗺️"],
  ["subway map panic+time", "Subway Map Panic", "Time", "Wrong Train", "🚆"],
  ["new yorker+wrong train", "New Yorker", "Wrong Train", "Directions in a Hurry", "👉"],
  ["commuter+train delay", "Commuter", "Train Delay", "Late to Work", "😰"],
  ["coffee+train delay", "Coffee", "Train Delay", "Emotional Support Coffee", "☕"],

  ["neighborhood+place", "Neighborhood", "Place", "Borough", "🗺️"],
  ["borough+culture", "Borough", "Culture", "Brooklyn", "🌉"],
  ["borough+food", "Borough", "Food", "Queens", "🌎"],
  ["borough+person", "Borough", "Person", "The Bronx", "🎤"],
  ["borough+transit", "Borough", "Transit", "Manhattan", "🏙️"],
  ["borough+weather", "Borough", "Weather", "Staten Island", "⛴️"],

  ["brooklyn+place", "Brooklyn", "Place", "Brooklyn Bridge", "🌉"],
  ["brooklyn+culture", "Brooklyn", "Culture", "Williamsburg", "☕"],
  ["brooklyn+time", "Brooklyn", "Time", "Rooftop Party", "🌆"],
  ["brooklyn+money", "Brooklyn", "Money", "Rising Rent", "📈"],
  ["manhattan+place", "Manhattan", "Place", "Empire State Building", "🏙️"],
  ["culture+manhattan", "Culture", "Manhattan", "Broadway", "🎭"],
  ["manhattan+transit", "Manhattan", "Transit", "Grand Central", "🚉"],
  ["food+queens", "Food", "Queens", "Queens Night Market", "🍢"],
  ["queens+transit", "Queens", "Transit", "7 Train", "7️⃣"],
  ["place+the bronx", "Place", "The Bronx", "Yankee Stadium", "⚾"],
  ["culture+the bronx", "Culture", "The Bronx", "Hip Hop", "🎧"],

  ["hip hop+new yorker", "Hip Hop", "New Yorker", "Cardi B", "💅"],
  ["brooklyn+hip hop", "Brooklyn", "Hip Hop", "Jay-Z", "🎧"],
  ["hip hop+manhattan", "Hip Hop", "Manhattan", "Alicia Keys", "🎹"],
  ["brooklyn+street artist", "Brooklyn", "Street Artist", "Spike Lee", "🎬"],
  ["culture+staten island", "Culture", "Staten Island", "Pete Davidson", "😂"],
  ["broadway+culture", "Broadway", "Culture", "Lin-Manuel Miranda", "🎼"],
  ["culture+queens", "Culture", "Queens", "Nas", "🎤"],

  ["new yorker+yankee stadium", "New Yorker", "Yankee Stadium", "Yankees Fan", "🧢"],
  ["7 train+tourist", "7 Train", "Tourist", "Mets Game", "⚾"],
  ["manhattan+person", "Manhattan", "Person", "Spider-Man", "🕷️"],
  ["empire state building+tourist", "Empire State Building", "Tourist", "King Kong Moment", "🦍"],

  ["busy new yorker+new yorker", "Busy New Yorker", "New Yorker", "Walking Fast", "🚶"],
  ["tourist+walking fast", "Tourist", "Walking Fast", "Sidewalk Rage", "😤"],
  ["new yorker+subway flooding", "New Yorker", "Subway Flooding", "Deadass?", "😐"],
  ["culture+deadass?", "Culture", "Deadass?", "NYC Slang", "🗣️"],
  ["bodega cat+regular customer", "Bodega Cat", "Regular Customer", "Ock", "👨‍🍳"],
  ["chopped cheese+ock", "Chopped Cheese", "Ock", "The Ocky Way", "🥪"],

  ["payday+rent", "Payday", "Rent", "Rent Due", "😰"],
  ["person+rent due", "Person", "Rent Due", "Landlord", "🔑"],
  ["new yorker+rent", "New Yorker", "Rent", "Tiny Apartment", "📦"],
  ["rising rent+williamsburg", "Rising Rent", "Williamsburg", "Gentrification", "🏗️"],
  ["culture+time", "Culture", "Time", "Nightlife", "🌃"],
  ["brooklyn+nightlife", "Brooklyn", "Nightlife", "Bushwick Party", "🪩"],
  ["money+nightlife", "Money", "Nightlife", "Cover Charge", "💵"],
  ["rooftop party+weather", "Rooftop Party", "Weather", "Rain Check", "☔"],
  ["rent+rush hour", "Rent", "Rush Hour", "NYC Struggle", "😩"],
  ["coffee+nyc struggle", "Coffee", "NYC Struggle", "Still Functioning", "🫡"],
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
    WHERE result_name NOT IN ('Bodega', 'MetroCard', 'Neighborhood')
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
