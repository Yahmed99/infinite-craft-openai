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
`);

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
  // --- CORE ELEMENT INTERACTIONS ---
  ["earth+water","Earth","Water","Mud","🟫"],
  ["fire+water","Fire","Water","Steam","💨"],
  ["earth+fire","Earth","Fire","Lava","🌋"],
  ["air+water","Wind","Water","Wave","🌊"],
  ["air+earth","Wind","Earth","Dust","🌪️"],
  ["air+fire","Wind","Fire","Smoke","💨"],

  // --- BASIC MATERIALS ---
  ["earth+earth","Earth","Earth","Mountain","⛰️"],
  ["water+water","Water","Water","Lake","🏞️"],
  ["fire+fire","Fire","Fire","Inferno","🔥"],
  ["air+air","Wind","Wind","Storm","🌩️"],

  // --- NATURE ---
  ["earth+rain","Earth","Rain","Plant","🌱"],
  ["water+earth","Water","Earth","Clay","🧱"],
  ["plant+water","Plant","Water","Tree","🌳"],
  ["tree+fire","Tree","Fire","Ash","⚫"],
  ["ash+water","Ash","Water","Soil","🪨"],
  ["soil+plant","Soil","Plant","Forest","🌲"],

  // --- WEATHER ---
  ["water+air","Water","Wind","Cloud","☁️"],
  ["cloud+water","Cloud","Water","Rain","🌧️"],
  ["cloud+fire","Cloud","Fire","Lightning","⚡"],
  ["storm+water","Storm","Water","Hurricane","🌀"],
  ["storm+earth","Storm","Earth","Tornado","🌪️"],

  // --- HEAT / ROCK ---
  ["lava+water","Lava","Water","Stone","🪨"],
  ["stone+fire","Stone","Fire","Metal","⚙️"],
  ["metal+fire","Metal","Fire","Molten Metal","🔥"],
  ["metal+earth","Metal","Earth","Ore","⛏️"],

  // --- LIFE ---
  ["water+life","Water","Life","Fish","🐟"],
  ["earth+life","Earth","Life","Animal","🐾"],
  ["animal+water","Animal","Water","Amphibian","🐸"],
  ["animal+air","Animal","Wind","Bird","🐦"],
  ["animal+fire","Animal","Fire","Dragon","🐉"],

  // --- HUMANS ---
  ["animal+tool","Animal","Tool","Human","🧍"],
  ["human+fire","Human","Fire","Cook","👨‍🍳"],
  ["human+earth","Human","Earth","Farmer","👨‍🌾"],
  ["human+water","Human","Water","Sailor","⛵"],
  ["human+air","Human","Wind","Pilot","✈️"],

  // --- TECHNOLOGY ---
  ["metal+tool","Metal","Tool","Machine","⚙️"],
  ["machine+energy","Machine","Energy","Engine","🚂"],
  ["engine+metal","Engine","Metal","Car","🚗"],
  ["engine+air","Engine","Wind","Plane","✈️"],
  ["engine+water","Engine","Water","Boat","🚤"],

  // --- ENERGY ---
  ["fire+energy","Fire","Energy","Heat","🔥"],
  ["water+energy","Water","Energy","Hydropower","⚡"],
  ["wind+energy","Wind","Energy","Windmill","🌬️"],
  ["earth+energy","Earth","Energy","Geothermal","🌋"],

  // --- OCEAN ---
  ["water+earth","Water","Earth","Beach","🏖️"],
  ["beach+water","Beach","Water","Ocean","🌊"],
  ["ocean+life","Ocean","Life","Coral","🪸"],
  ["ocean+animal","Ocean","Animal","Shark","🦈"],
  ["ocean+plant","Ocean","Plant","Seaweed","🌿"],

  // --- FIRE EVOLUTION ---
  ["fire+forest","Fire","Forest","Wildfire","🔥"],
  ["wildfire+earth","Wildfire","Earth","Charcoal","⚫"],
  ["charcoal+metal","Charcoal","Metal","Steel","🔩"],

  // --- BUILDING ---
  ["stone+tool","Stone","Tool","House","🏠"],
  ["house+human","House","Human","Family","👨‍👩‍👧"],
  ["house+city","House","City","Neighborhood","🏘️"],
  ["metal+house","Metal","House","Skyscraper","🏙️"],

  // --- CITY ---
  ["human+human","Human","Human","Society","🏙️"],
  ["society+metal","Society","Metal","City","🏙️"],
  ["city+car","City","Car","Traffic","🚗"],
  ["city+plane","City","Plane","Airport","✈️"],

  // --- FUN / ABSTRACT ---
  ["fire+water","Fire","Water","Conflict","⚔️"],
  ["earth+air","Earth","Wind","Erosion","🌪️"],
  ["water+time","Water","Time","River","🏞️"],
  ["river+earth","River","Earth","Canyon","🏜️"],
  ["river+city","River","City","Bridge","🌉"],

  // --- EXTRA CHAINS ---
  ["mountain+snow","Mountain","Snow","Glacier","🧊"],
  ["glacier+water","Glacier","Water","Iceberg","🧊"],
  ["iceberg+ocean","Iceberg","Ocean","Titanic","🚢"],

  ["cloud+city","Cloud","City","Smog","🌫️"],
  ["smog+human","Smog","Human","Pollution","🏭"],

  ["tree+tool","Tree","Tool","Wood","🪵"],
  ["wood+fire","Wood","Fire","Campfire","🔥"],
  ["campfire+human","Campfire","Human","Story","📖"],

  ["metal+energy","Metal","Energy","Electricity","⚡"],
  ["electricity+human","Electricity","Human","Technology","💻"],
  ["technology+human","Technology","Human","AI","🤖"],

  ["ai+human","AI","Human","Cyborg","🤖"],
  ["ai+city","AI","City","Smart City","🏙️"],

  ["ocean+wind","Ocean","Wind","Wave Rider","🏄‍♂️"],
  ["wave rider+beach","Wave Rider","Beach","Surfing","🏄"],

  ["storm+ocean","Storm","Ocean","Tsunami","🌊"],
  ["tsunami+city","Tsunami","City","Disaster","🌪️"],

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