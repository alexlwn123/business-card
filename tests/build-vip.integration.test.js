// Runs the real VIP build against throwaway private/ and site/ folders.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../scripts/build-vip.mjs', import.meta.url));
const KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const DETAILS = Object.freeze({
  signalUrl: 'https://signal.me/#eu/test',
  phone: '+1 (404) 555-0123',
  personalEmail: 'me@example.com',
});

let dir;
const paths = () => ({ private: join(dir, 'private'), site: join(dir, 'site'), vip: join(dir, 'site', 'vip') });

function build(args = [], env = {}) {
  return run(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, PRIVATE_DIR: paths().private, SITE_DIR: paths().site, ...env },
  });
}

const writeContact = (details) => writeFile(join(paths().private, 'contact.json'), JSON.stringify(details));
const readKey = async () => (await readFile(join(paths().private, 'vip.key'), 'utf8')).trim();

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vip-build-'));
  await mkdir(paths().private);
  await mkdir(paths().vip, { recursive: true });
  await writeFile(join(paths().vip, 'stale.json'), '{}');
});

afterEach(() => rm(dir, { recursive: true, force: true }));

test('a fresh checkout (no contact.json, no key) builds with VIP mode off', async () => {
  const { stdout } = await build();
  assert.match(stdout, /VIP mode off/);
  await assert.rejects(stat(paths().vip));
});

test('creates a private key and writes the VIP details and contact card under that key', async () => {
  await writeContact(DETAILS);
  await build();

  const key = await readKey();
  assert.match(key, KEY_PATTERN);
  assert.equal((await stat(join(paths().private, 'vip.key'))).mode & 0o777, 0o600);
  assert.deepEqual((await readdir(paths().vip)).sort(), [`${key}.json`, `${key}.vcf`]);

  assert.deepEqual(JSON.parse(await readFile(join(paths().vip, `${key}.json`), 'utf8')), DETAILS);
  const vcard = await readFile(join(paths().vip, `${key}.vcf`), 'utf8');
  assert.match(vcard, /TEL;TYPE=CELL;TYPE=VOICE:\+14045550123\r\n/);
  assert.match(vcard, /item1\.URL:https:\/\/signal\.me\/#eu\/test\r\n/);
  assert.match(vcard, /ORG:Finite Computer\r\n/);

  const unlock = await readFile(join(paths().private, 'vip-url.txt'), 'utf8');
  assert.equal(unlock.trim(), `https://qr.lwn.lol/#vip=${key}`);
});

test('rebuilding keeps the same key; --rotate replaces it and retires the old files', async () => {
  await writeContact(DETAILS);
  await build();
  const first = await readKey();
  await build();
  assert.equal(await readKey(), first);

  await build(['--rotate']);
  const second = await readKey();
  assert.notEqual(second, first);
  assert.deepEqual((await readdir(paths().vip)).sort(), [`${second}.json`, `${second}.vcf`]);
});

test('refuses to drop VIP mode when a key exists but contact.json has gone missing', async () => {
  await writeFile(join(paths().private, 'vip.key'), 'AbCdEfGhIjKlMnOpQrSt_-\n');
  await assert.rejects(build(), (error) => {
    assert.match(error.stderr, /contact\.json/);
    return true;
  });
  assert.deepEqual(await readdir(paths().vip), ['stale.json'], 'existing VIP files left alone');
});

test('private files are locked to the owner even if they were loosened', async () => {
  await writeContact(DETAILS);
  await build();
  await chmod(join(paths().private, 'vip.key'), 0o644);
  await chmod(join(paths().private, 'vip-url.txt'), 0o644);
  await build(['--rotate']);
  for (const name of ['vip.key', 'vip-url.txt']) {
    assert.equal((await stat(join(paths().private, name))).mode & 0o777, 0o600, name);
  }
});

test('invalid private details fail the build with a pointer to the bad field', async () => {
  await writeContact({ ...DETAILS, personalEmail: 'not-an-email' });
  await assert.rejects(build(), (error) => {
    assert.match(error.stderr, /personalEmail/);
    return true;
  });
  assert.deepEqual(await readdir(paths().vip), ['stale.json'], 'a bad edit never wipes the live VIP files');
  await writeFile(join(paths().private, 'contact.json'), '{ nope');
  await assert.rejects(build(), (error) => {
    assert.match(error.stderr, /contact\.json is not valid JSON/);
    return true;
  });
});
