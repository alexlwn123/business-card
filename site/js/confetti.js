/**
 * Canvas confetti + emoji particle cannon. The loop only runs while
 * there are live particles, so it costs nothing when idle.
 *
 * Emojis are rasterised once into sprites and stamped with drawImage:
 * calling fillText on colour emoji every frame is what made rapid taps lag.
 */

const DPR_CAP = 2;
const GRAVITY = 0.32;
const DRAG = 0.985;
const MAX_PARTICLES = 650;
const FADE_PORTION = 0.3;
const EMOJI_MAX_PX = 34;
const SPRITE_PADDING = 1.3; // room for glyphs that overhang their em box

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);

function makeParticle(x, y, { angle, spread, power, colors, emojis, gravity, ttl }) {
  const theta = angle + between(-spread / 2, spread / 2);
  const velocity = power * between(0.45, 1);
  const isEmoji = emojis.length > 0 && Math.random() < 0.35;
  return {
    x,
    y,
    vx: Math.cos(theta) * velocity,
    vy: Math.sin(theta) * velocity,
    rot: between(0, Math.PI * 2),
    vr: between(-0.3, 0.3),
    size: isEmoji ? between(18, EMOJI_MAX_PX) : between(6, 13),
    color: pick(colors),
    emoji: isEmoji ? pick(emojis) : null,
    gravity,
    age: 0,
    ttl: ttl * between(0.7, 1.2),
  };
}

function step(p) {
  return {
    ...p,
    x: p.x + p.vx,
    y: p.y + p.vy,
    vx: p.vx * DRAG,
    vy: p.vy * DRAG + p.gravity,
    rot: p.rot + p.vr,
    age: p.age + 1,
  };
}

function opacity(p) {
  const fadeStart = p.ttl * (1 - FADE_PORTION);
  return p.age < fadeStart ? 1 : Math.max(0, 1 - (p.age - fadeStart) / (p.ttl - fadeStart));
}

/** One setTransform per particle instead of save/translate/rotate/scale/restore. */
export function setParticleTransform(ctx, p, dpr, squash = 1) {
  const cos = Math.cos(p.rot) * dpr;
  const sin = Math.sin(p.rot) * dpr;
  ctx.setTransform(cos, sin, -sin * squash, cos * squash, p.x * dpr, p.y * dpr);
}

export function createSpriteCache(render) {
  const sprites = new Map();
  return {
    get(emoji) {
      if (!sprites.has(emoji)) sprites.set(emoji, render(emoji));
      return sprites.get(emoji);
    },
  };
}

function renderEmojiSprite(emoji, scale) {
  const fontPx = Math.ceil(EMOJI_MAX_PX * scale);
  const side = Math.ceil(fontPx * SPRITE_PADDING);
  const image = document.createElement('canvas');
  image.width = side;
  image.height = side;
  const ctx = image.getContext('2d');
  ctx.font = `${fontPx}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, side / 2, side / 2);
  return { image, ratio: side / fontPx };
}

export function drawParticle(ctx, p, { dpr, sprites }) {
  ctx.globalAlpha = opacity(p);
  if (p.emoji) {
    setParticleTransform(ctx, p, dpr);
    const { image, ratio } = sprites.get(p.emoji);
    const side = p.size * ratio;
    ctx.drawImage(image, -side / 2, -side / 2, side, side);
  } else {
    setParticleTransform(ctx, p, dpr, Math.cos(p.rot * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  }
}

export function createConfetti(canvas, { colors }) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let running = false;
  let view = { w: 0, h: 0, dpr: 1 };
  const sprites = createSpriteCache((emoji) => renderEmojiSprite(emoji, view.dpr));

  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    view = { w: window.innerWidth, h: window.innerHeight, dpr };
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
  };

  const frame = () => {
    particles = particles.map(step).filter((p) => p.age < p.ttl && p.y < view.h + 60);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawing = { dpr: view.dpr, sprites };
    particles.forEach((p) => drawParticle(ctx, p, drawing));
    running = particles.length > 0;
    if (running) requestAnimationFrame(frame);
  };

  const emit = (x, y, options) => {
    const config = {
      angle: -Math.PI / 2,
      spread: Math.PI * 2,
      power: 14,
      count: 80,
      emojis: [],
      gravity: GRAVITY,
      ttl: 140,
      colors,
      ...options,
    };
    const fresh = Array.from({ length: config.count }, () => makeParticle(x, y, config));
    particles = [...particles, ...fresh].slice(-MAX_PARTICLES);
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  };

  fit();
  window.addEventListener('resize', fit);

  return {
    burst: (x, y, options = {}) => emit(x, y, options),
    cannon(side, options = {}) {
      const fromLeft = side === 'left';
      emit(fromLeft ? 0 : view.w, view.h, {
        angle: fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3,
        spread: Math.PI / 5,
        power: Math.max(22, view.h / 26),
        count: 140,
        ttl: 200,
        ...options,
      });
    },
    sparkle: (x, y) =>
      emit(x, y, { count: 3, power: 3, gravity: 0.05, ttl: 45, emojis: ['✨', '⭐'] }),
  };
}
