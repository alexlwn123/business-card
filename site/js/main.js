import {
  BOOT_LINES,
  CONTACT,
  EMAIL_SUBJECT,
  LINKS,
  MARQUEE_TEXT,
  TAGLINES,
  VCARD_FILENAME,
  VIP_BOOT_LINES,
  VIP_EMOJIS,
  VIP_LINKS,
  VISITOR_NUMBER,
} from './config.js';
import { availableLinks, buildLinks } from './links.js';
import { claimVipKey, fetchVip } from './vip.js';
import { createStarfield } from './starfield.js';
import { createConfetti } from './confetti.js';
import { createTilt } from './tilt.js';
import { createAirhorn } from './airhorn.js';
import { dismissBoot, runBoot } from './boot.js';
import { startTyper } from './typer.js';
import { center, fillMarquees, flash, readPalette, renderLinks, rollCounter, shake, spin } from './ui.js';

const PALETTE_VARS = Object.freeze(['--pink', '--cyan', '--yellow', '--acid', '--orange', '--white']);
const CARD_EMOJIS = Object.freeze(['⚡', '💾', '🔥', '✨', '💥', '🦄']);
const SPEED = Object.freeze({ warp: 38, cruise: 2.4, party: 26 });
const SPARKLE_EVERY_MS = 45;
const VIP_WAIT_MS = 800; // how long the boot screen waits to know whether to brag

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Inert stand-ins so one broken effect never takes the contact links down with it.
const NOOP_STARS = Object.freeze({ setSpeed() {} });
const NOOP_CONFETTI = Object.freeze({ burst() {}, cannon() {}, sparkle() {} });
const NOOP_TILT = Object.freeze({ enableMotion: async () => false });
const NO_STORAGE = Object.freeze({ getItem: () => null, setItem() {}, removeItem() {} });
const NOT_VIP = Object.freeze({ key: null, ready: Promise.resolve(null) });

function attempt(factory, fallback) {
  try {
    return factory();
  } catch (error) {
    reportError(error);
    return fallback;
  }
}

function renderContact(contact, linkConfigs, { confetti }) {
  const links = buildLinks(contact, availableLinks(contact, linkConfigs), EMAIL_SUBJECT);
  renderLinks($('links'), links, (event, link) =>
    confetti.burst(event.clientX, event.clientY, { count: 60, power: 11, emojis: [link.emoji, '✨'] }),
  );
}

function setupLinks(fx) {
  renderContact(CONTACT, LINKS, fx);

  const save = $('save');
  const { confetti } = fx;
  save.href = VCARD_FILENAME;
  save.addEventListener('pointerdown', (event) =>
    confetti.burst(event.clientX, event.clientY, { count: 90, emojis: ['📇', '🤝', '✨'] }),
  );
}

function setupCard({ tilt, confetti }) {
  $('card').addEventListener('click', (event) => {
    tilt.enableMotion();
    if (!reduceMotion) spin($('card-spin'));
    confetti.burst(event.clientX, event.clientY, { count: 120, power: 16, emojis: CARD_EMOJIS });
  });
}

function setupAirhorn({ horn, confetti, stars }) {
  const button = $('airhorn');
  button.addEventListener('click', () => {
    const seconds = horn.blast();
    const { x, y } = center(button);
    confetti.burst(x, y, { count: 140, power: 20, angle: -2.2, spread: 1.6, emojis: ['📯', '💥', '🔊'] });
    if (reduceMotion) return;
    shake($('page'), 14);
    flash($('flash'), 0.5);
    stars.setSpeed(SPEED.party);
    setTimeout(() => stars.setSpeed(SPEED.cruise), Math.max(seconds, 0.6) * 1000);
  });
}

function setupSparkles({ confetti }) {
  if (reduceMotion) return;
  let last = 0;
  const onMove = (event) => {
    if (event.timeStamp - last < SPARKLE_EVERY_MS) return;
    last = event.timeStamp;
    confetti.sparkle(event.clientX, event.clientY);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
}

/** Starts the VIP lookup right away so it is usually done before the boot screen is. */
function startVip() {
  const storage = attempt(() => window.sessionStorage, NO_STORAGE);
  const key = attempt(() => claimVipKey({ location: window.location, history: window.history, storage }), null);
  if (!key) return NOT_VIP;
  const ready = fetchVip(key, { fetch: (url, init) => window.fetch(url, init), storage }).catch((error) => {
    reportError(error);
    return null;
  });
  return { key, ready };
}

function revealVip(fx, { details, vcardHref }) {
  renderContact({ ...CONTACT, ...details }, [...VIP_LINKS, ...LINKS], fx);
  $('vip').hidden = false;
  $('save').href = vcardHref;
  document.body.classList.add('is-vip');
}

const settleWithin = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

const bootLines = (isVip) =>
  isVip ? [...BOOT_LINES.slice(0, -1), ...VIP_BOOT_LINES, ...BOOT_LINES.slice(-1)] : BOOT_LINES;

async function boot({ stars }, lines) {
  const overlay = $('boot');
  if (reduceMotion) {
    dismissBoot(overlay, { instant: true });
    return;
  }
  stars.setSpeed(SPEED.warp);
  await runBoot(overlay, $('bootlog'), lines);
  dismissBoot(overlay);
}

function celebrate({ stars, confetti }, emojis) {
  document.body.classList.add('is-live');
  startTyper($('typer'), TAGLINES);
  rollCounter($('counter'), VISITOR_NUMBER);
  stars.setSpeed(SPEED.cruise);
  if (reduceMotion) return;
  flash($('flash'));
  shake($('page'));
  confetti.cannon('left', { emojis });
  confetti.cannon('right', { emojis });
}

async function main() {
  const vip = startVip();
  const palette = readPalette(PALETTE_VARS);
  const fx = {
    stars: attempt(
      () => createStarfield($('stars'), { colors: palette, animate: !reduceMotion }),
      NOOP_STARS,
    ),
    confetti: attempt(() => createConfetti($('confetti'), { colors: palette }), NOOP_CONFETTI),
    tilt: attempt(() => createTilt($('card'), { animate: !reduceMotion }), NOOP_TILT),
    horn: createAirhorn(),
  };

  setupLinks(fx);
  fillMarquees(document.querySelectorAll('[data-marquee]'), MARQUEE_TEXT);
  setupCard(fx);
  setupAirhorn(fx);
  setupSparkles(fx);
  vip.ready.then((unlocked) => unlocked && revealVip(fx, unlocked)).catch(reportError);

  const unlockedInTime = await settleWithin(vip.ready, VIP_WAIT_MS);
  await boot(fx, bootLines(Boolean(unlockedInTime)));
  celebrate(fx, unlockedInTime ? VIP_EMOJIS : CARD_EMOJIS);
}

main().catch((error) => {
  reportError(error);
  $('boot')?.remove();
  document.body.classList.add('is-live');
});
