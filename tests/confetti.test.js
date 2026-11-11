import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpriteCache, drawParticle, setParticleTransform } from '../site/js/confetti.js';

const EPSILON = 1e-9;
const assertClose = (actual, expected) =>
  expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) < EPSILON, `[${i}] ${actual[i]} != ${value}`));

function fakeContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  return {
    calls,
    ctx: {
      setTransform: record('setTransform'),
      drawImage: record('drawImage'),
      fillRect: record('fillRect'),
      fillText: record('fillText'),
    },
  };
}

const particle = (overrides) => ({ x: 10, y: 20, rot: 0, size: 20, color: '#f0f', emoji: null, age: 0, ttl: 100, ...overrides });

test('setParticleTransform places an unrotated particle at its position, scaled for the screen', () => {
  const { ctx, calls } = fakeContext();
  setParticleTransform(ctx, particle({}), 2);
  assertClose(calls[0].args, [2, 0, 0, 2, 20, 40]);
});

test('setParticleTransform equals translate, then rotate, then squash', () => {
  const { ctx, calls } = fakeContext();
  setParticleTransform(ctx, particle({ x: 5, y: 7, rot: Math.PI / 2 }), 1, 0.5);
  assertClose(calls[0].args, [0, 1, -0.5, 0, 5, 7]);
});

test('emoji sprites are rendered once and then reused', () => {
  const rendered = [];
  const sprites = createSpriteCache((emoji) => {
    rendered.push(emoji);
    return { image: emoji, ratio: 1 };
  });
  const first = sprites.get('🔥');
  assert.equal(sprites.get('🔥'), first);
  sprites.get('✨');
  assert.deepEqual(rendered, ['🔥', '✨']);
});

test('emoji particles are stamped from the sprite cache, never re-rasterised with fillText', () => {
  const { ctx, calls } = fakeContext();
  const sprites = createSpriteCache((emoji) => ({ image: `sprite:${emoji}`, ratio: 1.5 }));
  drawParticle(ctx, particle({ emoji: '🦄', size: 20 }), { dpr: 2, sprites });
  const names = calls.map((call) => call.name);
  assert.deepEqual(names, ['setTransform', 'drawImage']);
  assert.deepEqual(calls[1].args, ['sprite:🦄', -15, -15, 30, 30]);
});

test('confetti strips are filled rectangles in their colour', () => {
  const { ctx, calls } = fakeContext();
  drawParticle(ctx, particle({ size: 12 }), { dpr: 1, sprites: createSpriteCache(() => null) });
  assert.deepEqual(calls.at(-1), { name: 'fillRect', args: [-6, -3, 12, 6] });
  assert.equal(ctx.fillStyle, '#f0f');
});

test('particles fade out over the last part of their life', () => {
  const { ctx } = fakeContext();
  const sprites = createSpriteCache(() => null);
  drawParticle(ctx, particle({ age: 10, ttl: 100 }), { dpr: 1, sprites });
  assert.equal(ctx.globalAlpha, 1);
  drawParticle(ctx, particle({ age: 85, ttl: 100 }), { dpr: 1, sprites });
  assert.ok(Math.abs(ctx.globalAlpha - 0.5) < EPSILON);
});
