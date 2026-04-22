import { useEffect, useRef, useState } from "react";

const CELL           = 4;
const PIXELS_TOTAL   = 20;
const DEPOT_COLS     = 4;
const CREATURE_INTERVAL = 6;  // frames between steps
const WALL = 0;
const PATH = 1;
const MOVE_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const RED  = { hot: "#ff2d55", mid: "#ff6b9d", deep: "#c21858", glow: "rgba(255,45,85,0.4)" };
const BLUE = { hot: "#38bdf8", mid: "#6bc6ff", deep: "#1e3a8a", glow: "rgba(56,189,248,0.4)" };

const oddify = n => (n % 2 === 0 ? n - 1 : n);

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
    state: "SEEKING",  // SEEKING | CARRYING
    path: null,
    pixel: null,
    moveTimer: Math.floor(Math.random() * CREATURE_INTERVAL),
  };
}

function stepCreature(c, grid, cols, rows, pixels, depots, scoreAcc) {
  c.moveTimer--;
  if (c.moveTimer > 0) return;
  c.moveTimer = CREATURE_INTERVAL;

  // Recalculate path when empty
  if (!c.path || c.path.length === 0) {
    if (c.state === "SEEKING") {
      const pixelKeys = new Set();
      for (const p of pixels)
        if (!p.deposited && !p.carrier) pixelKeys.add(p.y * cols + p.x);
      if (pixelKeys.size === 0) return;
      c.path = bfsPath(grid, cols, rows, c.x, c.y, (x, y) => pixelKeys.has(y * cols + x));
    } else {
      const d = depots[c.team];
      c.path = bfsPath(grid, cols, rows, c.x, c.y,
        (x, y) => x >= d.xMin && x <= d.xMax && y >= d.yMin && y <= d.yMax);
    }
    if (!c.path || c.path.length === 0) return;
  }

  // Move one step
  const { x, y } = c.path.shift();
  c.x = x;
  c.y = y;

  // Arrival checks
  if (c.state === "SEEKING") {
    for (const p of pixels) {
      if (!p.deposited && !p.carrier && p.x === x && p.y === y) {
        p.carrier = c;
        c.pixel   = p;
        c.state   = "CARRYING";
        c.path    = null;
        break;
      }
    }
  } else if (c.state === "CARRYING" && c.pixel) {
    const d = depots[c.team];
    if (x >= d.xMin && x <= d.xMax && y >= d.yMin && y <= d.yMax) {
      c.pixel.deposited = true;
      c.pixel.carrier   = null;
      c.pixel           = null;
      c.state           = "SEEKING";
      c.path            = null;
      scoreAcc[c.team]++;
    }
  }
}

export default function LabyrinthLive() {
  const canvasRef    = useRef(null);
  const mazeLayerRef = useRef(null);
  const gridRef      = useRef(null);
  const colsRef      = useRef(0);
  const rowsRef      = useRef(0);
  const creaturesRef = useRef([]);
  const pixelsRef    = useRef([]);
  const depotsRef    = useRef({ red: null, blue: null });
  const rafRef       = useRef(null);
  const frameRef     = useRef(0);
  const scoreAccRef  = useRef({ red: 0, blue: 0 });

  const [redScore,  setRedScore]  = useState(0);
  const [blueScore, setBlueScore] = useState(0);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const cols = oddify(Math.max(9, Math.floor(vp.w / CELL)));
    const rows = oddify(Math.max(9, Math.floor(vp.h / CELL)));
    const grid = generateMaze(cols, rows);

    gridRef.current      = grid;
    colsRef.current      = cols;
    rowsRef.current      = rows;
    mazeLayerRef.current = buildMazeCanvas(grid, cols, rows);

    // Depots
    const redDepot  = { xMin: 1,                   xMax: DEPOT_COLS,           yMin: 1, yMax: rows - 2 };
    const blueDepot = { xMin: cols - DEPOT_COLS - 1, xMax: cols - 2,            yMin: 1, yMax: rows - 2 };
    depotsRef.current = { red: redDepot, blue: blueDepot };

    // Pixels in the middle corridor
    const midXMin = DEPOT_COLS + 2;
    const midXMax = cols - DEPOT_COLS - 2;
    const midPixels = placeOnPath(grid, rows, midXMin, midXMax, PIXELS_TOTAL);
    pixelsRef.current = midPixels.map(({ x, y }) => ({ x, y, carrier: null, deposited: false }));

    // 2 creatures per team
    const third = Math.max(3, Math.floor(cols / 3));
    const redSpots  = placeOnPath(grid, rows, DEPOT_COLS + 1, third, 2);
    const blueSpots = placeOnPath(grid, rows, cols - third, cols - DEPOT_COLS - 2, 2);
    creaturesRef.current = [
      ...redSpots.map(({ x, y })  => makeCreature(x, y, "red")),
      ...blueSpots.map(({ x, y }) => makeCreature(x, y, "blue")),
    ];

    setRedScore(0);
    setBlueScore(0);
    scoreAccRef.current = { red: 0, blue: 0 };
    frameRef.current    = 0;
  }, [vp]);

  useEffect(() => {
    const render = (time) => {
      const canvas = canvasRef.current;
      const maze   = mazeLayerRef.current;
      const grid   = gridRef.current;

      if (canvas && maze && grid) {
        const cols    = colsRef.current;
        const rows    = rowsRef.current;
        const pixels  = pixelsRef.current;
        const depots  = depotsRef.current;
        const acc     = scoreAccRef.current;

        frameRef.current++;

        // Step all creatures
        for (const c of creaturesRef.current)
          stepCreature(c, grid, cols, rows, pixels, depots, acc);

        // Flush scores to state ~2× per second
        if (frameRef.current % 30 === 0) {
          if (acc.red  > 0) { setRedScore(s  => s + acc.red);  acc.red  = 0; }
          if (acc.blue > 0) { setBlueScore(s => s + acc.blue); acc.blue = 0; }
        }

        const ctx   = canvas.getContext("2d");
        const pulse = 0.75 + Math.sin(time * 0.003) * 0.25;

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maze, 0, 0);

        // Depot overlays
        if (depots.red && depots.blue) {
          const rd = depots.red, bd = depots.blue;
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = RED.hot;
          ctx.fillRect(rd.xMin * CELL, rd.yMin * CELL, (rd.xMax - rd.xMin + 1) * CELL, (rd.yMax - rd.yMin + 1) * CELL);
          ctx.fillStyle = BLUE.hot;
          ctx.fillRect(bd.xMin * CELL, bd.yMin * CELL, (bd.xMax - bd.xMin + 1) * CELL, (bd.yMax - bd.yMin + 1) * CELL);
          ctx.restore();
          ctx.lineWidth = 1;
          ctx.strokeStyle = RED.mid;
          ctx.strokeRect(rd.xMin * CELL + 0.5, rd.yMin * CELL + 0.5,
            (rd.xMax - rd.xMin + 1) * CELL - 1, (rd.yMax - rd.yMin + 1) * CELL - 1);
          ctx.strokeStyle = BLUE.mid;
          ctx.strokeRect(bd.xMin * CELL + 0.5, bd.yMin * CELL + 0.5,
            (bd.xMax - bd.xMin + 1) * CELL - 1, (bd.yMax - bd.yMin + 1) * CELL - 1);
        }

        // Loose pixels
        ctx.shadowBlur  = 5;
        ctx.shadowColor = "#ffffffaa";
        ctx.fillStyle   = "#ffffff";
        for (const p of pixels) {
          if (p.deposited || p.carrier) continue;
          ctx.beginPath();
          ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Creatures
        for (const c of creaturesRef.current) {
          const colors = c.team === "red" ? RED : BLUE;
          const cx     = c.x * CELL + CELL / 2;
          const cy     = c.y * CELL + CELL / 2;

          ctx.shadowBlur  = 10 * pulse;
          ctx.shadowColor = colors.hot;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3);
          grad.addColorStop(0,   "#ffffff");
          grad.addColorStop(0.4, colors.mid);
          grad.addColorStop(1,   colors.deep);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // White dot on top when carrying a pixel
          if (c.state === "CARRYING") {
            ctx.shadowBlur  = 6;
            ctx.shadowColor = "#ffffff";
            ctx.fillStyle   = "#ffffff";
            ctx.beginPath();
            ctx.arc(cx, cy, 1, 0, Math.PI * 2);
            ctx.fill();
          }
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
        display: "flex", justifyContent: "center", pointerEvents: "none",
        zIndex: 10,
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
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
      `}</style>
    </div>
  );
}
