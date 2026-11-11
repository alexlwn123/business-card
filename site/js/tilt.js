/**
 * Holographic 3D tilt. Follows the finger/mouse, the gyroscope once the
 * user grants motion access, and auto-orbits when nobody is touching it.
 */

const MAX_DEG = 16;
const IDLE_AFTER_MS = 1600;
const ORBIT_SPEED = 0.0011;
const GYRO_RANGE_DEG = 28;
const HOLDING_ANGLE_DEG = 45;

const clamp = (n) => Math.max(-1, Math.min(1, n));

export function createTilt(target, { animate = true } = {}) {
  let queued = null;
  let lastInput = 0;
  let motionEnabled = false;

  const apply = ({ nx, ny }) => {
    target.style.setProperty('--rx', `${(-ny * MAX_DEG).toFixed(2)}deg`);
    target.style.setProperty('--ry', `${(nx * MAX_DEG).toFixed(2)}deg`);
    target.style.setProperty('--mx', ((nx + 1) / 2).toFixed(3));
    target.style.setProperty('--my', ((ny + 1) / 2).toFixed(3));
  };

  const schedule = (next) => {
    const idle = queued === null;
    queued = next;
    if (idle) {
      requestAnimationFrame(() => {
        apply(queued);
        queued = null;
      });
    }
  };

  const fromInput = (next) => {
    lastInput = performance.now();
    schedule(next);
  };

  const onPointer = (event) => {
    const rect = target.getBoundingClientRect();
    fromInput({
      nx: clamp((event.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)),
      ny: clamp((event.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)),
    });
  };

  const onOrientation = ({ beta, gamma }) => {
    if (beta === null || gamma === null) return;
    fromInput({
      nx: clamp(gamma / GYRO_RANGE_DEG),
      ny: clamp((beta - HOLDING_ANGLE_DEG) / GYRO_RANGE_DEG),
    });
  };

  const orbit = (now) => {
    if (now - lastInput > IDLE_AFTER_MS) {
      const t = now * ORBIT_SPEED;
      apply({ nx: Math.sin(t) * 0.55, ny: Math.cos(t * 1.3) * 0.4 });
    }
    requestAnimationFrame(orbit);
  };

  window.addEventListener('pointermove', onPointer, { passive: true });
  if (animate) requestAnimationFrame(orbit);

  return {
    /** Must be called synchronously inside a user gesture (iOS requirement). */
    async enableMotion() {
      if (motionEnabled) return true;
      const Orientation = window.DeviceOrientationEvent;
      if (!Orientation) return false;
      if (typeof Orientation.requestPermission === 'function') {
        try {
          const state = await Orientation.requestPermission();
          if (state !== 'granted') return false;
        } catch (error) {
          reportError(error);
          return false;
        }
      }
      window.addEventListener('deviceorientation', onOrientation);
      motionEnabled = true;
      return true;
    },
  };
}
