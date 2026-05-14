import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ForceGraph2D from "react-force-graph-2d";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

const STARTERS = [
  {
    name: "Person",
    emoji: "🧍",
  },
  {
    name: "Place",
    emoji: "📍",
  },
  {
    name: "Food",
    emoji: "🍕",
  },
  {
    name: "Transit",
    emoji: "🚇",
  },
  {
    name: "Money",
    emoji: "💸",
  },
  {
    name: "Time",
    emoji: "⏰",
  },
  {
    name: "Weather",
    emoji: "🌧️",
  },
  {
    name: "Culture",
    emoji: "🎭",
  },
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

function formatDuration(ms = 0) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const tenths = Math.floor((safeMs % 1000) / 100);

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  return `${seconds}.${tenths}s`;
}

function MapPage({ apiBase, graphVersion, onBack }) {
  const [graph, setGraph] = React.useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = React.useState(null);
  const [error, setError] = React.useState("");
  const graphRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      try {
        setError("");

        const res = await fetch(`${apiBase}/api/graph/global`);

        if (!res.ok) {
          throw new Error(`Graph request failed: ${res.status}`);
        }

        const data = await res.json();

        if (cancelled) return;

        setGraph({
          nodes: data.nodes || [],
          links: data.edges || [],
        });
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Could not load global recipe map.");
        }
      }
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, [apiBase, graphVersion]);

  function configureForces() {
    if (!graphRef.current) return;

    const fg = graphRef.current;
    const charge = fg.d3Force("charge");
    const link = fg.d3Force("link");
    const center = fg.d3Force("center");

    if (charge) charge.strength(-360);
    if (link) link.distance(140);
    if (center) center.strength(0.04);
  }

  React.useEffect(() => {
    configureForces();
  }, [graph.nodes.length, graph.links.length]);

  const highlight = React.useMemo(() => {
    if (!selectedNode) {
      return {
        selected: null,
        incoming: new Set(),
        outgoing: new Set(),
        activeNodes: new Set(),
      };
    }

    const selected = String(selectedNode.id);

    const incoming = new Set();
    const outgoing = new Set();
    const activeNodes = new Set([selected]);

    const reverseLinks = new Map();
    const forwardLinks = new Map();

    for (const link of graph.links) {
      const source = String(
        typeof link.source === "object" ? link.source.id : link.source,
      );

      const target = String(
        typeof link.target === "object" ? link.target.id : link.target,
      );

      if (!forwardLinks.has(source)) forwardLinks.set(source, []);
      if (!reverseLinks.has(target)) reverseLinks.set(target, []);

      forwardLinks.get(source).push({ source, target, id: String(link.id) });
      reverseLinks.get(target).push({ source, target, id: String(link.id) });
    }

    const visitedIncoming = new Set();
    const visitedOutgoing = new Set();

    function walkIncoming(nodeId) {
      if (visitedIncoming.has(nodeId)) return;
      visitedIncoming.add(nodeId);

      const links = reverseLinks.get(nodeId) || [];

      for (const link of links) {
        incoming.add(link.id);
        activeNodes.add(link.source);
        activeNodes.add(link.target);
        walkIncoming(link.source);
      }
    }

    function walkOutgoing(nodeId) {
      if (visitedOutgoing.has(nodeId)) return;
      visitedOutgoing.add(nodeId);

      const links = forwardLinks.get(nodeId) || [];

      for (const link of links) {
        outgoing.add(link.id);
        activeNodes.add(link.source);
        activeNodes.add(link.target);
        walkOutgoing(link.target);
      }
    }

    walkIncoming(selected);
    walkOutgoing(selected);

    return {
      selected,
      incoming,
      outgoing,
      activeNodes,
    };
  }, [selectedNode, graph.links]);

  function getNodeId(node) {
    return String(node.id);
  }

  function getLinkId(link) {
    return String(link.id);
  }

  return (
    <div className="map-page">
      <div className="map-header">
        <div>
          <h1>NYC Recipe Map</h1>
          <p>
            <p>
              Click a node to highlight <span className="blueText">blue</span>{" "}
              incoming recipe chains and{" "}
              <span className="orangeText">orange</span> outgoing recipe chains.
            </p>
          </p>
        </div>

        <button className="ghostButton" onClick={onBack}>
          Back to Crafting
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="map-shell">
        <ForceGraph2D
          ref={graphRef}
          graphData={graph}
          nodeId="id"
          nodeLabel={(node) => `${node.emoji || "✨"} ${node.label}`}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          d3VelocityDecay={0.32}
          d3AlphaDecay={0.016}
          warmupTicks={180}
          cooldownTicks={320}
          onEngineTick={configureForces}
          onNodeClick={(node) => {
            setSelectedNode(node);

            if (graphRef.current) {
              graphRef.current.centerAt(node.x, node.y, 600);
              graphRef.current.zoom(2.2, 600);
            }
          }}
          onBackgroundClick={() => setSelectedNode(null)}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 28, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const nodeId = getNodeId(node);
            const isSelected = highlight.selected === nodeId;
            const isActive =
              !highlight.selected || highlight.activeNodes.has(nodeId);

            const emoji = node.emoji || "✨";
            const label = node.label || "";

            const emojiSize = isSelected
              ? Math.max(18, 30 / globalScale)
              : Math.max(15, 24 / globalScale);

            const labelSize = Math.max(8, 12 / globalScale);
            const radius = isSelected ? 18 : 14;

            ctx.globalAlpha = isActive ? 1 : 0.12;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);

            if (isSelected) {
              ctx.fillStyle = "#111827";
            } else if (highlight.activeNodes.has(nodeId)) {
              ctx.fillStyle = "#f9fafb";
            } else {
              ctx.fillStyle = "#ffffff";
            }

            ctx.fill();

            ctx.lineWidth = isSelected ? 2.5 : 1.25;

            if (isSelected) {
              ctx.strokeStyle = "#111827";
            } else if (highlight.activeNodes.has(nodeId)) {
              ctx.strokeStyle = "#9ca3af";
            } else {
              ctx.strokeStyle = "#d1d5db";
            }

            ctx.stroke();

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.font = `${emojiSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
            ctx.fillStyle = "#111827";
            ctx.fillText(emoji, node.x, node.y);

            if (globalScale > 0.45 || isSelected) {
              ctx.font = `600 ${labelSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
              ctx.textBaseline = "top";
              ctx.fillStyle = isSelected ? "#111827" : "#374151";

              const maxWidth = 100 / globalScale;
              const words = label.split(" ");
              const lines = [];
              let line = "";

              for (const word of words) {
                const testLine = line ? `${line} ${word}` : word;
                const width = ctx.measureText(testLine).width;

                if (width > maxWidth && line) {
                  lines.push(line);
                  line = word;
                } else {
                  line = testLine;
                }
              }

              if (line) lines.push(line);

              lines.slice(0, 2).forEach((text, index) => {
                ctx.fillText(
                  text,
                  node.x,
                  node.y + radius + 4 + index * (labelSize + 2),
                );
              });
            }

            ctx.globalAlpha = 1;
          }}
          linkColor={(link) => {
            const id = getLinkId(link);

            if (!highlight.selected) return "rgba(156, 163, 175, 0.45)";
            if (highlight.incoming.has(id)) return "rgba(37, 99, 235, 0.9)";
            if (highlight.outgoing.has(id)) return "rgba(249, 115, 22, 0.9)";

            return "rgba(156, 163, 175, 0.12)";
          }}
          linkWidth={(link) => {
            const id = getLinkId(link);

            if (!highlight.selected) return 1;
            if (highlight.incoming.has(id) || highlight.outgoing.has(id)) {
              return 2.5;
            }

            return 0.5;
          }}
          linkDirectionalParticles={(link) => {
            const id = getLinkId(link);

            if (highlight.incoming.has(id) || highlight.outgoing.has(id)) {
              return 2;
            }

            return 0;
          }}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.006}
        />
      </div>

      <div className="map-legend">
        <span>
          <b className="dot selected-dot" /> Selected
        </span>
        <span>
          <b className="dot incoming-dot" /> Incoming
        </span>
        <span>
          <b className="dot outgoing-dot" /> Outgoing
        </span>
      </div>
    </div>
  );
}

function Leaderboard({ scores = [] }) {
  if (!scores.length) {
    return <p className="empty">No winning runs yet. Set the first time.</p>;
  }

  return (
    <ol className="leaderboard">
      {scores.map((score, index) => (
        <li key={`${score.playerName}-${score.durationMs}-${index}`}>
          <span className="rank">{index + 1}</span>
          <span>{score.playerName}</span>
          <strong>{formatDuration(score.durationMs)}</strong>
        </li>
      ))}
    </ol>
  );
}

function LandingPage({
  target,
  leaderboard,
  playerName,
  onPlayerNameChange,
  onStart,
  onExplore,
  loading,
  error,
}) {
  return (
    <main className="landing">
      <section className="landingHero">
        <div className="landingArt" aria-hidden="true">
          <span>Person</span>
          <span>Transit</span>
          <span>Food</span>
          <span>Culture</span>
          <b>{target?.name || "Target"}</b>
        </div>

        <div className="landingCopy">
          <p className="eyebrow">Fastest craft wins</p>
          <h1>NYCrafts Sprint</h1>
          <p className="subtitle">
            Race from the starter set to the selected word. The clock starts
            when you enter the arena and stops the moment your craft creates
            the target.
          </p>

          <form className="startForm" onSubmit={onStart}>
            <label>
              Player name
              <input
                className="search"
                value={playerName}
                maxLength={24}
                onChange={(event) => onPlayerNameChange(event.target.value)}
                placeholder="Your name"
              />
            </label>

            <div className="targetCallout">
              <span>Target word</span>
              <strong>
                {target?.emoji} {target?.name || "Loading..."}
              </strong>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="heroActions">
              <button className="primaryButton" type="submit" disabled={loading}>
                {loading ? "Starting..." : "Start Race"}
              </button>
              <button className="ghostButton" type="button" onClick={onExplore}>
                Free Craft
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="landingBoard">
        <div className="panelHeader">
          <h2>Fastest times</h2>
          <span>{leaderboard.length}</span>
        </div>
        <Leaderboard scores={leaderboard} />
      </section>
    </main>
  );
}

function App() {
  const [elements, setElements] = useState(STARTERS);
  const [selected, setSelected] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState("landing");
  const [graphVersion, setGraphVersion] = useState(0);
  const [playerName, setPlayerName] = useState(
    localStorage.getItem("player_name") || "",
  );
  const [target, setTarget] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [winner, setWinner] = useState(null);

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

  useEffect(() => {
    fetch(`${API_BASE}/api/challenge`)
      .then((r) => r.json())
      .then((data) => {
        if (data.target) setTarget(data.target);
        if (Array.isArray(data.leaderboard)) setLeaderboard(data.leaderboard);
      })
      .catch(() => {
        setError("Could not load the race target.");
      });
  }, []);

  useEffect(() => {
    if (!challenge || challenge.completed) return undefined;

    const tick = () => setElapsedMs(Date.now() - challenge.startedAtMs);
    tick();
    const timer = window.setInterval(tick, 100);

    return () => window.clearInterval(timer);
  }, [challenge]);

  const filteredElements = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return elements;

    return elements.filter((element) => element.name.toLowerCase().includes(q));
  }, [elements, query]);

  function addUniqueElement(next) {
    setElements((current) => {
      const exists = current.some(
        (item) => item.name.toLowerCase() === next.name.toLowerCase(),
      );

      return exists ? current : [...current, next];
    });
  }

  async function startChallenge(event) {
    event.preventDefault();

    const trimmedName = playerName.trim();

    if (!trimmedName) {
      setError("Enter a player name before starting.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/challenge/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": DEVICE_ID,
        },
        body: JSON.stringify({
          playerName: trimmedName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start challenge.");
      }

      localStorage.setItem("player_name", trimmedName);
      setPlayerName(trimmedName);
      setTarget(data.target);
      setElements(data.elements || STARTERS);
      setHistory([]);
      setSelected([]);
      setQuery("");
      setWinner(null);
      setElapsedMs(0);
      setChallenge({
        sessionId: data.sessionId,
        startedAtMs: data.startedAtMs,
        completed: false,
      });
      setPage("craft");
      setGraphVersion((current) => current + 1);
    } catch (err) {
      setError(err.message || "Could not start challenge.");
    } finally {
      setBusy(false);
    }
  }

  async function finishChallenge(resultName) {
    if (!challenge || challenge.completed) return;

    try {
      const response = await fetch(`${API_BASE}/api/challenge/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": DEVICE_ID,
        },
        body: JSON.stringify({
          sessionId: challenge.sessionId,
          resultName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not finish challenge.");
      }

      setChallenge((current) =>
        current
          ? {
              ...current,
              completed: true,
            }
          : current,
      );
      setElapsedMs(data.session.durationMs);
      setWinner(data.session);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err.message || "Could not finish challenge.");
    }
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
        body: JSON.stringify({
          a: a.name,
          b: b.name,
        }),
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

      setGraphVersion((current) => current + 1);

      if (
        challenge &&
        !challenge.completed &&
        target &&
        result.name.toLowerCase() === target.name.toLowerCase()
      ) {
        await finishChallenge(result.name);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function resetLocal() {
    const confirmed = window.confirm(
      "Are you sure? This will erase this device's progress and recent crafts.",
    );

    if (!confirmed) return;

    try {
      await fetch(`${API_BASE}/api/reset`, {
        method: "POST",
        headers: {
          "X-Device-Id": DEVICE_ID,
        },
      });

      setSelected([]);
      setHistory([]);
      setQuery("");
      setElements(STARTERS);
      setChallenge(null);
      setWinner(null);
      setElapsedMs(0);
      setGraphVersion((current) => current + 1);
    } catch (err) {
      setError("Could not reset progress.");
    }
  }

  if (page === "landing") {
    return (
      <LandingPage
        target={target}
        leaderboard={leaderboard}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        onStart={startChallenge}
        onExplore={() => {
          setError("");
          setPage("craft");
        }}
        loading={busy}
        error={error}
      />
    );
  }

  if (page === "map") {
    return (
      <MapPage
        apiBase={API_BASE}
        graphVersion={graphVersion}
        onBack={() => setPage("craft")}
      />
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {challenge ? "Race in progress" : "OpenAI + embeddings"}
          </p>
          <h1>{challenge ? "Find the Word" : "NYCrafts CTP"}</h1>
          <p className="subtitle">
            {challenge
              ? "Combine any two elements until you craft the selected target. Your official score is the server-timed run duration."
              : "Combine NYC food, transit chaos, boroughs, slang, famous figures, nightlife, landmarks, and everyday city moments into funny local discoveries."}
          </p>
        </div>

        <div className="heroActions">
          <button className="ghostButton" onClick={() => setPage("landing")}>
            Race Home
          </button>

          <button className="ghostButton" onClick={() => setPage("map")}>
            Map
          </button>

          <button className="ghostButton" onClick={resetLocal}>
            Reset Progress
          </button>
        </div>
      </section>

      <section className="gameBar">
        <div>
          <span className="muted">Target</span>
          <strong>{target ? `${target.emoji} ${target.name}` : "Free craft"}</strong>
        </div>
        <div>
          <span className="muted">Time</span>
          <strong>{formatDuration(elapsedMs)}</strong>
        </div>
        <div>
          <span className="muted">Player</span>
          <strong>{playerName || "Guest"}</strong>
        </div>
      </section>

      {winner && (
        <section className="winBanner">
          <div>
            <span className="muted">Finished</span>
            <strong>{formatDuration(winner.durationMs)}</strong>
          </div>
          <button className="primaryButton" onClick={() => setPage("landing")}>
            View Standings
          </button>
        </section>
      )}

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
