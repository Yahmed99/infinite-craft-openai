import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE;

const STARTERS = [
  { name: "Water", emoji: "💧" },
  { name: "Fire", emoji: "🔥" },
  { name: "Earth", emoji: "🌍" },
  { name: "Wind", emoji: "🌬️" },
  { name: "Surfboard", emoji: "🏄" },
];

function getDeviceId() {
  let id = localStorage.getItem("device_id");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }

  return id;
}

const DEVICE_ID = getDeviceId();
function App() {
  const [elements, setElements] = useState(STARTERS);
  const [selected, setSelected] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/elements`, {
      headers: {
        "X-Device-Id": DEVICE_ID,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.elements) && data.elements.length) {
          setElements(data.elements);
        }
      })
      .catch(() => {});
  }, []);

  const filteredElements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter((e) => e.name.toLowerCase().includes(q));
  }, [elements, query]);

  function addUniqueElement(next) {
    setElements((current) => {
      const exists = current.some(
        (item) => item.name.toLowerCase() === next.name.toLowerCase(),
      );
      return exists ? current : [...current, next];
    });
  }

  async function choose(element) {
    setError("");

    const nextSelected =
      selected.length === 0
        ? [element]
        : selected.length === 1
          ? [selected[0], element]
          : [element];

    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      await combine(nextSelected[0], nextSelected[1]);
      setSelected([]);
    }
  }

  async function combine(a, b) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/combine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": DEVICE_ID,
        },
        body: JSON.stringify({ a: a.name, b: b.name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Combination failed.");
      }

      const result = data.result;
      addUniqueElement(result);

      setHistory((current) => [
        {
          a,
          b,
          result,
          source: data.source,
          id: crypto.randomUUID(),
        },
        ...current,
      ]);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

async function resetLocal() {
  const confirmed = window.confirm(
    "Are you sure? This will erase this device's progress and recent crafts."
  );

  if (!confirmed) return;

  await fetch(`${API_BASE}/api/reset`, {
    method: "POST",
    headers: {
      "X-Device-Id": DEVICE_ID
    }
  });

  setSelected([]);
  setHistory([]);
  setQuery("");
  setElements(STARTERS);
}

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">OpenAI + embeddings</p>
          <h1>Infinite Craft CTP</h1>
          <p className="subtitle">
            Click two elements to combine them. New recipes are generated once,
            cached, and remembered.
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
            {selected.length === 0 && (
              <strong>
                Pick two items
                {history.length > 0 && (
                  <>
                    {" "}
                    | Last item: {history[0].result.emoji}{" "}
                    {history[0].result.name}
                  </>
                )}
              </strong>
            )}
            {selected.map((item) => (
              <Chip key={item.name} item={item} active />
            ))}
          </div>
        </div>

        {busy && <div className="loader">Crafting…</div>}
      </section>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        <aside className="panel">
          <div className="panelHeader">
            <h2>Elements</h2>
            <span>{elements.length}</span>
          </div>

          <input
            className="search"
            placeholder="Search elements…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="elementList">
            {filteredElements.map((element) => (
              <button
                key={element.name}
                className="elementButton"
                onClick={() => choose(element)}
                disabled={busy}
              >
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
            {history.length === 0 && (
              <p className="empty">Your discoveries will appear here.</p>
            )}

            {history.map((entry) => (
              <article className="recipe" key={entry.id}>
                <div className="recipeFormula">
                  <Chip item={entry.a} />
                  <span>+</span>
                  <Chip item={entry.b} />
                  <span>=</span>
                  <Chip item={entry.result} active />
                </div>
                <small>
                  {entry.source === "generated" ? "Generated" : "From cache"}
                </small>
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
