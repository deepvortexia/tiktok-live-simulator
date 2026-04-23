import { useEffect, useRef, useState } from "react";

const CELL             = 4;
const PIXELS_TOTAL     = 35;
const BASE_FRAC        = 0.15;
const CREATURE_INTERVAL = 4;
const WALL = 0;
const PATH = 1;
const MOVE_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const MAX_PER_TEAM = 30;
const TAIL_RENDER_MAX = 40;

const RED  = { hot: "#ff2d55", mid: "#ff6b9d", deep: "#c21858", glow: "rgba(255,45,85,0.4)" };
const BLUE = { hot: "#38bdf8", mid: "#6bc6ff", deep: "#1e3a8a", glow: "rgba(56,189,248,0.4)" };

const CREATURE_COLOR = { red: "#ff0044", blue: "#00ccff" };

const RED_GIFTS = [
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",     label: "Rose",         cost:   1, count: 1, radius: 2, interval: 10 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp", label: "Finger Heart", cost:   5, count: 1, radius: 3, interval:  6 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp",     label: "Rosa",         cost:  10, count: 2, radius: 3, interval:  6 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp",     label: "Perfume",      cost:  20, count: 3, radius: 4, interval:  4 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",     label: "Doughnut",     cost:  30, count: 1, radius: 3, interval:  5, rush: true, rushDuration: 600 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cb4e11b3834e149f08e1cdcc93870b26~tplv-obj.webp",     label: "Confetti",     cost: 100, count: 5, radius: 5, interval:  3, rush: true, rushDuration: 1200 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/2f1e4f3f5c728ffbfa35705b480fdc92~tplv-obj.webp",     label: "Hat+Mustache", cost: 100, count: 3, radius: 4, interval:  3, rush: true, rushDuration: 1200 },
];
const BLUE_GIFTS = [
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.webp",                              label: "TikTok",               cost:   1, count: 1, radius: 2, interval: 10 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dfd48ef1952b6d315856adda7705d02d.png~tplv-obj.webp",                   label: "Overreact",            cost:   5, count: 1, radius: 3, interval:  6 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/e033c3f28632e233bebac1668ff66a2f.png~tplv-obj.webp",                   label: "Friendship Necklace",  cost:  10, count: 2, radius: 3, interval:  6 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/40ba71a3b3d6b9f799d99082f36b2baa.png~tplv-obj.webp",                   label: "LIVE",                 cost:  20, count: 3, radius: 4, interval:  4 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/075e206d6da035f10ff5f8fecd82abcc.png~tplv-obj.webp",                   label: "Bravo",                cost:  30, count: 1, radius: 3, interval:  5, rush: true, rushDuration: 600 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/6cd022271dc4669d182cad856384870f~tplv-obj.webp",                               label: "Hand Heart",           cost: 100, count: 5, radius: 5, interval:  3, rush: true, rushDuration: 1200 },
  { icon: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/0f158a08f7886189cdabf496e8a07c21~tplv-obj.webp",                                label: "Paper Crane",          cost: 100, count: 3, radius: 4, interval:  3, rush: true, rushDuration: 1200 },
];

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

function buildMazeCanvas(grid, cols, rows, colorScheme = "tied") {
  const off = document.createElement("canvas");
  off.width  = cols * CELL;
  off.height = rows * CELL;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, off.width, off.height);
  const wallFill   = colorScheme === "red"  ? "#1a0008"
                   : colorScheme === "blue" ? "#000e1a"
                   : "#0e1030";
  const wallStroke = colorScheme === "red"  ? "rgba(255,45,85,0.22)"
                   : colorScheme === "blue" ? "rgba(56,189,248,0.22)"
                   : "rgba(110,150,255,0.22)";
  ctx.fillStyle = wallFill;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === WALL) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = wallStroke;
  ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === WALL) ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
  return off;
}

function bfsPath(grid, cols, rows, sx, sy, isTarget) {
  if (isTarget(sx, sy)) return [];
  const startKey = sy * cols + sx;
  const parent   = new Map([[startKey, -1]]);
  const queue    = [startKey];
  let head = 0;
  while (head < queue.length) {
    const curKey = queue[head++];
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

function makeCreature(x, y, team, radius = 4, interval = CREATURE_INTERVAL) {
  return {
    x, y, team,
    path: null,
    pathRetryIn: 0,
    tail: [],
    tailMax: 0,
    radius,
    interval,
    moveTimer: Math.floor(Math.random() * interval),
  };
}

function stepCreature(c, grid, cols, rows, pixels, onScore, rushActive, pathCaches) {
  c.moveTimer--;
  if (c.moveTimer > 0) return;
  c.moveTimer = rushActive ? Math.max(1, Math.floor(c.interval / 3)) : c.interval;

  if (!c.path || c.path.length === 0) {
    if (c.pathRetryIn > 0) { c.pathRetryIn--; return; }
    const pixelKeys = new Set();
    for (const p of pixels)
      if (!p.carrier) pixelKeys.add(p.y * cols + p.x);
    if (pixelKeys.size === 0) return;
    c.path = bfsPath(grid, cols, rows, c.x, c.y, (x, y) => pixelKeys.has(y * cols + x));
    if (!c.path || c.path.length === 0) { c.pathRetryIn = 20; return; }
  }

  // Append current position to tail before moving, trim to tailMax
  if (c.tailMax > 0) {
    c.tail.push({ x: c.x, y: c.y });
    if (c.tail.length > c.tailMax) c.tail.shift();
  }

  const { x, y } = c.path.shift();
  c.x = x;
  c.y = y;

  // Check pixel pickup
  for (const p of pixels) {
    if (!p.carrier && p.x === x && p.y === y) {
      c.tailMax += 4;
      // Respawn pixel — try 10 candidates from full zone, pick farthest from other pixels
      const fullCells = pathCaches?.full;
      if (fullCells && fullCells.length > 0) {
        let bestSpot = null, bestDist = -1;
        for (let attempt = 0; attempt < 10; attempt++) {
          const cand = fullCells[Math.floor(Math.random() * fullCells.length)];
          let minDist = Infinity;
          for (const other of pixels) {
            if (other === p) continue;
            const dx = cand.x - other.x, dy = cand.y - other.y;
            const d = dx * dx + dy * dy;
            if (d < minDist) minDist = d;
          }
          if (minDist > bestDist) { bestDist = minDist; bestSpot = cand; }
        }
        if (bestSpot) { p.x = bestSpot.x; p.y = bestSpot.y; }
      }
      onScore(c.team);
      c.path = null;
      break;
    }
  }
}

export default function LabyrinthLive() {
  const canvasRef       = useRef(null);
  const ctxRef          = useRef(null);
  const mazeLayerRef    = useRef(null);
  const pathCachesRef   = useRef({ mid: [] });
  const gridRef         = useRef(null);
  const colsRef         = useRef(0);
  const rowsRef         = useRef(0);
  const creaturesRef    = useRef([]);
  const pixelsRef       = useRef([]);
  const basesRef        = useRef({ red: null, blue: null });
  const rafRef          = useRef(null);
  const frameRef        = useRef(0);
  const scoreTotalsRef  = useRef({ red: 0, blue: 0 });
  const celebrationRef  = useRef({ active: false, winner: null, endFrame: 0, particles: [] });
  const pendingResetRef = useRef(false);
  const rushRef         = useRef({ red: { active: false, endFrame: 0 }, blue: { active: false, endFrame: 0 } });
  const frenzyRef       = useRef({ active: false, endFrame: 0 });
  const timerRef        = useRef(180);
  const wallColorStateRef = useRef("tied");

  const [redScore,       setRedScore]       = useState(0);
  const [blueScore,      setBlueScore]      = useState(0);
  const [resetCount,     setResetCount]     = useState(0);
  const [creatureCounts, setCreatureCounts] = useState({ red: 2, blue: 2 });
  const [comments,       setComments]       = useState(() => [randomComment(), randomComment(), randomComment()]);
  const [rushDisplay,    setRushDisplay]    = useState({ red: 0, blue: 0, redTotal: 1, blueTotal: 1 });
  const [frenzyDisplay,  setFrenzyDisplay]  = useState(0);
  const [timeLeft,       setTimeLeft]       = useState(180);
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
    wallColorStateRef.current = "tied";
    mazeLayerRef.current = buildMazeCanvas(grid, cols, rows, "tied");

    const baseCols = Math.max(3, Math.floor(cols * BASE_FRAC));
    const redBase  = { xMin: 1,                  xMax: baseCols,          yMin: 1, yMax: rows - 2 };
    const blueBase = { xMin: cols - baseCols - 1, xMax: cols - 2,          yMin: 1, yMax: rows - 2 };
    basesRef.current = { red: redBase, blue: blueBase };

    const midXMin      = Math.floor(cols / 3);
    const midXMax      = Math.floor(cols * 2 / 3);
    const fullZoneXMin = Math.floor(cols * 0.15);
    const fullZoneXMax = Math.floor(cols * 0.85);
    const initPixels   = placeOnPath(grid, rows, fullZoneXMin, fullZoneXMax, PIXELS_TOTAL);
    pixelsRef.current  = initPixels.map(({ x, y }) => ({ x, y, carrier: null }));

    // Pre-cache full-zone PATH cells for pixel respawn (excludes base zones)
    const fullZoneCells = [];
    for (let y = 1; y < rows - 1; y++)
      for (let x = fullZoneXMin; x < fullZoneXMax; x++)
        if (grid[y][x] === PATH) fullZoneCells.push({ x, y });
    pathCachesRef.current = { full: fullZoneCells };

    const redSpots  = placeOnPath(grid, rows, redBase.xMin,  redBase.xMax  + 1, 2);
    const blueSpots = placeOnPath(grid, rows, blueBase.xMin, blueBase.xMax + 1, 2);
    creaturesRef.current = [
      ...redSpots.map(({ x, y })  => makeCreature(x, y, "red")),
      ...blueSpots.map(({ x, y }) => makeCreature(x, y, "blue")),
    ];

    scoreTotalsRef.current  = { red: 0, blue: 0 };
    celebrationRef.current  = { active: false, winner: null, endFrame: 0, particles: [] };
    pendingResetRef.current = false;
    rushRef.current   = { red: { active: false, endFrame: 0, totalFrames: 1 }, blue: { active: false, endFrame: 0, totalFrames: 1 } };
    frenzyRef.current = { active: false, endFrame: 0 };
    setRedScore(0);
    setBlueScore(0);
    timerRef.current = 180;
    setTimeLeft(180);
    frameRef.current = 0;
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

      if (canvas && !ctxRef.current) ctxRef.current = canvas.getContext("2d");

      if (canvas && maze && grid) {
        const cols   = colsRef.current;
        const rows   = rowsRef.current;
        const pixels = pixelsRef.current;
        const bases  = basesRef.current;
        const cel    = celebrationRef.current;
        const rush   = rushRef.current;
        const frenzy = frenzyRef.current;

        frameRef.current++;

        for (const team of ["red", "blue"])
          if (rush[team].active && frameRef.current >= rush[team].endFrame)
            rush[team].active = false;

        if (frenzy.active && frameRef.current >= frenzy.endFrame)
          frenzy.active = false;

        // Auto-frenzy every 1800 frames while game is running
        if (!cel.active && timerRef.current > 30 && frameRef.current > 0 && frameRef.current % 1800 === 0) {
          frenzy.active   = true;
          frenzy.endFrame = frameRef.current + 300;
          // If rush already active per team, extend it by 300 instead of double-counting
          for (const team of ["red", "blue"])
            if (rush[team].active) rush[team].endFrame += 300;
        }

        if (!cel.active) {
          const onScore = (team) => {
            const total = creaturesRef.current
              .filter(c => c.team === team)
              .reduce((s, c) => s + Math.floor(c.tailMax / 4), 0);
            scoreTotalsRef.current[team] = total;
            if (team === "red") setRedScore(total);
            else setBlueScore(total);
          };
          for (const c of creaturesRef.current)
            stepCreature(c, grid, cols, rows, pixels, onScore, rush[c.team].active || frenzy.active, pathCachesRef.current);
        }

        if (frameRef.current % 10 === 0) {
          setRushDisplay({
            red:      rush.red.active  ? Math.max(0, rush.red.endFrame  - frameRef.current) : 0,
            blue:     rush.blue.active ? Math.max(0, rush.blue.endFrame - frameRef.current) : 0,
            redTotal:  rush.red.totalFrames,
            blueTotal: rush.blue.totalFrames,
          });
          setFrenzyDisplay(!cel.active && timerRef.current > 0 ? 1800 - (frameRef.current % 1800) : 0);
        }

        if (frameRef.current % 30 === 0) {
          const cs = creaturesRef.current;
          setCreatureCounts({
            red:  cs.filter(c => c.team === "red").length,
            blue: cs.filter(c => c.team === "blue").length,
          });
        }

        // Countdown timer — 1 second per 60 frames
        if (!cel.active && frameRef.current % 60 === 0 && timerRef.current > 0) {
          timerRef.current--;
          setTimeLeft(timerRef.current);
        }

        // Maintain minimum 2 crawlers per team
        if (!cel.active && frameRef.current % 60 === 0) {
          for (const team of ["red", "blue"]) {
            const teamCount = creaturesRef.current.filter(c => c.team === team).length;
            if (teamCount < 2) {
              const b = bases[team];
              if (b) {
                const needed = 2 - teamCount;
                const spots  = placeOnPath(grid, rows, b.xMin, b.xMax + 1, needed);
                for (const { x, y } of spots)
                  creaturesRef.current.push(makeCreature(x, y, team));
              }
            }
          }
        }

        // Victory: timer hits 0 → winner by score, or score threshold reached early
        const sc = scoreTotalsRef.current;
        if (!cel.active && timerRef.current <= 0) {
          const winner = sc.red === sc.blue ? "draw"
            : sc.red > sc.blue ? "red" : "blue";
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

        const ctx = ctxRef.current;

        // Rebuild maze layer when the winning team changes
        const sc2 = scoreTotalsRef.current;
        const newColorState = sc2.red > sc2.blue ? "red" : sc2.blue > sc2.red ? "blue" : "tied";
        if (newColorState !== wallColorStateRef.current) {
          wallColorStateRef.current = newColorState;
          mazeLayerRef.current = buildMazeCanvas(grid, cols, rows, newColorState);
        }

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mazeLayerRef.current, 0, 0);

        // ── Base zone pulsing glow overlays ────────────────────────────────
        if (bases.red && bases.blue) {
          const basePxW   = Math.floor(cols * BASE_FRAC) * CELL;
          const baseAlpha = 0.05 + Math.sin(time * 0.004) * 0.03;
          ctx.globalAlpha = baseAlpha;
          ctx.fillStyle   = RED.hot;
          ctx.fillRect(0, 0, basePxW, canvas.height);
          ctx.fillStyle   = BLUE.hot;
          ctx.fillRect(canvas.width - basePxW, 0, basePxW, canvas.height);
          ctx.globalAlpha = 1;
        }

        // ── White pixels — firefly flash ───────────────────────────────────
        ctx.shadowColor = "#ffffff";
        ctx.fillStyle   = "#ffffff";
        for (const p of pixels) {
          if (p.carrier) continue;
          const on = (frameRef.current + p.x * 3 + p.y * 7) % 20 < 10;
          ctx.shadowBlur = on ? 12 : 5;
          ctx.beginPath();
          ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── Creatures — snake tail then body ──────────────────────────────
        for (const c of creaturesRef.current) {
          const bodyColor  = CREATURE_COLOR[c.team];
          const cx         = c.x * CELL + CELL / 2;
          const cy         = c.y * CELL + CELL / 2;
          const dancing    = cel.active;
          const isRushing  = rush[c.team].active;
          const danceScale = dancing ? (1.5 + Math.sin(time * 0.018 + c.x * 0.7) * 0.5) : 1;

          // Snake tail — render up to TAIL_RENDER_MAX dots, oldest first = most faded
          const tailStart = Math.max(0, c.tail.length - TAIL_RENDER_MAX);
          const visLen    = c.tail.length - tailStart;
          if (visLen > 0) {
            ctx.shadowBlur  = 0;
            ctx.fillStyle   = bodyColor;
            for (let i = tailStart; i < c.tail.length; i++) {
              const t    = c.tail[i];
              const frac = (i - tailStart + 1) / visLen;
              ctx.globalAlpha = frac * 0.65;
              ctx.beginPath();
              ctx.arc(t.x * CELL + CELL / 2, t.y * CELL + CELL / 2, 2.5 * frac, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }

          // Body
          const r         = (c.radius + (isRushing ? 1 : 0)) * danceScale;
          const glowPulse = 20 + Math.sin(time * 0.005 + cx) * 10;
          ctx.shadowBlur  = isRushing ? 12 : Math.min(12, glowPulse * (dancing ? 2 : 1));
          ctx.shadowColor = isRushing ? "#ffffff" : bodyColor;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0,   "#ffffff");
          grad.addColorStop(0.5, bodyColor);
          grad.addColorStop(1,   bodyColor + "88");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          // White core
          ctx.shadowBlur  = 8;
          ctx.shadowColor = "#ffffff";
          ctx.fillStyle   = "#ffffff";
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, c.radius * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── Celebration overlay ────────────────────────────────────────────
        if (cel.active) {
          const winColors = cel.winner === "red" ? RED : cel.winner === "blue" ? BLUE : { hot: "#ffe066", mid: "#fff3a0", glow: "rgba(255,224,102,0.4)" };

          ctx.globalAlpha = 0.1 + Math.sin(time * 0.015) * 0.08;
          ctx.fillStyle   = winColors.hot;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;

          ctx.shadowBlur  = 8;
          ctx.shadowColor = winColors.hot;
          ctx.fillStyle   = winColors.mid;
          for (const p of cel.particles) {
            if (p.life <= 0) continue;
            p.x  += p.vx;
            p.y  += p.vy;
            p.vy += 0.12;
            p.vx *= 0.99;
            p.life--;
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          const fontSize = Math.min(canvas.width / 8, 64) * (1 + Math.sin(time * 0.008) * 0.06);
          ctx.shadowBlur   = 12;
          ctx.shadowColor  = winColors.hot;
          ctx.fillStyle    = "#ffffff";
          ctx.font         = `bold ${fontSize}px 'Courier New', monospace`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(cel.winner === "draw" ? "DRAW!" : `${cel.winner.toUpperCase()} WINS!`, canvas.width / 2, canvas.height * 0.25);

          if (frameRef.current >= cel.endFrame) pendingResetRef.current = true;
        }

        // ── Frenzy overlay ─────────────────────────────────────────────────
        if (frenzy.active) {
          const framesLeft = frenzy.endFrame - frameRef.current;
          // White flash for first 8 frames
          if (framesLeft > 292) {
            ctx.globalAlpha = (framesLeft - 292) / 8 * 0.45;
            ctx.fillStyle   = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
          }
          const frenzySize = Math.min(canvas.width / 7, 72);
          ctx.font         = `bold ${frenzySize}px 'Courier New', monospace`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.shadowBlur   = 24;
          ctx.shadowColor  = "#ffe066";
          ctx.fillStyle    = "#ffe066";
          ctx.fillText("⚡ RUSH!", canvas.width / 2, canvas.height * 0.25);
        }

        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const spawnForTeam = (team, radius, interval, count) => {
    const grid  = gridRef.current;
    const cols  = colsRef.current;
    const rows  = rowsRef.current;
    const bases = basesRef.current;
    if (!grid || !bases[team]) return;
    const teamCount = creaturesRef.current.filter(c => c.team === team).length;
    const allowed   = MAX_PER_TEAM - teamCount;
    if (allowed <= 0) return;
    const b     = bases[team];
    const spots = placeOnPath(grid, rows, b.xMin, b.xMax + 1, Math.min(count, allowed));
    for (const { x, y } of spots)
      creaturesRef.current.push(makeCreature(x, y, team, radius, interval));
  };

  const activateRush = (team, duration) => {
    rushRef.current[team].active      = true;
    rushRef.current[team].endFrame    = frameRef.current + duration;
    rushRef.current[team].totalFrames = duration;
  };

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

        {/* Countdown timer */}
        <div style={{
          background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "3px 18px",
          fontSize: 13, fontWeight: 700, letterSpacing: 2,
          color: timeLeft <= 30 ? "#ff2d55" : "#ffffff",
          fontVariantNumeric: "tabular-nums",
          transition: "color 0.3s",
        }}>
          {`${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`}
        </div>

        {/* Frenzy countdown bar — always visible during game */}
        {frenzyDisplay > 0 && timeLeft > 30 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#ffe066", opacity: 0.85 }}>
              ⚡ NEXT RUSH
            </span>
            <div style={{ width: 200, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${(frenzyDisplay / 1800) * 100}%`,
                background: "#ffe066",
                boxShadow: "0 0 8px #ffe066",
                transition: "width 0.1s linear",
              }} />
            </div>
          </div>
        )}

        {/* Rush timer bars */}
        {(rushDisplay.red > 0 || rushDisplay.blue > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 200 }}>
            {rushDisplay.red > 0 && (
              <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${(rushDisplay.red / rushDisplay.redTotal) * 100}%`,
                  background: RED.hot,
                  boxShadow: `0 0 6px ${RED.hot}`,
                  transition: "width 0.1s linear",
                }} />
              </div>
            )}
            {rushDisplay.blue > 0 && (
              <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${(rushDisplay.blue / rushDisplay.blueTotal) * 100}%`,
                  background: BLUE.hot,
                  boxShadow: `0 0 6px ${BLUE.hot}`,
                  transition: "width 0.1s linear",
                }} />
              </div>
            )}
          </div>
        )}
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

      {/* Red gift buttons — left column */}
      <div style={{
        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 2, zIndex: 10, maxWidth: 140,
      }}>
        {RED_GIFTS.map(g => (
          <button
            key={g.label}
            onClick={() => { spawnForTeam("red", g.radius, g.interval, g.count); if (g.rush) activateRush("red", g.rushDuration); }}
            style={{
              background: "rgba(0,0,0,0.72)",
              border: "1px solid rgba(255,45,85,0.25)",
              borderLeft: "2px solid rgba(255,45,85,0.7)",
              borderRadius: 5, color: "#fff",
              fontSize: 9, fontFamily: "'Courier New', monospace",
              padding: "2px 5px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              whiteSpace: "nowrap", width: "100%",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,45,85,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.58)"; }}
          >
            <img src={g.icon} alt={g.label} style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
            <span style={{ color: g.rush ? "#ffe066" : RED.mid }}>
              {g.rush ? <b>RUSH</b> : `+${g.count}`}
            </span>
          </button>
        ))}
      </div>

      {/* Blue gift buttons — right column */}
      <div style={{
        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 2, zIndex: 10, maxWidth: 140,
      }}>
        {BLUE_GIFTS.map(g => (
          <button
            key={g.label}
            onClick={() => { spawnForTeam("blue", g.radius, g.interval, g.count); if (g.rush) activateRush("blue", g.rushDuration); }}
            style={{
              background: "rgba(0,0,0,0.72)",
              border: "1px solid rgba(56,189,248,0.25)",
              borderRight: "2px solid rgba(56,189,248,0.7)",
              borderRadius: 5, color: "#fff",
              fontSize: 9, fontFamily: "'Courier New', monospace",
              padding: "2px 5px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              whiteSpace: "nowrap", width: "100%",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(56,189,248,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.58)"; }}
          >
            <span style={{ color: g.rush ? "#ffe066" : BLUE.mid }}>
              {g.rush ? <b>RUSH</b> : `+${g.count}`}
            </span>
            <img src={g.icon} alt={g.label} style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
      `}</style>
    </div>
  );
}
