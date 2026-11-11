import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../wallet/html.js';
import { ART_FONTS, ART_SIZES, FONTS, STRIP_SAFE_AREA, iconHtml, logoHtml, stripHtml } from '../wallet/art.js';
import { PASS_COLORS, PASS_COPY } from '../wallet/config.js';

test('escapeHtml neutralises markup characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

// Nothing on the strip drops back to the old 6px lettering; the corners are the smallest at 7px.
const READABLE_PX = 7;
const LINES = Object.freeze(['firm', 'name', 'title', 'topLeft', 'bottomLeft', 'bottomRight']);

const fontSizes = (html) =>
  [...html.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selector]) => !selector.includes('.mark'))
    .flatMap(([, selector, body]) =>
      [...body.matchAll(/font-size:([\d.]+)px/g)].map(([, px]) => ({ selector: selector.trim(), px: Number(px) })),
    );

test('every line of lettering on the strip is large enough to read (the watermark aside)', () => {
  const sizes = fontSizes(stripHtml({ copy: PASS_COPY, colors: PASS_COLORS }));
  assert.ok(sizes.length >= 4, 'expected font sizes for the firm, name, sub-lines and corners');
  sizes.forEach(({ selector, px }) => assert.ok(px >= READABLE_PX, `${selector} is ${px}px, below ${READABLE_PX}px`));
});

test('the firm, name and corner lines are set at the agreed sizes', () => {
  const sizes = fontSizes(stripHtml({ copy: PASS_COPY, colors: PASS_COLORS }));
  const sizeOf = (selector) => sizes.find((entry) => entry.selector === selector)?.px;
  assert.equal(sizeOf('.firm'), 19);
  assert.equal(sizeOf('.name'), 15);
  assert.equal(sizeOf('.corners'), 7);
});

test('each line and the watermark are tagged so the renderer can check they fit', () => {
  const html = stripHtml({ copy: PASS_COPY, colors: PASS_COLORS });
  const tagged = [...html.matchAll(/data-line="(\w+)"/g)].map(([, name]) => name);
  assert.deepEqual(tagged.sort(), [...LINES].sort());
  assert.match(html, new RegExp(`<span data-mark>${escapeHtml(PASS_COPY.monogram)}</span>`));
});

test('the safe area is the middle 123pt band that every Wallet layout shows', () => {
  const { width, height } = ART_SIZES.strip;
  assert.equal(STRIP_SAFE_AREA.bottom - STRIP_SAFE_AREA.top, 123);
  assert.equal(STRIP_SAFE_AREA.top, height - STRIP_SAFE_AREA.bottom);
  assert.equal(STRIP_SAFE_AREA.left, width - STRIP_SAFE_AREA.right);
});

test('strip is the 375x144pt store-card size and contains every line of the card', () => {
  const html = stripHtml({ copy: PASS_COPY, colors: PASS_COLORS });
  assert.deepEqual(ART_SIZES.strip, { width: 375, height: 144 });
  LINES.forEach((key) =>
    assert.ok(html.includes(escapeHtml(PASS_COPY[key])), `strip is missing ${key}`),
  );
});

test('copy is escaped before it reaches the art templates', () => {
  const html = stripHtml({ copy: { ...PASS_COPY, firm: '<script>x</script>' }, colors: PASS_COLORS });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('logo and icon render the monogram', () => {
  const textOf = (html) => html.replace(/<[^>]+>/g, '');
  [logoHtml, iconHtml].forEach((template) =>
    assert.ok(textOf(template({ copy: PASS_COPY, colors: PASS_COLORS })).includes(escapeHtml(PASS_COPY.monogram))),
  );
});

test('watermark, logo and icon set a single blackletter F', () => {
  assert.equal(PASS_COPY.monogram, 'F');
  [stripHtml, logoHtml, iconHtml].forEach((template) =>
    assert.match(template({ copy: PASS_COPY, colors: PASS_COLORS }), new RegExp(`font-family:'${FONTS.mark}'`)),
  );
});

test('each template declares the fonts it needs so the renderer can wait for them', () => {
  assert.deepEqual(ART_FONTS.strip, [FONTS.text, FONTS.mark]);
  assert.deepEqual(ART_FONTS.logo, [FONTS.mark]);
  assert.deepEqual(ART_FONTS.icon, [FONTS.mark]);
});

test('strip carries the Finite Computer copy without a division line', () => {
  const html = stripHtml({ copy: PASS_COPY, colors: PASS_COLORS });
  ['Finite Computer', 'Minister of Development', 'alex@finite.computer', 'alex.lwn.lol'].forEach((text) => assert.ok(html.includes(text), text));
  assert.ok(!html.includes('Software and Trainings'));
  assert.equal(PASS_COPY.division, undefined);
});
