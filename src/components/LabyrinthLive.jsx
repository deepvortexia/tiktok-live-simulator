import { useEffect, useRef, useState } from "react";

const CELL = 8;
const GRAIN_SIZE = 4;
const GRAINS_PER_TEAM = 50;

const WALL = 0;
const PATH = 1;

const RED  = { hot: "#ff2d55", mid: "#ff6b9d", deep: "#c21858", glow: "rgba(255,45,85,0.4)" };
const BLUE = { hot: "#38bdf8", mid: "#6bc6ff", deep: "#1e3a8a", glow: "rgba(56,189,248,0.4)" };

const oddify = (n) => (n % 2 === 0 ? n - 1 : n);

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
      const nx = cx + dx;
      const ny = cy + dy;
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
  for (let y = 1; y < rows - 1; y++) {
    for (let x = xMin; x < xMax; x++) {
      if (grid[y][x] === PATH) cands.push({ x, y });
    }
  }
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  return cands.slice(0, count);
}

function buildMazeLayer(grid, cols, rows) {
  const off = document.createElement("canvas");
  off.width = cols * CELL;
  off.height = rows * CELL;
  const ctx = off.getContext("2d");

  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, off.width, off.height);

  ctx.fillStyle = "#0e1030";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === WALL) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  ctx.strokeStyle = "rgba(110,150,255,0.22)";
  ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === WALL) {
        ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
      }
    }
  }
  return off;
}

export default function LabyrinthLive() {
  const canvasRef = useRef(null);
  const mazeLayerRef = useRef(null);
  const redGrainsRef = useRef([]);
  const blueGrainsRef = useRef([]);
  const rafRef = useRef(null);

  const [redScore] = useState(0);
  const [blueScore] = useState(0);
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

    mazeLayerRef.current = buildMazeLayer(grid, cols, rows);

    const third = Math.max(3, Math.floor(cols / 3));
    redGrainsRef.current  = placeGrains(grid, rows, 1, third, GRAINS_PER_TEAM);
    blueGrainsRef.current = placeGrains(grid, rows, cols - third, cols - 1, GRAINS_PER_TEAM);
  }, [vp]);

  useEffect(() => {
    const render = (time) => {
      const canvas = canvasRef.current;
      const maze = mazeLayerRef.current;
      if (canvas && maze) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#050510";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maze, 0, 0);

        const pulse = 0.75 + Math.sin(time * 0.003) * 0.25;

        ctx.shadowBlur = 10 * pulse;
        ctx.shadowColor = RED.hot;
        for (const g of redGrainsRef.current) {
          const cx = g.x * CELL + CELL / 2;
          const cy = g.y * CELL + CELL / 2;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, GRAIN_SIZE);
          grad.addColorStop(0,   "#ffffff");
          grad.addColorStop(0.4, RED.mid);
          grad.addColorStop(1,   RED.deep);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, GRAIN_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowColor = BLUE.hot;
        for (const g of blueGrainsRef.current) {
          const cx = g.x * CELL + CELL / 2;
          const cy = g.y * CELL + CELL / 2;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, GRAIN_SIZE);
          grad.addColorStop(0,   "#ffffff");
          grad.addColorStop(0.4, BLUE.mid);
          grad.addColorStop(1,   BLUE.deep);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, GRAIN_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const pad2 = (n) => String(n).padStart(2, "0");

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
          <span style={{ color: RED.mid, fontVariantNumeric: "tabular-nums", minWidth: 24, textAlign: "center" }}>
            {pad2(redScore)}
          </span>
          <span style={{ opacity: 0.45, margin: "0 4px" }}>vs</span>
          <span style={{ color: BLUE.mid, fontVariantNumeric: "tabular-nums", minWidth: 24, textAlign: "center" }}>
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
