import Database from "better-sqlite3";

const db = new Database("craft.db");

const elements = db.prepare("SELECT COUNT(*) AS c FROM elements").get().c;
const recipes = db.prepare("SELECT COUNT(*) AS c FROM recipes").get().c;
const spider = db
  .prepare(`SELECT id FROM recipes WHERE result_name = 'Spider-Man'`)
  .get();
const daily = db
  .prepare(`
    SELECT d.date_key, r.result_name
    FROM daily_challenge_targets d
    JOIN recipes r ON r.id = d.recipe_id
    ORDER BY date_key DESC
    LIMIT 5
  `)
  .all();
const orphanRecipes = db
  .prepare(`
    SELECT r.a, r.b, r.result_name
    FROM recipes r
    WHERE LOWER(r.a) NOT IN (SELECT LOWER(name) FROM elements)
       OR LOWER(r.b) NOT IN (SELECT LOWER(name) FROM elements)
    LIMIT 10
  `)
  .all();

const stale = db
  .prepare(`
    SELECT result_name, a, b FROM recipes
    WHERE result_name IN ('Nightlife', 'Neighborhood', 'Meme Legend', 'Grandmaster Flash')
       OR a IN ('Place', 'Weather', 'Sport', 'Word')
       OR b IN ('Place', 'Weather', 'Sport', 'Word')
  `)
  .all();

console.log(
  JSON.stringify(
    {
      elements,
      recipes,
      hasSpiderMan: Boolean(spider),
      daily,
      orphanRecipes,
      staleRecipeRows: stale.length,
      stale: stale.slice(0, 8),
    },
    null,
    2,
  ),
);
