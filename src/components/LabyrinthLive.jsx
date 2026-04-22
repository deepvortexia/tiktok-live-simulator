import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const COLS = 31;
const ROWS = 51;
const CELL = 12;
const MAX_CREATURES = 120;

// Cell types
const WALL = 0;
const PATH = 1;
const DIRT = 2; // being dug

// Species definitions — each gift unlocks a different one
const SPECIES = {
  rose:    { emoji: "🌸", color: "#ff6eb4", name: "Rosier",   speed: 2, digs: true,  builds: false, size: 10 },
  lion:    { emoji: "🦁", color: "#f59e0b", name: "Léon",     speed: 4, digs: true,  builds: true,  size: 13 },
  rocket:  { emoji: "🚀", color: "#38bdf8", name: "Fusio",    speed: 7, digs: true,  builds: false, size: 11 },
  uni:     { emoji: "🌌", color: "#a78bfa", name: "Cosmik",   speed: 3, digs: false, builds: true,  size: 14 },
  default: { emoji: "👾", color: "#4ade80", name: "Glitch",   speed: 3, digs: true,  builds: true,  size: 10 },
};

// ─── MAZE GENERATION (Recursive Backtracker) ─────────────────────────────────
function generateMaze(cols, rows) {
  // Work in odd grid so walls/paths alternate cleanly
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols).fill(WALL));

  function carve(cx, cy) {
    const dirs = [[0,-2],[0,2],[-2,0],[2,0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === WALL) {
        grid[cy + dy / 2][cx + dx / 2] = PATH;
        grid[ny][nx] = PATH;
        carve(nx, ny);
      }
    }
  }
  grid[1][1] = PATH;
  carve(1, 1);

  // Open a few extra passages for loops (make it less perfect, more chaotic)
  for (let i = 0; i < 40; i++) {
    const x = 1 + Math.floor(Math.random() * ((cols - 2) / 2)) * 2;
    const y = 1 + Math.floor(Math.random() * ((rows - 2) / 2)) * 2;
    const dx = Math.random() < 0.5 ? 1 : 0;
    const dy = 1 - dx;
    if (x + dx < cols - 1 && y + dy < rows - 1) grid[y + dy][x + dx] = PATH;
  }

  return grid;
}

// ─── CREATURE FACTORY ────────────────────────────────────────────────────────
let creatureId = 0;
function spawnCreature(grid, speciesKey = "default", gifterName = "") {
  const spec = SPECIES[speciesKey] || SPECIES.default;
  // Find random path cell
  let x, y;
  do {
    x = 1 + Math.floor(Math.random() * (COLS - 2));
    y = 1 + Math.floor(Math.random() * (ROWS - 2));
  } while (grid[y]?.[x] !== PATH);

  return {
    id: creatureId++,
    x, y,
    speciesKey,
    spec,
    gifter: gifterName,
    dir: [1, 0],
    stepTimer: 0,
    stepInterval: Math.max(1, 8 - spec.speed),
    digging: false,
    building: false,
    buildCooldown: 0,
    trail: [],
    hue: Math.floor(Math.random() * 360),
  };
}

// ─── FAKE DATA ───────────────────────────────────────────────────────────────
const FAKE_NAMES = ["xoxo_lena","toxic_vibes99","cloudboy","kittywave","drip_raf","lunatica77","yassvibe","lil_trap","noura_vibe","reivax_tt"];
const FAKE_COMMENTS = [
  "omg les bestioles 😂", "go go creuse !!", "le labyrinthe change ??", "c'est hypnotique fr 👀",
  "j'envoie une fusée 🚀", "les fourmis sont folles", "combo x10 🔥", "rep svp !!",
  "trop cool ce live", "le lion construit quoi là 🦁", "j'arrive pas à décrocher lol",
];
const GIFT_TYPES = [
  { key: "rose",   emoji: "🌹", label: "Rose",    coins: 1    },
  { key: "lion",   emoji: "🦁", label: "Lion",    coins: 100  },
  { key: "rocket", emoji: "🚀", label: "Fusée",   coins: 500  },
  { key: "uni",    emoji: "🌌", label: "Univers", coins: 2000 },
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── DRAW CREATURE (canvas) ──────────────────────────────────────────────────
function drawCreature(ctx, c, offsetX, offsetY) {
  const px = c.x * CELL + offsetX + CELL / 2;
  const py = c.y * CELL + offsetY + CELL / 2;
  const r = c.spec.size / 2;

  // Glow
  ctx.shadowBlur = 8;
  ctx.shadowColor = c.spec.color;

  // Body
  ctx.fillStyle = c.spec.color;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000";
  const eyeOff = r * 0.3;
  ctx.beginPath(); ctx.arc(px - eyeOff, py - eyeOff * 0.5, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + eyeOff, py - eyeOff * 0.5, r * 0.22, 0, Math.PI * 2); ctx.fill();

  // Smile
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(px, py + r * 0.1, r * 0.4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Draw trail
  ctx.shadowBlur = 0;
  for (let i = 0; i < c.trail.length; i++) {
    const t = c.trail[i];
    const alpha = (i / c.trail.length) * 0.3;
    ctx.fillStyle = c.spec.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
    ctx.fillRect(t.x * CELL + offsetX + 1, t.y * CELL + offsetY + 1, CELL - 2, CELL - 2);
  }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function LabyrinthLive() {
  const canvasRef = useRef(null);
  const gridRef = useRef(generateMaze(COLS, ROWS));
  const creaturesRef = useRef([]);
  const animRef = useRef(null);
  const tickRef = useRef(0);

  const [isLive, setIsLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [coins, setCoins] = useState(0);
  const [comments, setComments] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [speciesCount, setSpeciesCount] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [notification, setNotification] = useState(null);
  const [inputText, setInputText] = useState("");

  const intervalsRef = useRef([]);
  const commentsEndRef = useRef(null);

  // ── Canvas size
  const canvasW = COLS * CELL;
  const canvasH = ROWS * CELL;

  // ── Add comment helper
  const addComment = useCallback((name, text, color = null) => {
    setComments(prev => [...prev.slice(-50), { id: Date.now() + Math.random(), name, text, color }]);
  }, []);

  // ── Spawn gift creature
  const spawnGiftCreature = useCallback((giftKey, gifterName) => {
    const grid = gridRef.current;
    if (creaturesRef.current.length >= MAX_CREATURES) {
      creaturesRef.current.shift(); // remove oldest
    }
    const c = spawnCreature(grid, giftKey, gifterName);
    creaturesRef.current.push(c);
    setSpeciesCount(prev => ({ ...prev, [giftKey]: (prev[giftKey] || 0) + 1 }));

    const spec = SPECIES[giftKey] || SPECIES.default;
    const gift = GIFT_TYPES.find(g => g.key === giftKey);
    setCoins(prev => prev + (gift?.coins || 1));
    addComment(gifterName, `${gift?.emoji} a spawné un ${spec.name} !`, spec.color);

    setNotification({ emoji: spec.emoji, name: spec.name, gifter: gifterName, color: spec.color });
    setTimeout(() => setNotification(null), 2500);
  }, [addComment]);

  // ── Creature AI tick
  const tickCreatures = useCallback(() => {
    const grid = gridRef.current;
    const creatures = creaturesRef.current;

    for (const c of creatures) {
      c.stepTimer++;
      if (c.stepTimer < c.stepInterval) continue;
      c.stepTimer = 0;

      const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
      // Shuffle dirs, prefer current direction
      const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
      // Boost current dir
      const cur = c.dir;
      shuffled.sort((a) => (a[0] === cur[0] && a[1] === cur[1] ? -1 : 1));

      let moved = false;
      for (const [dx, dy] of shuffled) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;

        const cell = grid[ny]?.[nx];
        if (cell === PATH) {
          // Add trail
          c.trail.push({ x: c.x, y: c.y });
          if (c.trail.length > 5) c.trail.shift();
          c.x = nx; c.y = ny; c.dir = [dx, dy];
          moved = true;
          break;
        } else if (cell === WALL && c.spec.digs) {
          // Dig!
          grid[ny][nx] = PATH;
          c.trail.push({ x: c.x, y: c.y });
          if (c.trail.length > 5) c.trail.shift();
          c.x = nx; c.y = ny; c.dir = [dx, dy];
          moved = true;
          break;
        }
      }

      // Build — randomly wall off a PATH cell behind
      if (!moved) {
        // Flip direction
        c.dir = [-c.dir[0], -c.dir[1]];
      }

      if (c.spec.builds && Math.random() < 0.015 && c.buildCooldown <= 0) {
        // Build a wall somewhere near (not current cell)
        const bx = c.x + randInt(-3, 3);
        const by = c.y + randInt(-3, 3);
        if (bx > 0 && bx < COLS - 1 && by > 0 && by < ROWS - 1 && grid[by]?.[bx] === PATH) {
          // Don't trap creatures — only build if not occupied
          const occupied = creatures.some(cr => cr.x === bx && cr.y === by);
          if (!occupied) {
            grid[by][bx] = WALL;
            c.buildCooldown = 60;
          }
        }
      }
      if (c.buildCooldown > 0) c.buildCooldown--;
    }
  }, []);

  // ── Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const grid = gridRef.current;

    // Compute offset to center maze
    const offX = Math.floor((canvas.width - canvasW) / 2);
    const offY = Math.floor((canvas.height - canvasH) / 2);

    // Background
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        const px = c * CELL + offX;
        const py = r * CELL + offY;
        if (cell === WALL) {
          // Neon wall
          ctx.fillStyle = "#1a1a3a";
          ctx.fillRect(px, py, CELL, CELL);
          ctx.strokeStyle = "#2d2d6e";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        } else {
          // Path
          ctx.fillStyle = "#0a0a14";
          ctx.fillRect(px, py, CELL, CELL);
        }
      }
    }

    // Tick creatures
    tickRef.current++;
    if (isLive) tickCreatures();

    // Draw creatures
    for (const c of creaturesRef.current) {
      drawCreature(ctx, c, offX, offY);
    }

    animRef.current = requestAnimationFrame(render);
  }, [isLive, tickCreatures, canvasW, canvasH]);

  // ── Start/stop render loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  // ── Live simulation intervals
  useEffect(() => {
    if (!isLive) return;

    // Spawn initial default creatures
    const grid = gridRef.current;
    for (let i = 0; i < 8; i++) {
      creaturesRef.current.push(spawnCreature(grid, "default", ""));
    }
    setSpeciesCount({ default: 8 });

    const v = setInterval(() => setViewers(p => Math.max(1, p + randInt(-20, 35))), 3000);
    const c = setInterval(() => {
      if (Math.random() < 0.8) addComment(rand(FAKE_NAMES), rand(FAKE_COMMENTS));
    }, randInt(900, 2000));
    const g = setInterval(() => {
      if (Math.random() < 0.35) {
        const gift = rand(GIFT_TYPES);
        const user = rand(FAKE_NAMES);
        spawnGiftCreature(gift.key, user);
        setGifts(prev => [...prev.slice(-5), { id: Date.now(), gift, user }]);
      }
    }, 4000);
    const t = setInterval(() => setElapsed(p => p + 1), 1000);

    setViewers(randInt(80, 400));
    addComment("Système", "🌀 Le labyrinthe est vivant !", "#a78bfa");

    intervalsRef.current = [v, c, g, t];
    return () => {
      intervalsRef.current.forEach(clearInterval);
      creaturesRef.current = [];
      setSpeciesCount({});
    };
  }, [isLive, addComment, spawnGiftCreature]);

  // ── Auto scroll comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const formatTime = s => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

  const handleSend = () => {
    if (!inputText.trim()) return;
    addComment("moi", inputText.trim(), "#ff2d55");
    setInputText("");
  };

  const totalCreatures = creaturesRef.current.length;

  return (
    <div style={{
      width: "100vw", height: "100dvh",
      background: "#0d0d1a",
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ── CANVAS ── */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* ── TOP HUD ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "48px 12px 8px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isLive && (
            <span style={{
              background: "#ff2d55", color: "#fff", fontSize: 11, fontWeight: 700,
              padding: "3px 8px", borderRadius: 4, letterSpacing: 1,
              animation: "badgePulse 2s ease-in-out infinite",
            }}>LIVE</span>
          )}
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>@labyrinthe_vivant</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 12,
            padding: "4px 10px", borderRadius: 20, backdropFilter: "blur(8px)",
          }}>👁 {viewers.toLocaleString()}</span>
          {isLive && (
            <button onClick={() => setIsLive(false)} style={{
              background: "rgba(255,45,85,0.3)", border: "1px solid #ff2d55",
              color: "#ff2d55", borderRadius: 20, padding: "4px 12px",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}>✕ Stop</button>
          )}
        </div>
      </div>

      {/* ── STATS BAR ── */}
      {isLive && (
        <div style={{
          position: "absolute", top: 88, left: 12,
          display: "flex", gap: 8, zIndex: 10, flexWrap: "wrap",
        }}>
          {[
            { icon: "🪙", val: coins.toLocaleString() },
            { icon: "👾", val: `${totalCreatures} créatures` },
            { icon: "⏱", val: formatTime(elapsed) },
          ].map(({ icon, val }) => (
            <span key={val} style={{
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
              color: "#e2e8f0", fontSize: 11, fontWeight: 700,
              padding: "3px 10px", borderRadius: 20,
            }}>{icon} {val}</span>
          ))}
        </div>
      )}

      {/* ── SPECIES LEGEND ── */}
      {isLive && Object.keys(speciesCount).length > 0 && (
        <div style={{
          position: "absolute", top: 120, right: 12,
          display: "flex", flexDirection: "column", gap: 4, zIndex: 10,
        }}>
          {Object.entries(speciesCount).map(([key, count]) => {
            const spec = SPECIES[key];
            return (
              <span key={key} style={{
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                color: spec?.color || "#fff", fontSize: 11, fontWeight: 700,
                padding: "2px 8px", borderRadius: 12,
                border: `1px solid ${spec?.color}44`,
              }}>
                {spec?.emoji} {spec?.name} ×{count}
              </span>
            );
          })}
        </div>
      )}

      {/* ── GIFT NOTIFICATION ── */}
      {notification && (
        <div style={{
          position: "absolute", top: "35%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)",
          border: `2px solid ${notification.color}`,
          borderRadius: 20, padding: "16px 24px",
          textAlign: "center", zIndex: 30,
          animation: "popIn 0.3s ease",
          boxShadow: `0 0 40px ${notification.color}66`,
        }}>
          <div style={{ fontSize: 40 }}>{notification.emoji}</div>
          <div style={{ color: notification.color, fontWeight: 700, fontSize: 16 }}>{notification.name}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            spawné par <strong style={{ color: "#fff" }}>{notification.gifter}</strong>
          </div>
        </div>
      )}

      {/* ── COMMENTS ── */}
      <div style={{
        position: "absolute", bottom: 68, left: 0, right: 0,
        maxHeight: 220, overflowY: "auto",
        padding: "8px 12px",
        zIndex: 10,
        maskImage: "linear-gradient(to bottom, transparent 0%, black 25%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 25%)",
      }}>
        {comments.map(c => (
          <div key={c.id} style={{
            display: "flex", gap: 6, marginBottom: 4,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            padding: "4px 8px", borderRadius: 8,
            animation: "slideUp 0.2s ease",
          }}>
            <span style={{ color: c.color || "#ff2d55", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
              {c.name}
            </span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{c.text}</span>
          </div>
        ))}
        <div ref={commentsEndRef} />
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "10px 12px 28px",
        display: "flex", gap: 8, alignItems: "center",
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
        zIndex: 10,
      }}>
        {isLive ? (
          <>
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Commenter..."
              style={{
                flex: 1, background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: 22,
                color: "#fff", fontSize: 13, padding: "9px 14px", outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button onClick={handleSend} style={{
              background: "rgba(255,255,255,0.15)", border: "none",
              width: 38, height: 38, borderRadius: "50%", cursor: "pointer",
              fontSize: 16, color: "#fff",
            }}>➤</button>
            {/* Manual gift buttons */}
            {GIFT_TYPES.map(g => (
              <button key={g.key}
                onClick={() => spawnGiftCreature(g.key, "toi")}
                style={{
                  background: "rgba(255,255,255,0.1)", border: "none",
                  width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 18,
                }}
                title={g.label}
              >{g.emoji}</button>
            ))}
          </>
        ) : (
          <button onClick={() => {
            gridRef.current = generateMaze(COLS, ROWS);
            setElapsed(0); setCoins(0); setComments([]); setGifts([]);
            setIsLive(true);
          }} style={{
            width: "100%", background: "linear-gradient(135deg, #7c3aed, #2563eb)",
            border: "none", borderRadius: 28, color: "#fff",
            fontSize: 17, fontWeight: 700, fontFamily: "inherit",
            padding: 15, cursor: "pointer",
            boxShadow: "0 4px 24px rgba(124,58,237,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%", background: "#fff",
              animation: "blink 1s ease-in-out infinite",
            }} />
            Lancer le Labyrinthe LIVE
          </button>
        )}
      </div>

      <style>{`
        @keyframes badgePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,45,85,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(255,45,85,0); }
        }
        @keyframes blink {
          0%,100% { opacity:1; } 50% { opacity:0.2; }
        }
        @keyframes popIn {
          from { transform: translate(-50%,-50%) scale(0.7); opacity:0; }
          to   { transform: translate(-50%,-50%) scale(1);   opacity:1; }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        * { box-sizing: border-box; }
        body { margin:0; overflow:hidden; }
        ::-webkit-scrollbar { display:none; }
      `}</style>
    </div>
  );
}
