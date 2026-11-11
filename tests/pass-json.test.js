import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPassJson } from '../wallet/pass-json.js';
import * as PASS from '../wallet/config.js';
import { CONTACT } from '../site/js/config.js';

const SCAN_URL = 'https://qr.lwn.lol/#vip=AbCdEfGhIjKlMnOpQrSt_-';
const identity = Object.freeze({ passTypeIdentifier: 'pass.lol.lwn.card', teamIdentifier: 'ABCDE12345' });
const build = (overrides = {}) =>
  buildPassJson({
    contact: CONTACT,
    copy: PASS.PASS_COPY,
    colors: PASS.PASS_COLORS,
    meta: PASS.PASS_META,
    note: PASS.PASS_NOTE,
    cardUrl: PASS.CARD_URL,
    scanUrl: SCAN_URL,
    ...identity,
    ...overrides,
  });

const backField = (pass, key) => pass.storeCard.backFields.find((field) => field.key === key);

test('produces a formatVersion 1 store card with the signing identity', () => {
  const pass = build();
  assert.equal(pass.formatVersion, 1);
  assert.equal(pass.passTypeIdentifier, 'pass.lol.lwn.card');
  assert.equal(pass.teamIdentifier, 'ABCDE12345');
  assert.ok(pass.serialNumber && pass.organizationName && pass.description);
  assert.ok(pass.storeCard);
});

test('uses Wallet rgb() colour syntax for every colour', () => {
  const pass = build();
  [pass.backgroundColor, pass.foregroundColor, pass.labelColor].forEach((colour) =>
    assert.match(colour, /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/),
  );
});

test('the QR carries the VIP unlock URL with no visible alt text', () => {
  const [barcode] = build().barcodes;
  assert.equal(barcode.format, 'PKBarcodeFormatQR');
  assert.equal(barcode.message, SCAN_URL);
  assert.equal(barcode.messageEncoding, 'iso-8859-1');
  assert.equal(barcode.altText, undefined);
});

test('the front is just the card art and the QR: no text fields', () => {
  const card = build().storeCard;
  ['headerFields', 'primaryFields', 'secondaryFields', 'auxiliaryFields'].forEach((slot) =>
    assert.equal(card[slot], undefined, `${slot} should be absent`),
  );
});

test('is issued by Finite Computer to its Minister of Development', () => {
  const pass = build();
  assert.equal(pass.organizationName, 'Finite Computer');
  assert.equal(pass.description, 'Alex Lewin, Minister of Development, Finite Computer');
  assert.equal(backField(pass, 'title').value, 'Minister of Development, Finite Computer');
});

test('back fields carry tappable links for every contact channel', () => {
  const pass = build();
  assert.match(backField(pass, 'email').attributedValue, /^<a href="mailto:alex@finite\.computer">/);
  assert.equal(backField(pass, 'x').attributedValue, '<a href="https://x.com/ALewin">@ALewin</a>');
  assert.equal(backField(pass, 'web').attributedValue, '<a href="https://alex.lwn.lol">alex.lwn.lol</a>');
  assert.equal(backField(pass, 'note').value, PASS.PASS_NOTE);
});

test('the back links the public card, never the VIP unlock URL', () => {
  const pass = build();
  assert.equal(backField(pass, 'card').attributedValue, '<a href="https://qr.lwn.lol">qr.lwn.lol</a>');
  assert.ok(!JSON.stringify(pass.storeCard).includes('#vip='));
});

test('Signal only appears on the back when the contact has a Signal link', () => {
  assert.equal(backField(build(), 'signal'), undefined);
  const withSignal = build({ contact: { ...CONTACT, signalUrl: 'https://signal.me/#eu/abc' } });
  assert.match(backField(withSignal, 'signal').attributedValue, /^<a href="https:\/\/signal\.me\/#eu\/abc">/);
});

test('the pass cannot be shared from Wallet, since its QR is the VIP key', () => {
  assert.equal(build().sharingProhibited, true);
});

test('refuses to build a pass without an https scan URL', () => {
  assert.throws(() => build({ scanUrl: undefined }), /scan URL/);
  assert.throws(() => build({ scanUrl: 'http://qr.lwn.lol' }), /scan URL/);
});

test('escapes HTML inside attributed back-field values', () => {
  const pass = build({ contact: { ...CONTACT, email: 'a"<b>@example.com' } });
  assert.ok(backField(pass, 'email').attributedValue.includes('a&quot;&lt;b&gt;@example.com'));
});

test('rejects malformed pass type and team identifiers', () => {
  assert.throws(() => build({ passTypeIdentifier: 'com.not.a.pass' }), /pass type identifier/i);
  assert.throws(() => build({ teamIdentifier: 'short' }), /team identifier/i);
});

test('every field key is unique (Wallet rejects duplicates)', () => {
  const keys = build().storeCard.backFields.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length);
});
