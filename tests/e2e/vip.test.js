// Drives the real page in a browser: public visitors vs. Wallet-pass (VIP) visitors.
// Builds VIP files for fake details into a temp copy of site/ and serves it locally.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import { findBrowser } from '../../scripts/browser.mjs';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = Object.freeze({
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.vcf': 'text/vcard',
});
const DETAILS = Object.freeze({
  signalUrl: 'https://signal.me/#eu/e2e', phone: '+1 (404) 555-0123', personalEmail: 'vip@example.com',
});
const STALE_KEY = 'zzzzzzzzzzzzzzzzzzzzzz';
const browserPath = findBrowser({ optional: true });
const skip = !browserPath && 'no Chromium-based browser installed';

let dir;
let server;
let origin;
let browser;
let key;

function serve(root) {
  return createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(root + sep)) return response.writeHead(403).end();
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
}

before(async () => {
  if (skip) return;
  dir = await mkdtemp(join(tmpdir(), 'vip-e2e-'));
  const site = join(dir, 'site');
  const realVip = join(ROOT, 'site', 'vip');
  await cp(join(ROOT, 'site'), site, { recursive: true, filter: (src) => !src.startsWith(realVip) && !src.includes('.vercel') });
  await mkdir(join(dir, 'private'));
  await writeFile(join(dir, 'private', 'contact.json'), JSON.stringify(DETAILS));
  await run(process.execPath, [join(ROOT, 'scripts', 'build-vip.mjs')], {
    env: { ...process.env, PRIVATE_DIR: join(dir, 'private'), SITE_DIR: site },
  });
  key = (await readFile(join(dir, 'private', 'vip.key'), 'utf8')).trim();
  server = serve(site);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: browserPath, headless: true });
});

after(async () => {
  await browser?.close();
  server?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function openCard(path) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(`${origin}${path}`);
  await page.waitForSelector('body.is-live');
  await page.waitForLoadState('networkidle');
  return { page, context, requests };
}

const linkIds = (page) => page.$$eval('#links .link', (links) => links.map((link) => link.dataset.id));
const hrefOf = (page, id) => page.getAttribute(`#links .link[data-id="${id}"]`, 'href');

test('a public visitor gets X, work email and website, and never touches the VIP files', { skip }, async () => {
  const { page, context, requests } = await openCard('/');
  assert.deepEqual(await linkIds(page), ['x', 'email', 'site']);
  assert.equal(await page.isVisible('#vip'), false);
  assert.equal(await page.getAttribute('#save', 'href'), 'alex-lewin.vcf');
  assert.ok(!requests.some((path) => path.startsWith('/vip/')), 'no VIP requests');
  await context.close();
});

test('the Wallet pass link unlocks Signal and personal email, then hides the key', { skip }, async () => {
  const { page, context } = await openCard(`/#vip=${key}`);
  await page.waitForSelector('.link--vip');

  assert.deepEqual(await linkIds(page), ['signal', 'personal', 'x', 'email', 'site']);
  assert.equal(await page.isVisible('#vip'), true);
  assert.equal(await hrefOf(page, 'signal'), DETAILS.signalUrl);
  assert.match(await hrefOf(page, 'personal'), /^mailto:vip@example\.com\?subject=/);
  assert.equal(await page.evaluate(() => window.location.href), `${origin}/`, 'key stripped from the address bar');

  const saveHref = await page.getAttribute('#save', 'href');
  assert.equal(saveHref, `vip/${key}.vcf`);
  const vcard = await (await page.request.get(`${origin}/${saveHref}`)).text();
  assert.match(vcard, /TEL;TYPE=CELL;TYPE=VOICE:\+14045550123/);
  assert.match(vcard, /EMAIL;TYPE=INTERNET;TYPE=HOME:vip@example\.com/);

  await page.reload();
  await page.waitForSelector('.link--vip');
  assert.equal(await page.isVisible('#vip'), true, 'VIP survives a reload in the same tab');
  await context.close();
});

test('a stale or wrong key falls back to the public card', { skip }, async () => {
  const { page, context } = await openCard(`/#vip=${STALE_KEY}`);
  assert.deepEqual(await linkIds(page), ['x', 'email', 'site']);
  assert.equal(await page.isVisible('#vip'), false);
  assert.equal(await page.getAttribute('#save', 'href'), 'alex-lewin.vcf');
  assert.equal(await page.evaluate(() => window.location.hash), '');
  await context.close();
});
