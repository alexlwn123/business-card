import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeHref, availableLinks, buildLinks } from '../site/js/links.js';
import { CONTACT, EMAIL_SUBJECT, LINKS, VIP_LINKS } from '../site/js/config.js';

const contact = Object.freeze({
  firstName: 'Alex',
  lastName: 'Lewin',
  location: 'Atlanta, GA',
  email: 'alex@example.com',
  twitterHandle: 'ALewin',
  signalUrl: 'https://signal.me/#eu/abc123',
  website: 'https://example.com',
  phone: '+1 (404) 555-0123',
  personalEmail: 'me@example.com',
});

const links = Object.freeze([
  { id: 'signal', emoji: 'S', label: 'SIGNAL', sub: 's' },
  { id: 'x', emoji: 'X', label: 'X', sub: 'x' },
  { id: 'email', emoji: 'E', label: 'EMAIL', sub: 'e' },
  { id: 'site', emoji: 'W', label: 'SITE', sub: 'w' },
  { id: 'personal', emoji: 'H', label: 'HOME', sub: 'h' },
]);

const hrefOf = (built, id) => built.find((link) => link.id === id).href;

test('buildLinks keeps the presentation fields and adds an href per link', () => {
  const built = buildLinks(contact, links, 'hello');

  assert.equal(built.length, links.length);
  built.forEach((link, i) => {
    assert.equal(link.label, links[i].label);
    assert.equal(typeof link.href, 'string');
  });
});

test('buildLinks maps each link id to the right destination', () => {
  const built = buildLinks(contact, links, 'hello there & hi');

  assert.equal(hrefOf(built, 'signal'), 'https://signal.me/#eu/abc123');
  assert.equal(hrefOf(built, 'x'), 'https://x.com/ALewin');
  assert.equal(hrefOf(built, 'email'), 'mailto:alex@example.com?subject=hello%20there%20%26%20hi');
  assert.equal(hrefOf(built, 'site'), 'https://example.com');
  assert.equal(hrefOf(built, 'personal'), 'mailto:me@example.com?subject=hello%20there%20%26%20hi');
});

test('availableLinks drops links whose contact detail is missing', () => {
  const { signalUrl, ...partial } = contact;
  assert.deepEqual(
    availableLinks(partial, links).map((link) => link.id),
    ['x', 'email', 'site', 'personal'],
  );
});

test('buildLinks returns new objects and leaves the inputs untouched', () => {
  const input = links.map((link) => ({ ...link }));
  const built = buildLinks(contact, input, 'hi');

  built.forEach((link, i) => assert.notEqual(link, input[i]));
  assert.ok(input.every((link) => !('href' in link)));
});

test('buildLinks throws on an unknown link id', () => {
  assert.throws(() => buildLinks(contact, [{ id: 'myspace' }], 'hi'), /Unknown link id: myspace/);
});

test('assertSafeHref only allows https and mailto', () => {
  assert.equal(assertSafeHref('https://ok.example'), 'https://ok.example');
  assert.equal(assertSafeHref('mailto:a@b.c'), 'mailto:a@b.c');
  assert.throws(() => assertSafeHref('tel:+14045550123'), /unsafe/);
  assert.throws(() => assertSafeHref('javascript:alert(1)'), /unsafe/);
  assert.throws(() => assertSafeHref('http://insecure.example'), /unsafe/);
  assert.throws(() => assertSafeHref('not a url'), /Invalid link/);
});

test('the public card only links to X, work email and website', () => {
  const built = buildLinks(CONTACT, LINKS, EMAIL_SUBJECT);

  assert.deepEqual(built.map((link) => link.id), ['x', 'email', 'site']);
  assert.equal(CONTACT.signalUrl, undefined, 'Signal is VIP-only');
  built.forEach((link) => assert.match(link.href, /^(https:|mailto:)/));
});

test('the VIP links are Signal and personal email; the phone lives in the contact card only', () => {
  const built = buildLinks({ ...CONTACT, ...contact }, VIP_LINKS, EMAIL_SUBJECT);

  assert.deepEqual(built.map((link) => link.id), ['signal', 'personal']);
  assert.ok(built.every((link) => link.vip === true));
});

test('the email subject is a plain, friendly hello', () => {
  assert.equal(EMAIL_SUBJECT, `Hi ${CONTACT.firstName}, I scanned your business card`);
});

test('the email button promises a reply instead of joking that one may never come', () => {
  const email = LINKS.find((link) => link.id === 'email');
  assert.doesNotMatch(email.sub, /eventually|maybe|someday|never/i);
});
