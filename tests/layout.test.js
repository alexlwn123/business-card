import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutProblems } from '../wallet/layout.js';

const AREA = Object.freeze({ left: 12, top: 10.5, right: 363, bottom: 133.5 });
const line = (name, left, top, right, bottom) => ({ name, left, top, right, bottom });

test('lines inside the visible area and clear of each other pass', () => {
  const lines = [
    line('topLeft', 20, 14, 160, 23),
    line('firm', 45, 30, 330, 51),
    line('bottomLeft', 20, 120, 140, 129),
    line('bottomRight', 250, 120, 355, 129),
  ];
  assert.deepEqual(layoutProblems(lines, AREA), []);
});

test('lines that spill outside the visible area are reported by name', () => {
  const problems = layoutProblems([line('topLeft', 8, 14, 160, 23), line('bottomRight', 250, 125, 355, 136)], AREA);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /topLeft/);
  assert.match(problems[1], /bottomRight/);
});

test('colliding lines are reported once per pair; lines that only touch are fine', () => {
  const lines = [line('firm', 45, 30, 330, 51), line('name', 100, 50, 280, 65), line('title', 60, 65, 320, 74)];
  assert.deepEqual(layoutProblems(lines, AREA), ['firm overlaps name']);
});

test('the watermark may sit behind the lettering but must stay inside the visible area', () => {
  const lines = [line('firm', 45, 30, 330, 51)];
  assert.deepEqual(layoutProblems(lines, AREA, { backdrop: [line('watermark', 130, 16, 245, 128)] }), []);
  assert.deepEqual(layoutProblems(lines, AREA, { backdrop: [line('watermark', 130, 12, 245, 137)] }), [
    'watermark spills outside the visible strip',
  ]);
});
