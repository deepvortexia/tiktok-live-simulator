import { useCallback, useEffect, useRef, useState } from "react";

const CELL = 4;
const GRAINS_PER_TEAM = 50;
const WALL = 0;
const PATH = 1;
const MOVE_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const RED  = { hot: "#ff2d55", mid: "#ff6b9d", deep: "#c21858", glow: "rgba(255,45,85,0.4)" };
const BLUE = { hot: "#38bdf8", mid: "#6bc6ff", deep: "#1e3a8a", glow: "rgba(56,189,248,0.4)" };

const SPECIES_META = {
  rosier: { label: "🌸 Rosier", interval: 8, radius: 2,   glow: 10 },
  leon:   { label: "🦁 Léon",  interval: 8, radius: 3,   glow: 14 },
  fusio:  { label: "🚀 Fusio", interval: 3, radius: 2,   glow: 12 },
  cosmik: { label: "🌌 Cosmik",interval: 8, radius: 2.5, glow: 11 },
};

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

function placeGrains(grid, rows, xMin, xMax, count) {
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
  off.width = cols * CELL;
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

function paintCell(ctx, x, y, isWall) {
  if (isWall) {
    ctx.fillStyle = "#0e1030";
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    ctx.strokeStyle = "rgba(110,150,255,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
  } else {
    ctx.fillStyle = "#050510";
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
}

function makeCreature(x, y, team, species) {
  return {
    x, y, prevX: x, prevY: y,
    team, species,
    moveTimer: Math.floor(Math.random() * SPECIES_META[species].interval),
  };
}

function stepCreature(c, grid, cols, rows, mazeCtx) {
  c.moveTimer--;
  if (c.moveTimer > 0) return 0;
  c.moveTimer = SPECIES_META[c.species].interval;

  const { x, y, species } = c;

  const neighbors = [];
  for (const [dx, dy] of MOVE_DIRS) {
    const nx = x + dx, ny = y + dy;
    if (nx <= 0 || nx >= cols - 1 || ny <= 0 || ny >= rows - 1) continue;
    if (species === "cosmik") {
      if (grid[ny][nx] === PATH) neighbors.push([nx, ny]);
    } else {
      neighbors.push([nx, ny]);
    }
  }

  if (neighbors.length === 0) return 0;

  const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
  let scored = 0;

  // Dig: entering a WALL cell converts it to PATH
  if (grid[ny][nx] === WALL && species !== "cosmik") {
    grid[ny][nx] = PATH;
    paintCell(mazeCtx, nx, ny, false);
    scored = 1;
  }

  c.prevX = c.x;
  c.prevY = c.y;
  c.x = nx;
  c.y = ny;

  // Build: Léon and Cosmik wall off the cell they just left
  if (species === "leon" || species === "cosmik") {
    const { prevX, prevY } = c;
    if (prevX > 0 && prevX < cols - 1 && prevY > 0 && prevY < rows - 1 && grid[prevY][prevX] === PATH) {
      grid[prevY][prevX] = WALL;
      paintCell(mazeCtx, prevX, prevY, true);
    }
  }

  return scored;
}

export default function LabyrinthLive() {
  const canvasRef   = useRef(null);
  const mazeLayerRef = useRef(null);
  const mazeCtxRef  = useRef(null);
  const gridRef     = useRef(null);
  const colsRef     = useRef(0);
  const rowsRef     = useRef(0);
  const creaturesRef = useRef([]);
  const rafRef      = useRef(null);
  const frameRef    = useRef(0);
  const scoreAccRef = useRef({ red: 0, blue: 0 });

  const [redScore, setRedScore]   = useState(0);
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

    gridRef.current  = grid;
    colsRef.current  = cols;
    rowsRef.current  = rows;

    const off = buildMazeCanvas(grid, cols, rows);
    mazeLayerRef.current = off;
    mazeCtxRef.current   = off.getContext("2d");

    const third     = Math.max(3, Math.floor(cols / 3));
    const redSpots  = placeGrains(grid, rows, 1, third, GRAINS_PER_TEAM);
    const blueSpots = placeGrains(grid, rows, cols - third, cols - 1, GRAINS_PER_TEAM);

    creaturesRef.current = [
      ...redSpots.map(({ x, y }) => makeCreature(x, y, "red",  "rosier")),
      ...blueSpots.map(({ x, y }) => makeCreature(x, y, "blue", "rosier")),
    ];

    setRedScore(0);
    setBlueScore(0);
    scoreAccRef.current = { red: 0, blue: 0 };
  }, [vp]);

  useEffect(() => {
    const render = (time) => {
      const canvas   = canvasRef.current;
      const maze     = mazeLayerRef.current;
      const grid     = gridRef.current;
      const mazeCtx  = mazeCtxRef.current;

      if (canvas && maze && grid && mazeCtx) {
        const cols = colsRef.current;
        const rows = rowsRef.current;

        frameRef.current++;

        for (const c of creaturesRef.current) {
          const pts = stepCreature(c, grid, cols, rows, mazeCtx);
          if (pts) scoreAccRef.current[c.team] += pts;
        }

        // Flush accumulated scores to state ~2× per second
        if (frameRef.current % 30 === 0) {
          const { red, blue } = scoreAccRef.current;
          if (red  > 0) { setRedScore(s  => s + red);  scoreAccRef.current.red  = 0; }
          if (blue > 0) { setBlueScore(s => s + blue); scoreAccRef.current.blue = 0; }
        }

        const ctx   = canvas.getContext("2d");
        const pulse = 0.75 + Math.sin(time * 0.003) * 0.25;

        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maze, 0, 0);

        for (const c of creaturesRef.current) {
          const colors = c.team === "red" ? RED : BLUE;
          const meta   = SPECIES_META[c.species];
          const cx     = c.x * CELL + CELL / 2;
          const cy     = c.y * CELL + CELL / 2;

          ctx.shadowBlur  = meta.glow * pulse;
          ctx.shadowColor = colors.hot;

          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, meta.radius);
          grad.addColorStop(0,   "#ffffff");
          grad.addColorStop(0.4, colors.mid);
          grad.addColorStop(1,   colors.deep);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, meta.radius / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const spawn = useCallback((species) => {
    const grid = gridRef.current;
    const cols = colsRef.current;
    const rows = rowsRef.current;
    if (!grid) return;
    const third     = Math.max(3, Math.floor(cols / 3));
    const redSpots  = placeGrains(grid, rows, 1, third, 1);
    const blueSpots = placeGrains(grid, rows, cols - third, cols - 1, 1);
    if (redSpots[0])  creaturesRef.current.push(makeCreature(redSpots[0].x,  redSpots[0].y,  "red",  species));
    if (blueSpots[0]) creaturesRef.current.push(makeCreature(blueSpots[0].x, blueSpots[0].y, "blue", species));
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

      {/* Gift Buttons */}
      <div style={{
        position: "absolute", bottom: 20, left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: 12,
        zIndex: 10,
      }}>
        {Object.entries(SPECIES_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => spawn(key)}
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 16,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 16px",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              letterSpacing: 0.5,
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(0,0,0,0.6)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            }}
          >
            {meta.label}
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
