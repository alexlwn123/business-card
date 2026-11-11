import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVCard, escapeText } from '../site/js/vcard.js';

const contact = Object.freeze({
  firstName: 'Alex',
  lastName: 'Lewin',
  location: 'Atlanta, GA',
  email: 'alex@example.com',
  twitterHandle: 'ALewin',
  signalUrl: 'https://signal.me/#eu/abc123',
  website: 'https://example.com',
  company: 'Finite Computer',
  title: 'Minister of Development',
});

const vip = Object.freeze({ ...contact, phone: '+1 (404) 555-0123', personalEmail: 'me@example.com' });

const linesOf = (card) => card.split('\r\n');

test('escapeText escapes backslashes, commas, semicolons and newlines', () => {
  assert.equal(escapeText('a,b;c\\d\ne\r\nf'), 'a\\,b\\;c\\\\d\\ne\\nf');
  assert.equal(escapeText('lone\rreturn'), 'lone\\nreturn');
});

test('buildVCard is a CRLF-terminated vCard 3.0 envelope', () => {
  const card = buildVCard(contact);
  const lines = linesOf(card);

  assert.ok(card.endsWith('\r\n'));
  assert.equal(lines[0], 'BEGIN:VCARD');
  assert.equal(lines[1], 'VERSION:3.0');
  assert.equal(lines.at(-2), 'END:VCARD');
  assert.ok(!card.replaceAll('\r\n', '').includes('\n'), 'no bare LF line endings');
});

test('buildVCard includes name, work email, website, X profile and a labelled Signal URL', () => {
  const lines = linesOf(buildVCard(contact));

  assert.ok(lines.includes('N:Lewin;Alex;;;'));
  assert.ok(lines.includes('FN:Alex Lewin'));
  assert.ok(lines.includes('EMAIL;TYPE=INTERNET;TYPE=WORK:alex@example.com'));
  assert.ok(lines.includes('URL;TYPE=HOME:https://example.com'));
  assert.ok(lines.includes('X-SOCIALPROFILE;TYPE=twitter;X-USER=ALewin:https://x.com/ALewin'));
  assert.ok(lines.includes('item1.URL:https://signal.me/#eu/abc123'));
  assert.ok(lines.includes('item1.X-ABLabel:Signal'));
});

test('the VIP vCard adds a mobile number and a personal email', () => {
  const lines = linesOf(buildVCard(vip));

  assert.ok(lines.includes('TEL;TYPE=CELL;TYPE=VOICE:+14045550123'));
  assert.ok(lines.includes('EMAIL;TYPE=INTERNET;TYPE=HOME:me@example.com'));
});

test('the public vCard leaves out Signal, phone and personal email entirely', () => {
  const { signalUrl, ...publicContact } = contact;
  const card = buildVCard(publicContact);

  ['item1', 'TEL', 'EMAIL;TYPE=INTERNET;TYPE=HOME', 'undefined'].forEach((text) => assert.ok(!card.includes(text), text));
  assert.ok(card.includes('URL;TYPE=HOME:'), 'website stays');
});

test('buildVCard escapes the location', () => {
  const lines = linesOf(buildVCard(contact));
  assert.ok(lines.includes('ADR;TYPE=HOME:;;;Atlanta\\, GA;;;'));
});

test('buildVCard lists the company as the organisation, escaped', () => {
  assert.ok(linesOf(buildVCard(contact)).includes('ORG:Finite Computer'));
  assert.ok(linesOf(buildVCard({ ...contact, company: 'Acme, Inc; Ltd' })).includes('ORG:Acme\\, Inc\\; Ltd'));
});

test('buildVCard omits the organisation and title when they are not set', () => {
  const { company, title, ...personal } = contact;
  const card = buildVCard(personal);
  assert.ok(!card.includes('ORG:'));
  assert.ok(!card.includes('TITLE:'));
});

test('buildVCard lists the job title, escaped', () => {
  assert.ok(linesOf(buildVCard(contact)).includes('TITLE:Minister of Development'));
  assert.ok(linesOf(buildVCard({ ...contact, title: 'VP, Vibes' })).includes('TITLE:VP\\, Vibes'));
});

test('buildVCard carries no note', () => {
  assert.ok(!buildVCard(contact).includes('NOTE'));
});

test('buildVCard rejects URI values that could inject extra vCard lines', () => {
  const evil = { ...contact, website: 'https://example.com\r\nEMAIL:evil@example.com' };
  assert.throws(() => buildVCard(evil), /line break/);
});

test('buildVCard rejects a twitter handle with characters outside [A-Za-z0-9_]', () => {
  assert.throws(() => buildVCard({ ...contact, twitterHandle: 'x;evil' }), /handle/);
});

test('buildVCard does not mutate its input', () => {
  const input = { ...contact };
  const snapshot = structuredClone(input);
  buildVCard(input);
  assert.deepEqual(input, snapshot);
});
