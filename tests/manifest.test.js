import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest } from '../wallet/manifest.js';

test('maps each file name to the SHA-1 hex digest of its bytes', () => {
  const manifest = buildManifest({
    'pass.json': Buffer.from('{}'),
    'icon.png': Buffer.from('abc'),
  });
  assert.deepEqual(manifest, {
    'icon.png': 'a9993e364706816aba3e25717850c26c9cd0d89d',
    'pass.json': 'bf21a9e8fbc5a3846fb05b4fa0859e0917b2202f',
  });
});

test('refuses to hash manifest.json or signature into the manifest', () => {
  assert.throws(() => buildManifest({ 'manifest.json': Buffer.from('x') }), /manifest\.json/);
  assert.throws(() => buildManifest({ signature: Buffer.from('x') }), /signature/);
});

test('requires pass.json and icon.png', () => {
  assert.throws(() => buildManifest({ 'icon.png': Buffer.from('x') }), /pass\.json/);
  assert.throws(() => buildManifest({ 'pass.json': Buffer.from('x') }), /icon\.png/);
});
