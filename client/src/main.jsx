import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STARTERS = [
  {
    name: "Person",
    emoji: "🧍"
  },
  {
    name: "Place",
    emoji: "📍"
  },
  {
    name: "Food",
    emoji: "🍕"
  },
  {
    name: "Transit",
    emoji: "🚇"
  },
  {
    name: "Money",
    emoji: "💸"
  },
  {
    name: "Time",
    emoji: "⏰"
  },
  {
    name: "Weather",
    emoji: "🌧️"
  },
  {
    name: "Culture",
    emoji: "🎭"
  }
];

const COMBINATIONS = {
  "food+place": { name: "Bodega", emoji: "🏪" },
  "food+money": { name: "Dollar Slice", emoji: "🍕" },
  "food+person": { name: "New Yorker", emoji: "🗽" },
  "food+time": { name: "Late Night Snack", emoji: "🌙" },
  "culture+food": { name: "Street Food", emoji: "🥙" },
  "food+weather": { name: "Soup Weather", emoji: "🍜" },
  "place+transit": { name: "Subway Station", emoji: "🚉" },
  "money+transit": { name: "MetroCard", emoji: "💳" },
  "person+transit": { name: "Commuter", emoji: "🧑‍💼" },
  "time+transit": { name: "Rush Hour", emoji: "😵‍💫" },
  "transit+weather": { name: "Subway Flooding", emoji: "🌊" },
  "culture+transit": { name: "Subway Performer", emoji: "🎷" },
  "person+place": { name: "Neighborhood", emoji: "🏘️" },
  "money+place": { name: "Rent", emoji: "🏠" },
  "place+time": { name: "Meetup Spot", emoji: "📍" },
  "place+weather": { name: "Central Park", emoji: "🌳" },
  "culture+place": { name: "Times Square", emoji: "🌆" },
  "money+person": { name: "Side Hustle", emoji: "💼" },
  "person+time": { name: "Busy New Yorker", emoji: "🏃" },
  "person+weather": { name: "Forgot Umbrella", emoji: "🌧️" },
  "culture+person": { name: "Street Artist", emoji: "🎨" },
  "money+time": { name: "Payday", emoji: "🤑" },
  "money+weather": { name: "Umbrella Vendor", emoji: "☂️" },
  "time+weather": { name: "Snow Day", emoji: "❄️" },
  "bodega+food": { name: "Chopped Cheese", emoji: "🥪" },
  "bodega+money": { name: "Bodega Cat", emoji: "🐈" },
  "bodega+person": { name: "Regular Customer", emoji: "🙂" },
  "bodega+time": { name: "Midnight Bodega Run", emoji: "🏃" },
  "bodega+culture": { name: "Neighborhood Legend", emoji: "🏆" },
  "bodega+weather": { name: "Steamy Deli Counter", emoji: "♨️" },
  "dollar slice+new yorker": { name: "Pizza Rat", emoji: "🐀" },
  "dollar slice+time": { name: "2 AM Slice", emoji: "🌙" },
  "dollar slice+money": { name: "Inflation Slice", emoji: "😳" },
  "money+street food": { name: "Halal Cart", emoji: "🥙" },
  "halal cart+time": { name: "Lunch Rush", emoji: "🥙" },
  "halal cart+weather": { name: "Steam Cloud", emoji: "💨" },
  "halal cart+new yorker": { name: "White Sauce Debate", emoji: "🥫" },
  "new yorker+soup weather": { name: "Matzo Ball Soup", emoji: "🍲" },
  "late night snack+money": { name: "Coffee", emoji: "☕" },
  "chopped cheese+new yorker": { name: "Bodega Loyalty", emoji: "❤️" },
  "metrocard+subway station": { name: "MTA", emoji: "🚇" },
  "mta+time": { name: "Train Delay", emoji: "⏳" },
  "money+mta": { name: "Fare Hike", emoji: "📈" },
  "mta+weather": { name: "Service Alert", emoji: "⚠️" },
  "culture+mta": { name: "Subway Showtime", emoji: "🎤" },
  "rush hour+subway station": { name: "Packed Platform", emoji: "🫠" },
  "packed platform+weather": { name: "Summer Subway Heat", emoji: "🥵" },
  "packed platform+person": { name: "Personal Space Crisis", emoji: "😬" },
  "person+times square": { name: "Tourist", emoji: "📸" },
  "subway performer+tourist": { name: "Viral Video", emoji: "📱" },
  "subway station+times square": { name: "Times Square-42 St", emoji: "🚉" },
  "subway station+tourist": { name: "Subway Map Panic", emoji: "🗺️" },
  "subway map panic+time": { name: "Wrong Train", emoji: "🚆" },
  "new yorker+wrong train": { name: "Directions in a Hurry", emoji: "👉" },
  "commuter+train delay": { name: "Late to Work", emoji: "😰" },
  "coffee+train delay": { name: "Emotional Support Coffee", emoji: "☕" },
  "neighborhood+place": { name: "Borough", emoji: "🗺️" },
  "borough+culture": { name: "Brooklyn", emoji: "🌉" },
  "borough+food": { name: "Queens", emoji: "🌎" },
  "borough+person": { name: "The Bronx", emoji: "🎤" },
  "borough+transit": { name: "Manhattan", emoji: "🏙️" },
  "borough+weather": { name: "Staten Island", emoji: "⛴️" },
  "brooklyn+place": { name: "Brooklyn Bridge", emoji: "🌉" },
  "brooklyn+culture": { name: "Williamsburg", emoji: "☕" },
  "brooklyn+time": { name: "Rooftop Party", emoji: "🌆" },
  "brooklyn+money": { name: "Rising Rent", emoji: "📈" },
  "manhattan+place": { name: "Empire State Building", emoji: "🏙️" },
  "culture+manhattan": { name: "Broadway", emoji: "🎭" },
  "manhattan+transit": { name: "Grand Central", emoji: "🚉" },
  "food+queens": { name: "Queens Night Market", emoji: "🍢" },
  "queens+transit": { name: "7 Train", emoji: "7️⃣" },
  "place+the bronx": { name: "Yankee Stadium", emoji: "⚾" },
  "culture+the bronx": { name: "Hip Hop", emoji: "🎧" },
  "hip hop+new yorker": { name: "Cardi B", emoji: "💅" },
  "brooklyn+hip hop": { name: "Jay-Z", emoji: "🎧" },
  "hip hop+manhattan": { name: "Alicia Keys", emoji: "🎹" },
  "brooklyn+street artist": { name: "Spike Lee", emoji: "🎬" },
  "culture+staten island": { name: "Pete Davidson", emoji: "😂" },
  "broadway+culture": { name: "Lin-Manuel Miranda", emoji: "🎼" },
  "culture+queens": { name: "Nas", emoji: "🎤" },
  "new yorker+yankee stadium": { name: "Yankees Fan", emoji: "🧢" },
  "7 train+tourist": { name: "Mets Game", emoji: "⚾" },
  "manhattan+person": { name: "Spider-Man", emoji: "🕷️" },
  "empire state building+tourist": { name: "King Kong Moment", emoji: "🦍" },
  "busy new yorker+new yorker": { name: "Walking Fast", emoji: "🚶" },
  "tourist+walking fast": { name: "Sidewalk Rage", emoji: "😤" },
  "new yorker+subway flooding": { name: "Deadass?", emoji: "😐" },
  "culture+deadass?": { name: "NYC Slang", emoji: "🗣️" },
  "bodega cat+regular customer": { name: "Ock", emoji: "👨‍🍳" },
  "chopped cheese+ock": { name: "The Ocky Way", emoji: "🥪" },
  "payday+rent": { name: "Rent Due", emoji: "😰" },
  "person+rent due": { name: "Landlord", emoji: "🔑" },
  "new yorker+rent": { name: "Tiny Apartment", emoji: "📦" },
  "rising rent+williamsburg": { name: "Gentrification", emoji: "🏗️" },
  "culture+time": { name: "Nightlife", emoji: "🌃" },
  "brooklyn+nightlife": { name: "Bushwick Party", emoji: "🪩" },
  "money+nightlife": { name: "Cover Charge", emoji: "💵" },
  "rooftop party+weather": { name: "Rain Check", emoji: "☔" },
  "rent+rush hour": { name: "NYC Struggle", emoji: "😩" },
  "coffee+nyc struggle": { name: "Still Functioning", emoji: "🫡" }
};

function keyFor(a, b) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join("+");
}

function App() {
  const [elements, setElements] = useState(STARTERS);
  const [selected, setSelected] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filteredElements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter((e) => e.name.toLowerCase().includes(q));
  }, [elements, query]);

  function addUniqueElement(next) {
    let wasNew = false;
    setElements((current) => {
      const exists = current.some((item) => item.name.toLowerCase() === next.name.toLowerCase());
      if (exists) return current;
      wasNew = true;
      return [...current, next];
    });
    return wasNew;
  }

  function choose(element) {
    setError("");
    setNotice("");
    const nextSelected =
      selected.length === 0 ? [element] : selected.length === 1 ? [selected[0], element] : [element];
    setSelected(nextSelected);

    if (nextSelected.length !== 2) return;

    const [a, b] = nextSelected;
    const result = COMBINATIONS[keyFor(a.name, b.name)];
    setSelected([]);

    if (!result) {
      setError("No local NYC craft recipe for that combo yet. Try another pairing!");
      return;
    }

    const isNew = addUniqueElement(result);
    setHistory((current) => [{ a, b, result, source: "local", id: crypto.randomUUID() }, ...current]);
    setNotice(isNew ? `🔥 New NYC discovery: ${result.name}` : `Already discovered: ${result.name}`);
  }

  function resetLocal() {
    setSelected([]);
    setHistory([]);
    setQuery("");
    setError("");
    setNotice("");
    setElements(STARTERS);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Offline NYC-themed demo</p>
          <h1>NYC Crafts</h1>
          <p className="subtitle">
            Combine NYC food, transit chaos, boroughs, slang, famous figures, nightlife,
            landmarks, and everyday city moments into funny local discoveries.
          </p>
        </div>

        <button className="ghostButton" onClick={resetLocal}>
          Reset Progress
        </button>
      </section>

      <section className="selectedPanel">
        <div>
          <span className="muted">Selected</span>
          <div className="selectedItems">
            {selected.length === 0 && <strong>Pick two NYC nodes</strong>}
            {selected.map((item) => (
              <Chip key={item.name} item={item} active />
            ))}
          </div>
        </div>
      </section>

      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <section className="grid">
        <aside className="panel">
          <div className="panelHeader">
            <h2>Nodes</h2>
            <span>{elements.length}</span>
          </div>

          <input
            className="search"
            placeholder="Search NYC nodes..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="elementList">
            {filteredElements.map((element) => (
              <button key={element.name} className="elementButton" onClick={() => choose(element)}>
                <span>{element.emoji}</span>
                {element.name}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="panelHeader">
            <h2>Recent crafts</h2>
            <span>{history.length}</span>
          </div>

          <div className="history">
            {history.length === 0 && <p className="empty">Your local NYC discoveries will appear here.</p>}

            {history.map((entry) => (
              <article className="recipe" key={entry.id}>
                <div className="recipeFormula">
                  <Chip item={entry.a} /> <span>+</span> <Chip item={entry.b} /> <span>=</span>{" "}
                  <Chip item={entry.result} active />
                </div>
                <small>Local pairing</small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Chip({ item, active = false }) {
  return (
    <span className={active ? "chip activeChip" : "chip"}>
      <span>{item.emoji}</span>
      {item.name}
    </span>
  );
}

createRoot(document.getElementById("root")).render(<App />);
