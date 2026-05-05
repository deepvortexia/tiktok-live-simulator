// Smooth canvas creature rendering — arcs, bezier curves, radial gradients only.
// Teams: 'red' (warm) and 'blue' (cool). States: idle, carrying, dying, dancing, victory.

const TEAM_PALETTE = {
  red: {
    core:    '#fff1e0',
    mid:     '#ff6b9d',
    outer:   '#c21858',
    glow:    '#ff4d6d',
    antenna: '#ffb4a2',
    mouth:   'rgba(60,5,20,0.7)',
  },
  blue: {
    core:    '#e6f7ff',
    mid:     '#6bc6ff',
    outer:   '#2546a8',
    glow:    '#4dc4ff',
    antenna: '#a2d7ff',
    mouth:   'rgba(5,20,60,0.7)',
  },
};

export const CREATURE_TEAMS = ['red', 'blue'];
export const CREATURE_STATES = ['idle', 'carrying', 'dying', 'dancing', 'victory'];

export function createCreature({ x = 0, y = 0, team = 'red', size = 28, state = 'idle' } = {}) {
  return {
    x, y,
    team,
    size: Math.max(20, size),
    state,
    stateStart: 0,
    particles: null,
    seed: Math.random() * 1000,
  };
}

export function setCreatureState(creature, state, time) {
  creature.state = state;
  creature.stateStart = time;
  creature.particles = state === 'dying' ? initDeathParticles(creature) : null;
}

export function drawCreature(ctx, creature, time) {
  const state = creature.state || 'idle';

  if (state === 'dying') {
    drawDeathParticles(ctx, creature, time);
    return;
  }

  const palette = state === 'victory'
    ? rainbowPalette(time)
    : (TEAM_PALETTE[creature.team] || TEAM_PALETTE.red);

  const t = (time - (creature.stateStart || 0)) + creature.seed;
  const transform = stateTransform(state, t);

  ctx.save();
  ctx.translate(creature.x, creature.y + transform.bounce);
  ctx.rotate(transform.rotation);
  ctx.scale(transform.scale, transform.scale);

  const size = creature.size;

  drawAppendage(ctx, creature.team, palette, size, t);
  drawBody(ctx, palette, size, t, state);
  drawEyes(ctx, size, t, state);
  drawMouth(ctx, palette, size, state);

  ctx.restore();

  if (state === 'carrying') {
    drawCarriedOrb(ctx, creature, time, palette);
  }
}

function stateTransform(state, t) {
  switch (state) {
    case 'dancing': {
      const p = t * 0.008;
      return {
        bounce:   Math.sin(p * 2) * 5,
        rotation: Math.sin(p) * 0.4,
        scale:    1 + Math.sin(p * 3) * 0.1,
      };
    }
    case 'victory': {
      const p = t * 0.005;
      return {
        bounce:   Math.sin(p * 2) * 2.5,
        rotation: 0,
        scale:    1 + Math.sin(p * 2) * 0.07,
      };
    }
    case 'carrying':
      return { bounce: Math.sin(t * 0.004) * 1.5, rotation: 0, scale: 1 };
    default:
      return { bounce: Math.sin(t * 0.003) * 1, rotation: 0, scale: 1 };
  }
}

function drawBody(ctx, palette, size, t, state) {
  const r = size / 2;
  const breathe = Math.sin(t * 0.003) * 0.5;

  ctx.shadowBlur = state === 'victory' ? 30 : 16;
  ctx.shadowColor = palette.glow;

  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 0, 0, 0, r * 1.15);
  grad.addColorStop(0,    palette.core);
  grad.addColorStop(0.5,  palette.mid);
  grad.addColorStop(1,    palette.outer);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, -r + breathe);
  ctx.bezierCurveTo( r * 1.15, -r + breathe,  r * 1.15, r,  0, r);
  ctx.bezierCurveTo(-r * 1.15,  r,           -r * 1.15, -r + breathe,  0, -r + breathe);
  ctx.fill();

  ctx.shadowBlur = 0;

  const hg = ctx.createRadialGradient(-r * 0.35, -r * 0.5, 0, -r * 0.35, -r * 0.5, r * 0.6);
  hg.addColorStop(0, 'rgba(255,255,255,0.55)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.45, r * 0.45, r * 0.3, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyes(ctx, size, t, state) {
  const r = size / 2;
  const eyeY  = -r * 0.05;
  const eyeDX = r * 0.32;
  const eyeR  = r * 0.23;

  const blinkPhase = Math.sin(t * 0.0018 + 1.3);
  const blink = blinkPhase > 0.97 ? 0.12 : 1;
  const excited = (state === 'dancing' || state === 'victory') ? 1.15 : 1;

  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -eyeDX : eyeDX;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, eyeY, eyeR * excited, eyeR * blink * excited, 0, 0, Math.PI * 2);
    ctx.fill();

    const lookX = Math.sin(t * 0.001 + i) * eyeR * 0.15;
    const lookY = Math.cos(t * 0.0012 + i) * eyeR * 0.1;

    ctx.fillStyle = '#140818';
    ctx.beginPath();
    ctx.arc(x + lookX, eyeY + lookY, eyeR * 0.55 * blink, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x + lookX - eyeR * 0.18, eyeY + lookY - eyeR * 0.22, eyeR * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(x + lookX + eyeR * 0.15, eyeY + lookY + eyeR * 0.2, eyeR * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMouth(ctx, palette, size, state) {
  const r = size / 2;
  ctx.strokeStyle = palette.mouth;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.lineCap = 'round';

  ctx.beginPath();
  if (state === 'dancing' || state === 'victory') {
    ctx.arc(0, r * 0.22, r * 0.3, 0.15, Math.PI - 0.15);
  } else {
    ctx.moveTo(-r * 0.22, r * 0.32);
    ctx.quadraticCurveTo(0, r * 0.5, r * 0.22, r * 0.32);
  }
  ctx.stroke();
}

function drawAppendage(ctx, team, palette, size, t) {
  const r = size / 2;

  if (team === 'red') {
    const sway = Math.sin(t * 0.004) * 3;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = palette.outer;
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(side * r * 0.25, -r * 0.85);
      ctx.quadraticCurveTo(
        side * r * 0.55 + sway * side, -r * 1.35,
        side * r * 0.7  + sway * side, -r * 1.65
      );
      ctx.stroke();

      ctx.shadowBlur = 10;
      ctx.shadowColor = palette.glow;
      const bx = side * r * 0.7 + sway * side;
      const by = -r * 1.65;
      const br = r * 0.17;
      const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br);
      bg.addColorStop(0, palette.core);
      bg.addColorStop(1, palette.mid);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  } else {
    for (const side of [-1, 1]) {
      const ex = side * r * 0.55;
      const ey = -r * 0.85;
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.55);
      eg.addColorStop(0, palette.mid);
      eg.addColorStop(1, palette.outer);
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.2, -r * 0.7);
      ctx.bezierCurveTo(
        side * r * 0.95, -r * 1.35,
        side * r * 0.85, -r * 0.35,
        side * r * 0.2,  -r * 0.7
      );
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(side * r * 0.5, -r * 0.9, r * 0.12, r * 0.25, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCarriedOrb(ctx, creature, time, palette) {
  const r = creature.size / 2;
  const orbR = r * 0.4;
  const lift = Math.sin(time * 0.005 + creature.seed) * 2;
  const ox = creature.x;
  const oy = creature.y - r * 2 - orbR - lift;
  const pulse = 0.85 + Math.sin(time * 0.008) * 0.15;

  ctx.shadowBlur = 22 * pulse;
  ctx.shadowColor = palette.glow;

  const g = ctx.createRadialGradient(ox - orbR * 0.3, oy - orbR * 0.3, 0, ox, oy, orbR);
  g.addColorStop(0,   '#ffffff');
  g.addColorStop(0.4, palette.core);
  g.addColorStop(1,   palette.mid);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ox, oy, orbR, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(ox - orbR * 0.35, oy - orbR * 0.4, orbR * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

const DEATH_DURATION = 900;

function initDeathParticles(creature) {
  const count = 16;
  const size = creature.size;
  const arr = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 0.8 + Math.random() * 1.6;
    arr.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.4,
      r:  size * 0.09 + Math.random() * size * 0.07,
    });
  }
  return arr;
}

function drawDeathParticles(ctx, creature, time) {
  if (!creature.particles) creature.particles = initDeathParticles(creature);

  const palette = TEAM_PALETTE[creature.team] || TEAM_PALETTE.red;
  const elapsed = time - (creature.stateStart || time);
  const life = Math.min(1, elapsed / DEATH_DURATION);
  if (life >= 1) return;

  const alpha = 1 - life;
  ctx.save();
  for (const p of creature.particles) {
    const dx = creature.x + p.vx * elapsed * 0.05;
    const dy = creature.y + p.vy * elapsed * 0.05 + elapsed * elapsed * 0.00008;
    const rad = Math.max(0.5, p.r * (1 - life * 0.6));

    ctx.shadowBlur = 12 * alpha;
    ctx.shadowColor = palette.glow;
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, rad);
    g.addColorStop(0, palette.core);
    g.addColorStop(1, palette.outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(dx, dy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function isDeathFinished(creature, time) {
  if (creature.state !== 'dying') return false;
  return time - (creature.stateStart || 0) >= DEATH_DURATION;
}

function rainbowPalette(time) {
  const hue = (time * 0.25) % 360;
  return {
    core:    `hsl(${hue}, 100%, 92%)`,
    mid:     `hsl(${hue}, 90%, 65%)`,
    outer:   `hsl(${(hue + 40) % 360}, 80%, 40%)`,
    glow:    `hsl(${hue}, 100%, 60%)`,
    antenna: `hsl(${hue}, 80%, 70%)`,
    mouth:   'rgba(30,5,40,0.7)',
  };
}
