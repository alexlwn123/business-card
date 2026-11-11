/**
 * VIP mode: the Wallet pass QR opens qr.lwn.lol/#vip=<key>. The key is a
 * 128-bit random secret that names two unlisted files (vip/<key>.json and
 * vip/<key>.vcf) holding the private contact details. In the page URL it sits
 * in the fragment, which never leaves the browser or appears in Referer
 * headers; fetching those files does put it in the request path, so it shows
 * up in your own Vercel request logs (nobody else's).
 * Pure helpers with injected browser objects, so it is unit tested in Node.
 */
import { normalizePhone } from './phone.js';

const VIP_PARAM = 'vip';
const STORAGE_KEY = 'vip-key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const SIGNAL_URL = /^https:\/\/signal\.me\/\S+$/;
const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const GONE = Object.freeze([404, 410]); // the key was rotated or never existed

function assertVipKey(key) {
  if (!KEY_PATTERN.test(key ?? '')) {
    throw new Error(`Malformed VIP key: expected 22 base64url characters, got ${JSON.stringify(key)}`);
  }
  return key;
}

function safely(action) {
  try {
    return action();
  } catch {
    return null; // storage can be disabled (private browsing, strict settings)
  }
}

export const isVipKey = (key) => KEY_PATTERN.test(key ?? '');

export function vipKeyFromHash(hash) {
  const key = new URLSearchParams(String(hash).replace(/^#/, '')).get(VIP_PARAM);
  return isVipKey(key) ? key : null;
}

export function vipUrl(base, key) {
  return `${base.replace(/\/$/, '')}/#${VIP_PARAM}=${assertVipKey(key)}`;
}

export function vipFiles(key) {
  assertVipKey(key);
  return Object.freeze({ details: `vip/${key}.json`, vcard: `vip/${key}.vcf` });
}

function checkField(raw, field, isValid) {
  const value = raw[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !isValid(value.trim())) {
    throw new Error(`Invalid ${field} in VIP details: ${JSON.stringify(value)}`);
  }
  return value.trim();
}

export function parseVipDetails(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('VIP details must be a JSON object');
  const fields = {
    signalUrl: checkField(raw, 'signalUrl', (v) => SIGNAL_URL.test(v)),
    phone: checkField(raw, 'phone', (v) => Boolean(normalizePhone(v))),
    personalEmail: checkField(raw, 'personalEmail', (v) => EMAIL.test(v)),
  };
  return Object.freeze(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)));
}

/** Reads the key from #vip=…, strips it from the address bar, and remembers it for this tab. */
export function claimVipKey({ location, history, storage }) {
  const fromHash = vipKeyFromHash(location.hash);
  if (fromHash) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    safely(() => storage.setItem(STORAGE_KEY, fromHash));
    return fromHash;
  }
  const saved = safely(() => storage.getItem(STORAGE_KEY));
  return isVipKey(saved) ? saved : null;
}

/** Resolves to { details, vcardHref }, or null when the key unlocks nothing (e.g. it was rotated). */
export async function fetchVip(key, { fetch, storage }) {
  const files = vipFiles(key);
  const response = await fetch(files.details, { cache: 'no-store' });
  if (!response.ok) {
    if (GONE.includes(response.status)) safely(() => storage.removeItem(STORAGE_KEY));
    return null;
  }
  return Object.freeze({ details: parseVipDetails(await response.json()), vcardHref: files.vcard });
}
