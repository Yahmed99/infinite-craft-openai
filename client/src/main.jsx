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

function MapPage({ apiBase, graphVersion }) {
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
          setError("Could Not Load Global Recipe Map.");
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
    <>
      {error && <div className="error">{error}</div>}

      <section className="panel mapPanel">

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
  target,
  leaderboard,
  playerName,
  onPlayerNameChange,
  onStart,
  onContinueRace,
  challenge,
  loading,
  error,
}) {
  const raceActive = challenge && !challenge.completed;

  return (
    <>
      {raceActive && (
        <section className="statusBanner">
          <p>
            Race In Progress For <strong>{playerName || "Guest"}</strong>.
          </p>
          <button
            className="primaryButton"
            type="button"
            onClick={onContinueRace}
          >
            Continue Race
          </button>
        </section>
      )}

      <div className="raceLayout">
        <section className="panel racePanel">
          <form className="startForm" onSubmit={onStart}>
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
              <span>Target Word</span>
              <strong>
                {target?.emoji} {target?.name || "Loading..."}
              </strong>
            </div>

            {error && <div className="error">{error}</div>}

            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Starting…" : raceActive ? "Restart Race" : "Start Race"}
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

function getPageMeta(page, challenge) {
  if (page === "race") {
    return {
      eyebrow: "Multiplayer Mode",
      title: "NYCrafts Race",
    };
  }

  if (page === "sandbox") {
    if (challenge && !challenge.completed) {
      return {
        eyebrow: "Race In Progress",
        title: "Find The Word",
        subtitle:
          "Combine Elements Until You Craft The Target. Pause The Timer Anytime From The Game Bar.",
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
        setError("Could Not Load The Race Target.");
      });
  }, []);

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

  async function startChallenge(event) {
    event.preventDefault();

    const trimmedName = playerName.trim();

    if (!trimmedName) {
      setError("Enter A Player Name Before Starting.");
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

  async function cancelChallenge() {
    if (!challenge || challenge.completed || busy) return;

    const confirmed = window.confirm(
      "End this race? Your run will not be saved to the leaderboard.",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
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
      navigate("race");
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

  const pageMeta = getPageMeta(page, challenge);

  let pageBody;

  if (page === "race") {
    pageBody = (
      <RacePage
        target={target}
        leaderboard={leaderboard}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        onStart={startChallenge}
        onContinueRace={() => navigate("sandbox")}
        challenge={challenge}
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
      {(challenge || winner) && (
      <section className="gameBar">
        <div>
          <span className="muted">Target</span>
          <strong>{target ? `${target.emoji} ${target.name}` : "Free Craft"}</strong>
        </div>
        <div>
          <span className="muted">Time</span>
          <div className="timerRow">
            <strong>{formatDuration(elapsedMs)}</strong>
            {challenge && !challenge.completed && (
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
