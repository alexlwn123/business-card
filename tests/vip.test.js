import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../site/js/phone.js';
import { claimVipKey, fetchVip, parseVipDetails, vipFiles, vipKeyFromHash, vipUrl } from '../site/js/vip.js';

const KEY = 'AbCdEfGhIjKlMnOpQrSt_-';
const OTHER_KEY = 'zzzzzzzzzzzzzzzzzzzzzz';

function fakeStorage(initial = {}, { broken = false } = {}) {
  const items = new Map(Object.entries(initial));
  const guard = (fn) => (...args) => {
    if (broken) throw new Error('storage disabled');
    return fn(...args);
  };
  return {
    items,
    getItem: guard((key) => (items.has(key) ? items.get(key) : null)),
    setItem: guard((key, value) => items.set(key, value)),
    removeItem: guard((key) => items.delete(key)),
  };
}

function fakeBrowser(hash, storage = fakeStorage()) {
  const replaced = [];
  return {
    replaced,
    storage,
    location: { hash, pathname: '/', search: '' },
    history: { state: null, replaceState: (state, title, url) => replaced.push(url) },
  };
}

const okResponse = (body) => ({ ok: true, json: async () => body });

test('vipKeyFromHash reads a well-formed #vip= key and ignores anything else', () => {
  assert.equal(vipKeyFromHash(`#vip=${KEY}`), KEY);
  assert.equal(vipKeyFromHash(`#other=1&vip=${KEY}`), KEY);
  assert.equal(vipKeyFromHash(''), null);
  assert.equal(vipKeyFromHash('#vip=short'), null);
  assert.equal(vipKeyFromHash(`#vip=${KEY.slice(1)}!`), null);
  assert.equal(vipKeyFromHash(`#vip=../${KEY}`), null);
});

test('vipUrl puts the key in the fragment so it never reaches a server', () => {
  assert.equal(vipUrl('https://qr.lwn.lol', KEY), `https://qr.lwn.lol/#vip=${KEY}`);
  assert.equal(vipUrl('https://qr.lwn.lol/', KEY), `https://qr.lwn.lol/#vip=${KEY}`);
  assert.throws(() => vipUrl('https://qr.lwn.lol', 'nope'), /VIP key/);
});

test('vipFiles maps a key to its details and contact-card paths', () => {
  assert.deepEqual(vipFiles(KEY), { details: `vip/${KEY}.json`, vcard: `vip/${KEY}.vcf` });
  assert.throws(() => vipFiles('../../etc/passwd'), /VIP key/);
});

test('normalizePhone keeps the country code and strips punctuation', () => {
  assert.equal(normalizePhone('+1 (404) 555-0123'), '+14045550123');
  assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958');
  assert.throws(() => normalizePhone('404-555-0123'), /country code/);
  assert.throws(() => normalizePhone('+1 555'), /digits/);
  assert.throws(() => normalizePhone('+1 404 555 0123; drop table'), /country code/);
});

test('parseVipDetails keeps known, valid fields and drops blanks and extras', () => {
  const details = parseVipDetails({
    signalUrl: 'https://signal.me/#eu/abc',
    phone: ' +1 404 555 0123 ',
    personalEmail: 'me@example.com',
    phoneBook: 'ignored',
  });
  assert.deepEqual(details, {
    signalUrl: 'https://signal.me/#eu/abc',
    phone: '+1 404 555 0123',
    personalEmail: 'me@example.com',
  });
  assert.ok(Object.isFrozen(details));
  assert.deepEqual(parseVipDetails({ signalUrl: '', phone: '', personalEmail: 'me@example.com' }), {
    personalEmail: 'me@example.com',
  });
});

test('parseVipDetails rejects malformed values', () => {
  assert.throws(() => parseVipDetails(null), /object/);
  assert.throws(() => parseVipDetails({ signalUrl: 'https://evil.example/#eu/abc' }), /signalUrl/);
  assert.throws(() => parseVipDetails({ signalUrl: 'https://signal.me/#eu/a\nb' }), /signalUrl/);
  assert.throws(() => parseVipDetails({ personalEmail: 'me@example.com?bcc=x@y.z' }), /personalEmail/);
  assert.throws(() => parseVipDetails({ personalEmail: 'me%3Fcc%3Dx@y.z' }), /personalEmail/);
  assert.throws(() => parseVipDetails({ phone: '555-0123' }), /country code/);
  assert.throws(() => parseVipDetails({ phone: 4045550123 }), /phone/);
});

test('claimVipKey takes the key from the URL, hides it from the address bar and remembers it for the tab', () => {
  const browser = fakeBrowser(`#vip=${KEY}`);
  assert.equal(claimVipKey(browser), KEY);
  assert.deepEqual(browser.replaced, ['/']);
  assert.equal(browser.storage.items.get('vip-key'), KEY);
});

test('claimVipKey falls back to the remembered key after a reload', () => {
  const browser = fakeBrowser('', fakeStorage({ 'vip-key': KEY }));
  assert.equal(claimVipKey(browser), KEY);
  assert.deepEqual(browser.replaced, []);
  assert.equal(claimVipKey(fakeBrowser('', fakeStorage({ 'vip-key': 'tampered' }))), null);
  assert.equal(claimVipKey(fakeBrowser('')), null);
});

test('claimVipKey still works when storage is unavailable', () => {
  const broken = fakeStorage({}, { broken: true });
  assert.equal(claimVipKey(fakeBrowser(`#vip=${KEY}`, broken)), KEY);
  assert.equal(claimVipKey(fakeBrowser('', broken)), null);
});

test('fetchVip loads the details and points the contact card at the private vCard', async () => {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init });
    return okResponse({ signalUrl: 'https://signal.me/#eu/abc' });
  };
  const vip = await fetchVip(KEY, { fetch, storage: fakeStorage() });
  assert.deepEqual(requests, [{ url: `vip/${KEY}.json`, init: { cache: 'no-store' } }]);
  assert.deepEqual(vip, { details: { signalUrl: 'https://signal.me/#eu/abc' }, vcardHref: `vip/${KEY}.vcf` });
});

test('fetchVip forgets a key that no longer unlocks anything (rotated or wrong)', async () => {
  const storage = fakeStorage({ 'vip-key': OTHER_KEY });
  const vip = await fetchVip(OTHER_KEY, { fetch: async () => ({ ok: false, status: 404 }), storage });
  assert.equal(vip, null);
  assert.equal(storage.items.has('vip-key'), false);
});

test('fetchVip keeps the key through a server hiccup so a reload can retry', async () => {
  const storage = fakeStorage({ 'vip-key': KEY });
  const vip = await fetchVip(KEY, { fetch: async () => ({ ok: false, status: 503 }), storage });
  assert.equal(vip, null);
  assert.equal(storage.items.get('vip-key'), KEY);
});

test('fetchVip refuses details that fail validation', async () => {
  const fetch = async () => okResponse({ signalUrl: 'javascript:alert(1)' });
  await assert.rejects(fetchVip(KEY, { fetch, storage: fakeStorage() }), /signalUrl/);
});
