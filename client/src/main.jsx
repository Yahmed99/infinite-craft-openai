import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ForceGraph2D from "react-force-graph-2d";
import "./styles.css";

// Production uses same-origin /api (proxied to Render on Vercel). Dev uses local API.
const API_BASE = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE || "http://localhost:8787"
  : "";

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

const STARTER_NAMES = new Set(
  STARTERS.map((item) => item.name.trim().toLowerCase()),
);

function isStarterCraft(name) {
  return STARTER_NAMES.has(String(name ?? "").trim().toLowerCase());
}

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

function getChallengeElapsedMs(challenge, now = Date.now()) {
  if (!challenge) return 0;

  let pausedMs = challenge.pausedMs || 0;

  if (challenge.pausedAtMs) {
    pausedMs += now - challenge.pausedAtMs;
  }

  return Math.max(0, now - challenge.startedAtMs - pausedMs);
}

function isChallengePaused(challenge) {
  return Boolean(challenge?.pausedAtMs);
}

const PAGES = {
  race: { id: "race", label: "Race" },
  sandbox: { id: "sandbox", label: "Sandbox" },
  map: { id: "map", label: "Map" },
  reset: { id: "reset", label: "Reset" },
};

function AppNav({ currentPage, onNavigate }) {
  return (
    <nav className="appNav" aria-label="Main">
      {Object.values(PAGES).map((page) => (
        <button
          key={page.id}
          type="button"
          className={
            currentPage === page.id ? "navTab navTabActive" : "navTab"
          }
          onClick={() => onNavigate(page.id)}
        >
          {page.label}
        </button>
      ))}
    </nav>
  );
}

function AppShell({
  currentPage,
  onNavigate,
  eyebrow,
  title,
  subtitle,
  hideHero = false,
  children,
}) {
  return (
    <main className={`appShell${hideHero ? " appShellCompact" : ""}`}>
      <header className="appHeader">
        <div className="brandBlock">
          <button
            type="button"
            className="brandButton"
            onClick={() => onNavigate("race")}
          >
            NYCrafts
          </button>
        </div>
        <AppNav currentPage={currentPage} onNavigate={onNavigate} />
      </header>

      {!hideHero && (
        <section className="pageHero">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </section>
      )}

      <div className={hideHero ? "pageContentCompact" : "pageContent"}>
        {children}
      </div>
    </main>
  );
}

const MAP_SEARCH_RESULT_LIMIT = 25;

function MapPage({ apiBase, graphVersion }) {
  const [graph, setGraph] = React.useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const graphRef = React.useRef(null);
  const pendingFocusId = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      try {
        setLoading(true);
        pendingFocusId.current = null;
        setError("");

        const res = await fetch(`${apiBase}/api/graph/global`);

        if (!res.ok) {
          throw new Error(`Graph request failed: ${res.status}`);
        }

        const data = await res.json();

        if (cancelled) return;

        const nodes = data.nodes || [];
        const links = data.edges || [];

        setGraph({ nodes, links });
        setSelectedNode((current) => {
          if (!current) return null;

          return (
            nodes.find((node) => String(node.id) === String(current.id)) || null
          );
        });
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Could Not Load Global Recipe Map.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
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

  const filteredNodes = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return [];

    return graph.nodes
      .filter((node) => String(node.label || "").toLowerCase().includes(q))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [graph.nodes, query]);

  const visibleSearchResults = filteredNodes.slice(0, MAP_SEARCH_RESULT_LIMIT);
  const hiddenSearchCount = Math.max(
    0,
    filteredNodes.length - visibleSearchResults.length,
  );

  const directConnections = React.useMemo(() => {
    if (!selectedNode) {
      return { incoming: [], outgoing: [] };
    }

    const selected = getNodeId(selectedNode);
    const incoming = [];
    const outgoing = [];
    const incomingIds = new Set();
    const outgoingIds = new Set();

    for (const link of graph.links) {
      const source = String(
        typeof link.source === "object" ? link.source.id : link.source,
      );
      const target = String(
        typeof link.target === "object" ? link.target.id : link.target,
      );

      if (target === selected && !incomingIds.has(source)) {
        incomingIds.add(source);
        const node = graph.nodes.find((item) => getNodeId(item) === source);
        if (node) incoming.push(node);
      }

      if (source === selected && !outgoingIds.has(target)) {
        outgoingIds.add(target);
        const node = graph.nodes.find((item) => getNodeId(item) === target);
        if (node) outgoing.push(node);
      }
    }

    incoming.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    outgoing.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    return { incoming, outgoing };
  }, [selectedNode, graph.links, graph.nodes]);

  function focusNode(node) {
    if (!graphRef.current || node?.x == null || node?.y == null) return;

    graphRef.current.centerAt(node.x, node.y, 600);
    graphRef.current.zoom(2.2, 600);
  }

  function selectNode(node) {
    setSelectedNode(node);
    pendingFocusId.current = getNodeId(node);
    focusNode(node);

    if (node?.x != null && node?.y != null) {
      pendingFocusId.current = null;
    }
  }

  function handleEngineStop() {
    configureForces();

    if (!pendingFocusId.current) return;

    const node = graph.nodes.find(
      (item) => getNodeId(item) === pendingFocusId.current,
    );

    if (!node) {
      pendingFocusId.current = null;
      return;
    }

    focusNode(node);

    if (node.x != null && node.y != null) {
      pendingFocusId.current = null;
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key !== "Enter" || filteredNodes.length === 0) return;

    event.preventDefault();
    selectNode(filteredNodes[0]);
  }

  return (
    <>
      {error && <div className="error">{error}</div>}

      <section className="panel mapPanel">
        <div className="mapSearchPanel">
          <div className="panelHeader">
            <h2>Search Crafts</h2>
            <span>{loading ? "…" : graph.nodes.length}</span>
          </div>

          <input
            className="search mapSearchInput"
            placeholder="Search Crafts…"
            value={query}
            disabled={loading}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />

          <div className="mapSearchResults">
            {loading && <p className="empty">Loading Craft Graph…</p>}

            {!loading && !query.trim() && (
              <p className="empty">Type To Search Crafts In The Graph.</p>
            )}

            {!loading && query.trim() && filteredNodes.length === 0 && (
              <p className="empty">No Crafts Match That Search.</p>
            )}

            {!loading &&
              visibleSearchResults.map((node) => {
                const isSelected =
                  selectedNode && getNodeId(selectedNode) === getNodeId(node);

                return (
                  <button
                    key={getNodeId(node)}
                    type="button"
                    className={
                      isSelected
                        ? "elementButton mapSearchItem active"
                        : "elementButton mapSearchItem"
                    }
                    onClick={() => selectNode(node)}
                  >
                    <span>{node.emoji || "✨"}</span>
                    {node.label}
                  </button>
                );
              })}

            {!loading && hiddenSearchCount > 0 && (
              <p className="empty mapSearchMore">
                +{hiddenSearchCount} More — Refine Your Search.
              </p>
            )}
          </div>

          {selectedNode && (
            <div className="mapSelectedCraft">
              <div className="mapSelectedSummary">
                <span className="muted">Selected Craft</span>
                <div className="mapSelectedHero">
                  <span>{selectedNode.emoji || "✨"}</span>
                  <strong>{selectedNode.label}</strong>
                </div>
              </div>

              <div className="mapConnectionGroup">
                <span className="mapConnectionLabel incoming-label">
                  Parent ({directConnections.incoming.length})
                </span>
                {directConnections.incoming.length === 0 ? (
                  <p className="empty mapConnectionEmpty">No Parent Crafts.</p>
                ) : (
                  <div className="mapConnectionList">
                    {directConnections.incoming.map((node) => (
                      <button
                        key={`in-${getNodeId(node)}`}
                        type="button"
                        className="elementButton mapConnectionChip"
                        onClick={() => selectNode(node)}
                      >
                        <span>{node.emoji || "✨"}</span>
                        {node.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mapConnectionGroup">
                <span className="mapConnectionLabel outgoing-label">
                  Child ({directConnections.outgoing.length})
                </span>
                {directConnections.outgoing.length === 0 ? (
                  <p className="empty mapConnectionEmpty">No Child Crafts.</p>
                ) : (
                  <div className="mapConnectionList">
                    {directConnections.outgoing.map((node) => (
                      <button
                        key={`out-${getNodeId(node)}`}
                        type="button"
                        className="elementButton mapConnectionChip"
                        onClick={() => selectNode(node)}
                      >
                        <span>{node.emoji || "✨"}</span>
                        {node.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mapGraphColumn">
          <div className="map-shell">
            {loading && (
              <div className="mapLoadingOverlay">
                <div className="loader">Loading Graph…</div>
              </div>
            )}
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
          onEngineStop={handleEngineStop}
          onNodeClick={(node) => selectNode(node)}
          onBackgroundClick={() => {
            pendingFocusId.current = null;
            setSelectedNode(null);
          }}
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
              ctx.fillStyle = "#f0b429";
            } else if (highlight.activeNodes.has(nodeId)) {
              ctx.fillStyle = "#1e2a3d";
            } else {
              ctx.fillStyle = "#141c2b";
            }

            ctx.fill();

            ctx.lineWidth = isSelected ? 2.5 : 1.25;

            if (isSelected) {
              ctx.strokeStyle = "#f0b429";
            } else if (highlight.activeNodes.has(nodeId)) {
              ctx.strokeStyle = "#5b9cff";
            } else {
              ctx.strokeStyle = "#2a3548";
            }

            ctx.stroke();

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.font = `${emojiSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
            ctx.fillStyle = "#e8edf5";
            ctx.fillText(emoji, node.x, node.y);

            if (globalScale > 0.45 || isSelected) {
              ctx.font = `600 ${labelSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
              ctx.textBaseline = "top";
              ctx.fillStyle = isSelected ? "#f0b429" : "#8b96a8";

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

            if (!highlight.selected) return "rgba(91, 156, 255, 0.28)";
            if (highlight.incoming.has(id)) return "rgba(91, 156, 255, 0.95)";
            if (highlight.outgoing.has(id)) return "rgba(255, 155, 84, 0.95)";

            return "rgba(42, 53, 72, 0.35)";
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
      </section>
    </>
  );
}

function Leaderboard({ scores = [] }) {
  if (!scores.length) {
    return <p className="empty">No Winning Runs Yet. Set The First Time.</p>;
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

function RacePage({
  mode,
  onModeChange,
  dailyTarget,
  leaderboard,
  playerName,
  onPlayerNameChange,
  onStartDaily,
  onContinueDaily,
  onContinuePractice,
  challenge,
  practiceSession,
  allCrafts,
  craftsLoading,
  practiceQuery,
  onPracticeQueryChange,
  practiceTarget,
  onPracticeTargetChange,
  onStartPractice,
  loading,
  error,
}) {
  const raceActive = challenge && !challenge.completed;
  const practiceActive = practiceSession && !practiceSession.completed;

  const practiceCrafts = React.useMemo(
    () => allCrafts.filter((craft) => !isStarterCraft(craft.name)),
    [allCrafts],
  );

  const filteredCrafts = React.useMemo(() => {
    const q = practiceQuery.trim().toLowerCase();

    if (!q) return [];

    return practiceCrafts.filter((craft) =>
      String(craft.name || "").toLowerCase().includes(q),
    );
  }, [practiceCrafts, practiceQuery]);

  const starterMatches = React.useMemo(() => {
    const q = practiceQuery.trim().toLowerCase();

    if (!q) return [];

    return allCrafts.filter(
      (craft) =>
        isStarterCraft(craft.name) &&
        String(craft.name || "").toLowerCase().includes(q),
    );
  }, [allCrafts, practiceQuery]);

  const visibleCrafts = filteredCrafts.slice(0, MAP_SEARCH_RESULT_LIMIT);
  const hiddenCraftCount = Math.max(
    0,
    filteredCrafts.length - visibleCrafts.length,
  );

  React.useEffect(() => {
    if (practiceTarget && isStarterCraft(practiceTarget.name)) {
      onPracticeTargetChange(null);
    }
  }, [practiceTarget, onPracticeTargetChange]);

  return (
    <>
      {raceActive && (
        <section className="statusBanner">
          <p>
            Daily Challenge In Progress For{" "}
            <strong>{playerName || "Guest"}</strong>.
          </p>
          <button
            className="primaryButton"
            type="button"
            onClick={onContinueDaily}
          >
            Continue Challenge
          </button>
        </section>
      )}

      {practiceActive && (
        <section className="statusBanner">
          <p>
            Practice In Progress For{" "}
            <strong>
              {practiceSession.target.emoji} {practiceSession.target.name}
            </strong>
            .
          </p>
          <button
            className="primaryButton"
            type="button"
            onClick={onContinuePractice}
          >
            Continue Practice
          </button>
        </section>
      )}

      <div className="raceModeToggle">
        <button
          type="button"
          className={
            mode === "daily" ? "raceModeButton active" : "raceModeButton"
          }
          disabled={practiceActive}
          title={
            practiceActive
              ? "Finish Or End Practice Before Switching Modes."
              : undefined
          }
          onClick={() => onModeChange("daily")}
        >
          Daily Challenge
        </button>
        <button
          type="button"
          className={
            mode === "practice" ? "raceModeButton active" : "raceModeButton"
          }
          disabled={raceActive}
          title={
            raceActive
              ? "Finish Or Cancel The Daily Challenge Before Switching Modes."
              : undefined
          }
          onClick={() => onModeChange("practice")}
        >
          Practice
        </button>
      </div>

      <div className={mode === "daily" ? "raceLayout" : "raceLayout raceLayoutSingle"}>
        {mode === "daily" ? (
          <>
            <section className="panel racePanel">
              <form className="startForm" onSubmit={onStartDaily}>
                <label>
                  Player Name
                  <input
                    className="search"
                    value={playerName}
                    maxLength={24}
                    onChange={(event) => onPlayerNameChange(event.target.value)}
                    placeholder="Your Name"
                  />
                </label>

                <div className="targetCallout">
                  <span>Today&apos;s Target</span>
                  <strong>
                    {dailyTarget?.emoji} {dailyTarget?.name || "Loading..."}
                  </strong>
                </div>

                {error && mode === "daily" && (
                  <div className="error">{error}</div>
                )}

                <button
                  className="primaryButton"
                  type="submit"
                  disabled={loading || !dailyTarget}
                >
                  {loading
                    ? "Starting…"
                    : raceActive
                      ? "Restart Challenge"
                      : "Start Daily Challenge"}
                </button>
              </form>
            </section>

            <section className="panel racePanel">
              <div className="panelHeader">
                <h2>Fastest Times</h2>
                <span>{leaderboard.length}</span>
              </div>
              <Leaderboard scores={leaderboard} />
            </section>
          </>
        ) : (
          <>
            <section className="panel racePanel">
              <form className="startForm" onSubmit={onStartPractice}>
                <div className="panelHeader">
                  <h2>Choose Target Craft</h2>
                  <span>{craftsLoading ? "…" : practiceCrafts.length}</span>
                </div>

                <input
                  className="search"
                  placeholder="Search Crafts To Combine Toward…"
                  value={practiceQuery}
                  disabled={craftsLoading}
                  onChange={(event) => onPracticeQueryChange(event.target.value)}
                />

                <div className="practiceCraftList">
                  {craftsLoading && (
                    <p className="empty">Loading Crafts…</p>
                  )}

                  {!craftsLoading && !practiceQuery.trim() && (
                    <p className="empty">
                      Search For A Craft To Practice Reaching. Starter Elements
                      Are Already Available.
                    </p>
                  )}

                  {!craftsLoading &&
                    practiceQuery.trim() &&
                    filteredCrafts.length === 0 &&
                    starterMatches.length > 0 && (
                      <p className="empty">
                        Starter Elements Are Already Available At The Start. Pick
                        A Craft To Combine Toward.
                      </p>
                    )}

                  {!craftsLoading &&
                    practiceQuery.trim() &&
                    filteredCrafts.length === 0 &&
                    starterMatches.length === 0 && (
                      <p className="empty">No Crafts Match That Search.</p>
                    )}

                  {!craftsLoading &&
                    visibleCrafts.map((craft) => {
                      const isSelected =
                        practiceTarget &&
                        practiceTarget.name.toLowerCase() ===
                          craft.name.toLowerCase();

                      return (
                        <button
                          key={craft.name}
                          type="button"
                          className={
                            isSelected
                              ? "elementButton practiceCraftItem active"
                              : "elementButton practiceCraftItem"
                          }
                          onClick={() => onPracticeTargetChange(craft)}
                        >
                          <span>{craft.emoji || "✨"}</span>
                          {craft.name}
                        </button>
                      );
                    })}

                  {!craftsLoading && hiddenCraftCount > 0 && (
                    <p className="empty practiceCraftMore">
                      +{hiddenCraftCount} More — Refine Your Search.
                    </p>
                  )}
                </div>

                {practiceTarget && (
                  <div className="targetCallout">
                    <span>Practice Target</span>
                    <strong>
                      {practiceTarget.emoji} {practiceTarget.name}
                    </strong>
                  </div>
                )}

                {error && mode === "practice" && (
                  <div className="error">{error}</div>
                )}

                <button
                  className="primaryButton"
                  type="submit"
                  disabled={loading || craftsLoading || !practiceTarget}
                >
                  {loading
                    ? "Starting…"
                    : practiceActive
                      ? "Restart Practice"
                      : "Start Practice"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function ResetPage({ onReset, busy, error, success }) {
  return (
    <div className="resetPage">
      <h2 className="resetTitle">Reset Progress</h2>
      <p className="resetHint">Clears Crafts And Elements On This Device.</p>

      {error && <div className="resetMessage resetMessageError">{error}</div>}
      {success && (
        <div className="resetMessage resetMessageSuccess">{success}</div>
      )}

      <button
        className="ghostButton resetButton"
        type="button"
        onClick={onReset}
        disabled={busy}
      >
        {busy ? "Resetting…" : "Reset"}
      </button>
    </div>
  );
}

function getPageMeta(page, challenge, practiceSession, practiceComplete) {
  if (page === "race") {
    return {
      eyebrow: "Choose Your Mode",
      title: "NYCrafts Race",
    };
  }

  if (page === "sandbox") {
    if (challenge && !challenge.completed) {
      return {
        eyebrow: "Daily Challenge",
        title: "Find The Word",
        subtitle:
          "Combine Elements Until You Craft The Target. Pause The Timer Anytime From The Game Bar.",
      };
    }

    if (
      (practiceSession && !practiceSession.completed) ||
      (practiceComplete && practiceSession)
    ) {
      return {
        eyebrow: "Practice Mode",
        title: "Crafting Sandbox",
      };
    }

    return {
      eyebrow: "Single Player Mode",
      title: "Crafting Sandbox",
    };
  }

  if (page === "map") {
    return {
      eyebrow: "Craft Explorer",
      title: "NYCrafts Graph",
    };
  }

  return {};
}

function App() {
  const [elements, setElements] = useState(STARTERS);
  const [selected, setSelected] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState("race");
  const [resetSuccess, setResetSuccess] = useState("");
  const [graphVersion, setGraphVersion] = useState(0);
  const [playerName, setPlayerName] = useState(
    localStorage.getItem("player_name") || "",
  );
  const [raceMode, setRaceMode] = useState("daily");
  const [dailyTarget, setDailyTarget] = useState(null);
  const [target, setTarget] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [practiceSession, setPracticeSession] = useState(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [allCrafts, setAllCrafts] = useState([]);
  const [craftsLoading, setCraftsLoading] = useState(false);
  const [practiceQuery, setPracticeQuery] = useState("");
  const [practiceTarget, setPracticeTarget] = useState(null);
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
        if (data.target) setDailyTarget(data.target);
        if (Array.isArray(data.leaderboard)) setLeaderboard(data.leaderboard);
      })
      .catch(() => {
        setError("Could Not Load The Daily Challenge.");
      });
  }, []);

  useEffect(() => {
    if (raceMode !== "practice" || allCrafts.length > 0) return undefined;

    let cancelled = false;

    async function loadCrafts() {
      try {
        setCraftsLoading(true);

        const response = await fetch(`${API_BASE}/api/elements/global`);

        if (!response.ok) {
          throw new Error("Could not load crafts.");
        }

        const data = await response.json();

        if (cancelled) return;

        setAllCrafts(
          Array.isArray(data.elements)
            ? [...data.elements].sort((a, b) =>
                String(a.name).localeCompare(String(b.name)),
              )
            : [],
        );
      } catch {
        if (!cancelled) {
          setError("Could Not Load Crafts For Practice.");
        }
      } finally {
        if (!cancelled) {
          setCraftsLoading(false);
        }
      }
    }

    loadCrafts();

    return () => {
      cancelled = true;
    };
  }, [raceMode, allCrafts.length]);

  useEffect(() => {
    if (!challenge || challenge.completed) return undefined;

    const tick = () => setElapsedMs(getChallengeElapsedMs(challenge));

    if (isChallengePaused(challenge)) {
      tick();
      return undefined;
    }

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

  function clearPracticeState() {
    setPracticeSession(null);
    setPracticeComplete(false);
    setTarget(null);
  }

  function leavePracticeToRace() {
    clearPracticeState();
    navigate("race");
  }

  async function cancelActiveChallenge({
    confirm = true,
    navigateAfter = false,
  } = {}) {
    if (!challenge || challenge.completed) {
      return true;
    }

    if (confirm) {
      const confirmed = window.confirm(
        "End this race? Your run will not be saved to the leaderboard.",
      );

      if (!confirmed) {
        return false;
      }
    }

    const response = await fetch(`${API_BASE}/api/challenge/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": DEVICE_ID,
      },
      body: JSON.stringify({
        sessionId: challenge.sessionId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not cancel race.");
    }

    setChallenge(null);
    setWinner(null);
    setElapsedMs(0);
    setSelected([]);

    if (navigateAfter) {
      navigate("race");
    }

    return true;
  }

  async function startChallenge(event) {
    event.preventDefault();

    const trimmedName = playerName.trim();

    if (!trimmedName) {
      setError("Enter A Player Name Before Starting.");
      return;
    }

    if (!dailyTarget) {
      setError("The Daily Challenge Is Not Ready Yet.");
      return;
    }

    if (practiceSession && !practiceSession.completed) {
      const confirmed = window.confirm(
        "Starting a daily challenge will end your current practice session and reset progress. Continue?",
      );

      if (!confirmed) {
        return;
      }
    } else if (practiceSession || practiceComplete) {
      clearPracticeState();
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
      setPracticeSession(null);
      setPracticeComplete(false);
      setElements(data.elements || STARTERS);
      setHistory([]);
      setSelected([]);
      setQuery("");
      setWinner(null);
      setElapsedMs(0);
      setChallenge({
        sessionId: data.sessionId,
        startedAtMs: data.startedAtMs,
        pausedMs: 0,
        pausedAtMs: null,
        completed: false,
      });
      setPage("sandbox");
      setGraphVersion((current) => current + 1);
    } catch (err) {
      setError(err.message || "Could not start challenge.");
    } finally {
      setBusy(false);
    }
  }

  async function startPractice(event) {
    event.preventDefault();

    const chosenTarget = practiceTarget || practiceSession?.target;

    if (!chosenTarget) {
      setError("Choose A Target Craft Before Starting.");
      return;
    }

    if (isStarterCraft(chosenTarget.name)) {
      setError(
        "Starter Elements Are Already Available. Pick A Craft To Combine Toward.",
      );
      return;
    }

    if (challenge && !challenge.completed) {
      const confirmed = window.confirm(
        "Starting practice will end your current daily challenge without saving a time. Continue?",
      );

      if (!confirmed) {
        return;
      }
    }

    setBusy(true);
    setError("");

    try {
      if (challenge && !challenge.completed) {
        await cancelActiveChallenge({ confirm: false });
      }

      const response = await fetch(`${API_BASE}/api/practice/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": DEVICE_ID,
        },
        body: JSON.stringify({
          targetName: chosenTarget.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start practice.");
      }

      setChallenge(null);
      setWinner(null);
      setElapsedMs(0);
      setTarget(data.target);
      setPracticeTarget(data.target);
      setPracticeComplete(false);
      setPracticeSession({
        target: data.target,
        completed: false,
      });
      setElements(data.elements || STARTERS);
      setHistory([]);
      setSelected([]);
      setQuery("");
      setPage("sandbox");
      setGraphVersion((current) => current + 1);
    } catch (err) {
      setError(err.message || "Could not start practice.");
    } finally {
      setBusy(false);
    }
  }

  function endPractice() {
    if (!practiceSession || practiceSession.completed) return;

    const confirmed = window.confirm(
      "End this practice session? Your current progress will stay on this device.",
    );

    if (!confirmed) return;

    clearPracticeState();
    setSelected([]);
    navigate("race");
  }

  async function cancelChallenge() {
    if (!challenge || challenge.completed || busy) return;

    setBusy(true);
    setError("");

    try {
      const cancelled = await cancelActiveChallenge({
        confirm: true,
        navigateAfter: true,
      });

      if (cancelled) {
        setPracticeSession(null);
        setPracticeComplete(false);
      }
    } catch (err) {
      setError(err.message || "Could not cancel race.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleChallengePause() {
    if (!challenge || challenge.completed || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/challenge/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": DEVICE_ID,
        },
        body: JSON.stringify({
          sessionId: challenge.sessionId,
          paused: !isChallengePaused(challenge),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update timer.");
      }

      const session = data.session;

      setChallenge((current) =>
        current
          ? {
              ...current,
              pausedMs: session.pausedMs || 0,
              pausedAtMs: session.pausedAtMs ?? null,
            }
          : current,
      );
      setElapsedMs(data.elapsedMs ?? getChallengeElapsedMs(session));
    } catch (err) {
      setError(err.message || "Could not update timer.");
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
    if (challenge && !challenge.completed && isChallengePaused(challenge)) {
      return;
    }

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

      if (
        practiceSession &&
        !practiceSession.completed &&
        target &&
        result.name.toLowerCase() === target.name.toLowerCase()
      ) {
        setPracticeSession((current) =>
          current ? { ...current, completed: true } : current,
        );
        setPracticeComplete(true);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function navigate(nextPage) {
    setError("");
    setResetSuccess("");
    setPage(nextPage);

    if (nextPage === "race") {
      setRaceMode(
        challenge ? "daily" : practiceSession ? "practice" : raceMode,
      );
    }
  }

  async function resetLocal() {
    const confirmed = window.confirm(
      "Are you sure? This will erase this device's progress and recent crafts.",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setResetSuccess("");

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
      setPracticeSession(null);
      setPracticeComplete(false);
      setWinner(null);
      setElapsedMs(0);
      setGraphVersion((current) => current + 1);
      setResetSuccess("Reset Complete.");
    } catch (err) {
      setError("Could not reset progress.");
    } finally {
      setBusy(false);
    }
  }

  const pageMeta = getPageMeta(page, challenge, practiceSession, practiceComplete);

  let pageBody;

  if (page === "race") {
    pageBody = (
      <RacePage
        mode={raceMode}
        onModeChange={(nextMode) => {
          setError("");
          setRaceMode(nextMode);
        }}
        dailyTarget={dailyTarget}
        leaderboard={leaderboard}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        onStartDaily={startChallenge}
        onContinueDaily={() => navigate("sandbox")}
        onContinuePractice={() => navigate("sandbox")}
        challenge={challenge}
        practiceSession={practiceSession}
        allCrafts={allCrafts}
        craftsLoading={craftsLoading}
        practiceQuery={practiceQuery}
        onPracticeQueryChange={setPracticeQuery}
        practiceTarget={practiceTarget}
        onPracticeTargetChange={setPracticeTarget}
        onStartPractice={startPractice}
        loading={busy}
        error={error}
      />
    );
  } else if (page === "map") {
    pageBody = <MapPage apiBase={API_BASE} graphVersion={graphVersion} />;
  } else if (page === "reset") {
    pageBody = (
      <ResetPage
        onReset={resetLocal}
        busy={busy}
        error={error}
        success={resetSuccess}
      />
    );
  } else {
    pageBody = (
      <>
      {(challenge || winner || (practiceSession && !practiceComplete)) && (
      <section
        className={
          practiceSession && !challenge
            ? "gameBar gameBarPractice"
            : "gameBar"
        }
      >
        <div>
          <span className="muted">Target</span>
          <strong>{target ? `${target.emoji} ${target.name}` : "Free Craft"}</strong>
        </div>
        {challenge && (
          <>
            <div>
              <span className="muted">Time</span>
              <div className="timerRow">
                <strong>{formatDuration(elapsedMs)}</strong>
                {!challenge.completed && (
                  <>
                    <button
                      className="ghostButton timerButton"
                      type="button"
                      onClick={toggleChallengePause}
                      disabled={busy}
                    >
                      {isChallengePaused(challenge) ? "Resume" : "Pause"}
                    </button>
                    <button
                      className="ghostButton timerButton cancelButton"
                      type="button"
                      onClick={cancelChallenge}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <div>
              <span className="muted">Player</span>
              <strong>{playerName || "Guest"}</strong>
            </div>
          </>
        )}
        {practiceSession && !challenge && (
          <>
            <div>
              <span className="muted">Mode</span>
              <strong>Practice</strong>
            </div>
            <div className="practiceBarActions">
              <button
                className="ghostButton timerButton cancelButton"
                type="button"
                onClick={endPractice}
                disabled={busy}
              >
                End Practice
              </button>
            </div>
          </>
        )}
      </section>
      )}

      {winner && (
        <section className="winBanner">
          <div>
            <span className="muted">Finished</span>
            <strong>{formatDuration(winner.durationMs)}</strong>
          </div>
          <button className="primaryButton" onClick={() => navigate("race")}>
            View Standings
          </button>
        </section>
      )}

      {practiceComplete && target && (
        <section className="winBanner">
          <div>
            <span className="muted">Crafted</span>
            <strong>
              {target.emoji} {target.name}
            </strong>
          </div>
          <button
            className="primaryButton"
            type="button"
            onClick={leavePracticeToRace}
          >
            Back To Race
          </button>
          <button
            className="ghostButton"
            type="button"
            disabled={busy}
            onClick={() => startPractice({ preventDefault() {} })}
          >
            Try Again
          </button>
        </section>
      )}

      <section className="selectedPanel">
        <div>
          <span className="muted">Selected</span>

          <div className="selectedItems">
            {selected.length === 0 && (
              <strong>
                Pick Two Items
                {history.length > 0 && (
                  <>
                    {" "}
                    | Last Item: {history[0].result.emoji}{" "}
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
            placeholder="Search Elements…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="elementList">
            {filteredElements.map((element) => (
              <button
                key={element.name}
                className="elementButton"
                onClick={() => choose(element)}
                disabled={
                  busy ||
                  (challenge &&
                    !challenge.completed &&
                    isChallengePaused(challenge))
                }
              >
                <span>{element.emoji}</span>
                {element.name}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="panelHeader">
            <h2>Recent Crafts</h2>
            <span>{history.length}</span>
          </div>

          <div className="history">
            {history.length === 0 && (
              <p className="empty">Your Discoveries Will Appear Here.</p>
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
                  {entry.source === "generated" ? "Generated" : "From Cache"}
                </small>
              </article>
            ))}
          </div>
        </section>
      </section>
      </>
    );
  }

  return (
    <AppShell
      currentPage={page}
      onNavigate={navigate}
      eyebrow={pageMeta.eyebrow}
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      hideHero={page === "reset"}
    >
      {pageBody}
    </AppShell>
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
