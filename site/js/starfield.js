/**
 * Hyperspace starfield background. Speed can be cranked for "warp" moments.
 */

const DPR_CAP = 2;
const TRAIL_FADE = 'rgba(7, 0, 15, 0.32)';
const EASE = 0.06;

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  return { w, h, dpr };
}

function spawnStar({ w, h }, colors, z = Math.random() * w) {
  return {
    x: (Math.random() - 0.5) * w * 2,
    y: (Math.random() - 0.5) * h * 2,
    z,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

function project(star, z, { w, h }) {
  const focal = w * 0.6;
  return { x: w / 2 + (star.x / z) * focal, y: h / 2 + (star.y / z) * focal };
}

function advance(star, speed, size, colors) {
  const z = star.z - speed;
  return z <= 1 ? spawnStar(size, colors, size.w) : { ...star, z };
}

function drawStar(ctx, star, speed, size) {
  const head = project(star, star.z, size);
  const tail = project(star, star.z + speed * 2.2, size);
  const depth = 1 - star.z / size.w;
  ctx.strokeStyle = star.color;
  ctx.lineWidth = Math.max(0.6, depth * 3.2);
  ctx.globalAlpha = Math.min(1, 0.25 + depth);
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
}

export function createStarfield(canvas, { colors, count = 240, animate = true }) {
  const ctx = canvas.getContext('2d');
  let size = fitCanvas(canvas);
  let stars = Array.from({ length: count }, () => spawnStar(size, colors));
  let speed = 2;
  let targetSpeed = 2;

  const paint = () => {
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = TRAIL_FADE;
    ctx.fillRect(0, 0, size.w, size.h);
    stars.forEach((star) => drawStar(ctx, star, Math.max(speed, 1), size));
  };

  const frame = () => {
    speed += (targetSpeed - speed) * EASE;
    stars = stars.map((star) => advance(star, speed, size, colors));
    paint();
    requestAnimationFrame(frame);
  };

  window.addEventListener('resize', () => {
    size = fitCanvas(canvas);
    if (!animate) paint();
  });

  if (animate) requestAnimationFrame(frame);
  else paint();

  return {
    setSpeed(next) {
      targetSpeed = next;
    },
  };
}
