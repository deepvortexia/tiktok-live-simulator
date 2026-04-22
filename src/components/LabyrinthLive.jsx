import { useEffect, useRef, useState } from "react";

const CELL             = 4;
const PIXELS_TOTAL     = 30;
const CRYSTAL_MAX      = 30;
const BASE_FRAC        = 0.15;   // left/right 15% of cols = base zone
const CREATURE_INTERVAL = 6;
const BLOCK_W          = 16;     // crystal block width in px
const BLOCK_H          = 8;      // crystal block height in px
const WALL = 0;
const PATH = 1;
const MOVE_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const RED  = { hot: "#ff2d55", mid: "#ff6b9d", deep: "#c21858", glow: "rgba(255,45,85,0.4)" };
const BLUE = { hot: "#38bdf8", mid: "#6bc6ff", deep: "#1e3a8a", glow: "rgba(56,189,248,0.4)" };

const CREATURE_COLOR = { red: "#ff0044", blue: "#00ccff" };

const oddify = n => (n % 2 === 0 ? n - 1 : n);

// ── TikTok comment feed ────────────────────────────────────────────────────
const VIEWER_NAMES = [
  "deepvortexia", "tiktok_fan99", "gamer_x42", "liveviewer_", "coolguy88",
  "pixel_queen", "maze_hunter", "user_3847", "nightowl22", "streamer_pro",
  "viewerXL", "luckystar_", "techguru01", "vibecheck99", "shadow_wolf",
  "neon_rider", "cosmic_dust", "fire_storm7", "ice_queen_", "blaze_runner",
];
const COMMENT_TEMPLATES = [
  n => `${n} joined`,
  n => `${n} followed`,
  n => `${n} gifted 🌹`,
  n => `${n} gifted 🦁`,
  n => `${n} sent 🚀`,
  n => `${n} gifted 🌌`,
  n => `${n} ❤️ liked`,
  n => `${n} shared the stream`,
  n => `${n} gifted 🌹🌹🌹`,
  n => `${n} is now a top fan!`,
];
let _commentId = 0;
function randomComment() {
  const name = VIEWER_NAMES[Math.floor(Math.random() * VIEWER_NAMES.length)];
  const tmpl = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
  return { id: ++_commentId, text: tmpl(name) };
}
// ──────────────────────────────────────────────────────────────────────────

function generateMaze(cols, rows) {
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols).fill(WALL));
  grid[1][1] = PATH;
  const stack = [[1, 1]];
  const DIRS = [[0, -2], [0, 2], [-2, 0], [2, 0]];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const shuffled = DIRS.slice().sort(() => Math.random() - 0.5);
    let carved = false;
    for (const [dx, dy] of shuffled) {
      const nx = cx + dx, ny = cy + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === WALL) {
        grid[cy + dy / 2][cx + dx / 2] = PATH;
        grid[ny][nx] = PATH;
        stack.push([nx, ny]);
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }
  return grid;
}

function placeOnPath(grid, rows, xMin, xMax, count) {
  const cands = [];
  for (let y = 1; y < rows - 1; y++)
    for (let x = xMin; x < xMax; x++)
      if (grid[y][x] === PATH) cands.push({ x, y });
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  return cands.slice(0, count);
}

function buildMazeCanvas(grid, cols, rows) {
  const off = document.createElement("canvas");
  off.width  = cols * CELL;
  off.height = rows * CELL;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, off.width, off.height);
  ctx.fillStyle = "#0e1030";
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === WALL) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = "rgba(110,150,255,0.22)";
  ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === WALL) ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
  return off;
}

// BFS from (sx, sy); returns array of {x,y} steps to nearest target, or null.
function bfsPath(grid, cols, rows, sx, sy, isTarget) {
  if (isTarget(sx, sy)) return [];
  const startKey = sy * cols + sx;
  const parent   = new Map([[startKey, -1]]);
  const queue    = [startKey];
  while (queue.length) {
    const curKey = queue.shift();
    const cx = curKey % cols;
    const cy = (curKey - cx) / cols;
    for (const [dx, dy] of MOVE_DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx <= 0 || nx >= cols - 1 || ny <= 0 || ny >= rows - 1) continue;
      if (grid[ny][nx] !== PATH) continue;
      const nKey = ny * cols + nx;
      if (parent.has(nKey)) continue;
      parent.set(nKey, curKey);
      if (isTarget(nx, ny)) {
        const path = [];
        let k = nKey;
        while (k !== startKey) {
          const x = k % cols, y = (k - x) / cols;
          path.unshift({ x, y });
          k = parent.get(k);
        }
        return path;
      }
      queue.push(nKey);
    }
  }
  return null;
}

function makeCreature(x, y, team) {
  return {
    x, y, team,
    state: "SEEKING",
    path: null,
    pixel: null,
    trail: [],
    moveTimer: Math.floor(Math.random() * CREATURE_INTERVAL),
  };
}

function stepCreature(c, grid, cols, rows, pixels, bases, scoreAcc, crystals) {
  c.moveTimer--;
  if (c.moveTimer > 0) return;
  c.moveTimer = CREATURE_INTERVAL;

  if (!c.path || c.path.length === 0) {
    if (c.state === "SEEKING") {
      const pixelKeys = new Set();
      for (const p of pixels)
        if (!p.carrier) pixelKeys.add(p.y * cols + p.x);
      if (pixelKeys.size === 0) return;
      c.path = bfsPath(grid, cols, rows, c.x, c.y, (x, y) => pixelKeys.has(y * cols + x));
    } else {
      const b = bases[c.team];
      c.path = bfsPath(grid, cols, rows, c.x, c.y,
        (x, y) => x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax);
    }
    if (!c.path || c.path.length === 0) return;
  }

  // Record trail before moving
  c.trail.push({ x: c.x, y: c.y });
  if (c.trail.length > 8) c.trail.shift();

  const { x, y } = c.path.shift();
  c.x = x;
  c.y = y;

  if (c.state === "SEEKING") {
    for (const p of pixels) {
      if (!p.carrier && p.x === x && p.y === y) {
        p.carrier = c;
        c.pixel   = p;
        c.state   = "CARRYING";
        c.path    = null;
        break;
      }
    }
  } else if (c.state === "CARRYING" && c.pixel) {
    const b = bases[c.team];
    if (x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax) {
      // Add block to crystal
      if (crystals[c.team].length < CRYSTAL_MAX)
        crystals[c.team].push(1);
      scoreAcc[c.team]++;

      // Respawn pixel at new center-third position so pool stays full
      const midXMin = Math.floor(cols / 3);
      const midXMax = Math.floor(cols * 2 / 3);
      const newSpot = placeOnPath(grid, rows, midXMin, midXMax, 1)[0];
      if (newSpot) {
        c.pixel.x       = newSpot.x;
        c.pixel.y       = newSpot.y;
        c.pixel.carrier = null;
      } else {
        c.pixel.carrier = null;
      }
      c.pixel = null;
      c.state = "SEEKING";
      c.path  = null;
    }
  }
}

function drawCrystal(ctx, blocks, centerX, canvasH, colors, time) {
  const bright = blocks.length >= CRYSTAL_MAX / 2;
  for (let i = 0; i < blocks.length; i++) {
    const bx = centerX - BLOCK_W / 2;
    const by = canvasH - (i + 1) * BLOCK_H;
    // Subtle brightness variation per block
    const shimmer = bright ? 0.85 + Math.sin(time * 0.006 + i * 0.4) * 0.15 : 0.7;
    ctx.shadowBlur  = bright ? 14 : 5;
    ctx.shadowColor = colors.hot;
    ctx.globalAlpha = shimmer;
    ctx.fillStyle   = bright ? colors.hot : colors.mid;
    ctx.fillRect(bx, by, BLOCK_W, BLOCK_H - 1);
    // Bright top edge highlight
    ctx.globalAlpha = shimmer * 0.6;
    ctx.fillStyle   = "#ffffff";
    ctx.fillRect(bx, by, BLOCK_W, 1);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

export default function LabyrinthLive() {
  const canvasRef       = useRef(null);
  const mazeLayerRef    = useRef(null);
  const gridRef         = useRef(null);
  const colsRef         = useRef(0);
  const rowsRef         = useRef(0);
  const creaturesRef    = useRef([]);
  const pixelsRef       = useRef([]);
  const basesRef        = useRef({ red: null, blue: null });
  const crystalRef      = useRef({ red: [], blue: [] });
  const rafRef          = useRef(null);
  const frameRef        = useRef(0);
  const scoreAccRef     = useRef({ red: 0, blue: 0 });
  const celebrationRef  = useRef({ active: false, winner: null, endFrame: 0, particles: [] });
  const pendingResetRef = useRef(false);

  const [redScore,       setRedScore]       = useState(0);
  const [blueScore,      setBlueScore]      = useState(0);
  const [resetCount,     setResetCount]     = useState(0);
  const [creatureCounts, setCreatureCounts] = useState({ red: 2, blue: 2 });
  const [comments,       setComments]       = useState(() => [randomComment(), randomComment(), randomComment()]);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setComments(prev => [...prev, randomComment()].slice(-5));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cols = oddify(Math.max(9, Math.floor(vp.w / CELL)));
    const rows = oddify(Math.max(9, Math.floor(vp.h / CELL)));
    const grid = generateMaze(cols, rows);

    gridRef.current      = grid;
    colsRef.current      = cols;
    rowsRef.current      = rows;
    mazeLayerRef.current = buildMazeCanvas(grid, cols, rows);

    // Base zones: left/right 15% of cols
    const baseCols = Math.max(3, Math.floor(cols * BASE_FRAC));
    const redBase  = { xMin: 1,                  xMax: baseCols,          yMin: 1, yMax: rows - 2 };
    const blueBase = { xMin: cols - baseCols - 1, xMax: cols - 2,          yMin: 1, yMax: rows - 2 };
    basesRef.current = { red: redBase, blue: blueBase };

    // 30 white pixels in center third of maze
    const midXMin = Math.floor(cols / 3);
    const midXMax = Math.floor(cols * 2 / 3);
    const midPixels = placeOnPath(grid, rows, midXMin, midXMax, PIXELS_TOTAL);
    pixelsRef.current = midPixels.map(({ x, y }) => ({ x, y, carrier: null }));

    // 2 creatures per team, spawned inside their base
    const redSpots  = placeOnPath(grid, rows, redBase.xMin,  redBase.xMax  + 1, 2);
    const blueSpots = placeOnPath(grid, rows, blueBase.xMin, blueBase.xMax + 1, 2);
    creaturesRef.current = [
      ...redSpots.map(({ x, y })  => makeCreature(x, y, "red")),
      ...blueSpots.map(({ x, y }) => makeCreature(x, y, "blue")),
    ];

    crystalRef.current   = { red: [], blue: [] };
    celebrationRef.current  = { active: false, winner: null, endFrame: 0, particles: [] };
    pendingResetRef.current = false;
    setRedScore(0);
    setBlueScore(0);
    scoreAccRef.current = { red: 0, blue: 0 };
    frameRef.current    = 0;
  }, [vp, resetCount]);

  useEffect(() => {
    const render = (time) => {
      const canvas = canvasRef.current;
      const maze   = mazeLayerRef.current;
      const grid   = gridRef.current;

      if (pendingResetRef.current) {
        pendingResetRef.current = false;
        setResetCount(n => n + 1);
      }

      if (canvas && maze && grid) {
        const cols    = colsRef.current;
        const rows    = rowsRef.current;
        const pixels  = pixelsRef.current;
        const bases   = basesRef.current;
        const acc     = scoreAccRef.current;
        const cel     = celebrationRef.current;
        const crystal = crystalRef.current;

        frameRef.current++;

        if (!cel.active) {
          for (const c of creaturesRef.current)
            stepCreature(c, grid, cols, rows, pixels, bases, acc, crystal);
        }

        if (frameRef.current % 30 === 0) {
          if (acc.red  > 0) { setRedScore(s  => s + acc.red);  acc.red  = 0; }
          if (acc.blue > 0) { setBlueScore(s => s + acc.blue); acc.blue = 0; }
          const cs = creaturesRef.current;
          setCreatureCounts({
            red:  cs.filter(c => c.team === "red").length,
            blue: cs.filter(c => c.team === "blue").length,
          });
        }

        // Victory: crystal reaches CRYSTAL_MAX blocks
        const redWon  = crystal.red.length  >= CRYSTAL_MAX;
        const blueWon = crystal.blue.length >= CRYSTAL_MAX;
        if (!cel.active && (redWon || blueWon)) {
          setRedScore(s  => s + acc.red);
          setBlueScore(s => s + acc.blue);
          acc.red = acc.blue = 0;
          const winner = redWon ? "red" : "blue";
          const hw = canvas.width / 2, hh = canvas.height / 2;
          const particles = Array.from({ length: 120 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            return {
              x: hw + (Math.random() - 0.5) * 80,
              y: hh + (Math.random() - 0.5) * 80,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: Math.floor(Math.random() * 80 + 60),
              maxLife: 140,
              size: Math.random() * 3 + 1,
            };
          });
          celebrationRef.current = { active: true, winner, endFrame: frameRef.current + 180, particles };
        }

        const ctx   = canvas.getContext("2d");
        const pulse = 0.75 + Math.sin(time * 0.003) * 0.25;

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maze, 0, 0);

        // ── Base zone pulsing glow overlays ────────────────────────────────
        if (bases.red && bases.blue) {
          const basePxW = Math.floor(cols * BASE_FRAC) * CELL;
          const baseAlpha = 0.05 + Math.sin(time * 0.004) * 0.03;
          ctx.save();
          ctx.globalAlpha = baseAlpha;
          ctx.fillStyle = RED.hot;
          ctx.fillRect(0, 0, basePxW, canvas.height);
          ctx.globalAlpha = baseAlpha;
          ctx.fillStyle = BLUE.hot;
          ctx.fillRect(canvas.width - basePxW, 0, basePxW, canvas.height);
          ctx.restore();
        }

        // ── White pixels — firefly flash ───────────────────────────────────
        for (const p of pixels) {
          if (p.carrier) continue;
          const on = (frameRef.current + p.x * 3 + p.y * 7) % 20 < 10;
          ctx.shadowBlur  = on ? 25 : 5;
          ctx.shadowColor = "#ffffff";
          ctx.fillStyle   = "#ffffff";
          ctx.beginPath();
          ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── Crystals ───────────────────────────────────────────────────────
        if (bases.red && bases.blue) {
          const basePxW   = Math.floor(cols * BASE_FRAC) * CELL;
          const redCenterX  = basePxW / 2;
          const blueCenterX = canvas.width - basePxW / 2;
          ctx.save();
          drawCrystal(ctx, crystal.red,  redCenterX,  canvas.height, RED,  time);
          drawCrystal(ctx, crystal.blue, blueCenterX, canvas.height, BLUE, time);
          ctx.restore();
        }

        // ── Creatures — trails then body ───────────────────────────────────
        for (const c of creaturesRef.current) {
          const bodyColor  = CREATURE_COLOR[c.team];
          const cx         = c.x * CELL + CELL / 2;
          const cy         = c.y * CELL + CELL / 2;
          const dancing    = cel.active;
          const danceScale = dancing ? (1.5 + Math.sin(time * 0.018 + c.x * 0.7) * 0.5) : 1;

          for (let i = 0; i < c.trail.length; i++) {
            const t    = c.trail[i];
            const frac = (i + 1) / c.trail.length;
            ctx.save();
            ctx.globalAlpha = frac * 0.6;
            ctx.shadowBlur  = 6;
            ctx.shadowColor = bodyColor;
            ctx.fillStyle   = bodyColor;
            ctx.beginPath();
            ctx.arc(t.x * CELL + CELL / 2, t.y * CELL + CELL / 2, 2.5 * frac, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          const r         = 4 * danceScale;
          const glowPulse = 20 + Math.sin(time * 0.005 + cx) * 10;
          ctx.shadowBlur  = glowPulse * (dancing ? 2 : 1);
          ctx.shadowColor = bodyColor;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0,   "#ffffff");
          grad.addColorStop(0.5, bodyColor);
          grad.addColorStop(1,   bodyColor + "88");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur  = 8;
          ctx.shadowColor = "#ffffff";
          ctx.fillStyle   = "#ffffff";
          ctx.beginPath();
          ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── Celebration overlay ────────────────────────────────────────────
        if (cel.active) {
          const winColors  = cel.winner === "red" ? RED : BLUE;
          ctx.save();
          ctx.globalAlpha = 0.1 + Math.sin(time * 0.015) * 0.08;
          ctx.fillStyle   = winColors.hot;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();

          for (const p of cel.particles) {
            if (p.life <= 0) continue;
            p.x  += p.vx;
            p.y  += p.vy;
            p.vy += 0.12;
            p.vx *= 0.99;
            p.life--;
            ctx.save();
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.shadowBlur  = 8;
            ctx.shadowColor = winColors.hot;
            ctx.fillStyle   = winColors.mid;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          const fontSize = Math.min(canvas.width / 8, 64) * (1 + Math.sin(time * 0.008) * 0.06);
          ctx.save();
          ctx.shadowBlur   = 30;
          ctx.shadowColor  = winColors.hot;
          ctx.fillStyle    = "#ffffff";
          ctx.font         = `bold ${fontSize}px 'Courier New', monospace`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${cel.winner.toUpperCase()} WINS!`, canvas.width / 2, canvas.height / 2);
          ctx.restore();

          if (frameRef.current >= cel.endFrame) pendingResetRef.current = true;
        }

        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const pad2 = n => String(n).padStart(2, "0");

  return (
    <div style={{
      width: "100vw", height: "100dvh", overflow: "hidden",
      background: "#050510", position: "relative",
      fontFamily: "'Courier New', monospace",
    }}>
      <canvas
        ref={canvasRef}
        width={vp.w}
        height={vp.h}
        style={{ position: "absolute", inset: 0, display: "block" }}
      />

      {/* Scoreboard */}
      <div style={{
        position: "absolute", top: 16, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 6, pointerEvents: "none", zIndex: 10,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24, padding: "7px 20px",
          color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 1,
          boxShadow: `0 0 24px ${RED.glow}, 0 0 24px ${BLUE.glow}`,
        }}>
          <span style={{ color: RED.mid }}>RED</span>
          <span>❤️</span>
          <span style={{ color: RED.mid, fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "center" }}>
            {pad2(redScore)}
          </span>
          <span style={{ opacity: 0.45, margin: "0 4px" }}>vs</span>
          <span style={{ color: BLUE.mid, fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "center" }}>
            {pad2(blueScore)}
          </span>
          <span>💙</span>
          <span style={{ color: BLUE.mid }}>BLUE</span>
        </div>

        {/* Creature count */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "3px 14px",
          color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
          opacity: 0.85,
        }}>
          <span style={{ color: RED.mid }}>🔴 x{creatureCounts.red}</span>
          <span style={{ opacity: 0.4 }}>vs</span>
          <span style={{ color: BLUE.mid }}>x{creatureCounts.blue} 💙</span>
        </div>
      </div>

      {/* TikTok comment feed — bottom-left */}
      <div style={{
        position: "absolute", bottom: 20, left: 16,
        display: "flex", flexDirection: "column", gap: 4,
        maxWidth: 280, pointerEvents: "none", zIndex: 10,
      }}>
        {comments.map((c, i) => (
          <div key={c.id} style={{
            color: "#fff",
            fontSize: 11,
            fontFamily: "'Courier New', monospace",
            background: "rgba(0,0,0,0.38)",
            backdropFilter: "blur(6px)",
            padding: "2px 10px",
            borderRadius: 10,
            opacity: 0.3 + (i / Math.max(comments.length - 1, 1)) * 0.7,
            transition: "opacity 0.4s",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {c.text}
          </div>
        ))}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
      `}</style>
    </div>
  );
}
