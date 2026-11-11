// End-to-end: a throwaway CA + fake "Pass Type ID" cert stand in for Apple's,
// then we run the real sign script and verify the .pkpass it produces.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../scripts/sign-pass.mjs', import.meta.url));
const PASSWORD = 'correct horse battery staple';
const VIP_KEY = 'AbCdEfGhIjKlMnOpQrSt_-';
let dir;

const openssl = (...args) => run('openssl', args, { cwd: dir });
const sha1 = (data) => createHash('sha1').update(data).digest('hex');

function sign(p12, { password = PASSWORD, site = join(dir, 'site') } = {}) {
  return run(process.execPath, [SCRIPT, p12], {
    env: {
      ...process.env,
      P12_PASSWORD: password,
      WWDR_CERT: join(dir, 'ca.cer'),
      PASS_ART_DIR: join(dir, 'art'),
      PKPASS_OUT: join(dir, 'out', 'card.pkpass'),
      PRIVATE_DIR: join(dir, 'private'),
      SITE_DIR: site,
    },
  });
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pkpass-test-'));
  await openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem',
    '-days', '1', '-subj', '/CN=Fake WWDR CA');
  await openssl('x509', '-in', 'ca.pem', '-outform', 'DER', '-out', 'ca.cer');
  await openssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'leaf.key', '-out', 'leaf.csr',
    '-subj', '/UID=pass.test.example/CN=Pass Type ID: pass.test.example/OU=ABCDE12345/O=Test/C=US');
  await openssl('x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key',
    '-CAcreateserial', '-out', 'leaf.pem', '-days', '1');
  await openssl('pkcs12', '-export', '-inkey', 'leaf.key', '-in', 'leaf.pem', '-out', 'leaf.p12',
    '-passout', `pass:${PASSWORD}`);

  await mkdir(join(dir, 'private'));
  await writeFile(join(dir, 'private', 'vip.key'), `${VIP_KEY}\n`);
  await mkdir(join(dir, 'site', 'vip'), { recursive: true });
  await writeFile(join(dir, 'site', 'vip', `${VIP_KEY}.json`), '{}');

  await mkdir(join(dir, 'art'));
  await writeFile(join(dir, 'art', 'icon.png'), 'fake icon bytes');
  await writeFile(join(dir, 'art', 'strip@3x.png'), 'fake strip bytes');
});

after(() => rm(dir, { recursive: true, force: true }));

test('produces a .pkpass whose manifest, identity and signature all check out', async () => {
  const { stdout } = await sign(join(dir, 'leaf.p12'));
  assert.match(stdout, /pass\.test\.example/);
  assert.equal((await stat(join(dir, 'out', 'card.pkpass'))).mode & 0o777, 0o600, 'the .pkpass holds the VIP key');

  const unpacked = join(dir, 'unpacked');
  await run('unzip', ['-q', join(dir, 'out', 'card.pkpass'), '-d', unpacked]);

  const manifest = JSON.parse(await readFile(join(unpacked, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['icon.png', 'pass.json', 'strip@3x.png']);
  for (const [name, digest] of Object.entries(manifest)) {
    assert.equal(sha1(await readFile(join(unpacked, name))), digest, `${name} hash mismatch`);
  }

  const pass = JSON.parse(await readFile(join(unpacked, 'pass.json'), 'utf8'));
  assert.equal(pass.passTypeIdentifier, 'pass.test.example');
  assert.equal(pass.teamIdentifier, 'ABCDE12345');
  assert.equal(pass.barcodes[0].message, `https://qr.lwn.lol/#vip=${VIP_KEY}`);

  await openssl('cms', '-verify', '-binary', '-inform', 'DER', '-in', join(unpacked, 'signature'),
    '-content', join(unpacked, 'manifest.json'), '-CAfile', 'ca.pem', '-purpose', 'any', '-out', '/dev/null');

  await writeFile(join(unpacked, 'manifest.json'), '{"tampered":true}');
  await assert.rejects(
    openssl('cms', '-verify', '-binary', '-inform', 'DER', '-in', join(unpacked, 'signature'),
      '-content', join(unpacked, 'manifest.json'), '-CAfile', 'ca.pem', '-purpose', 'any', '-out', '/dev/null'),
  );
});

test('refuses to sign without a VIP key', async () => {
  const env = { ...process.env, P12_PASSWORD: PASSWORD, PRIVATE_DIR: join(dir, 'no-private-here') };
  await assert.rejects(run(process.execPath, [SCRIPT, join(dir, 'leaf.p12')], { env }), (error) => {
    assert.match(error.stderr, /pnpm build/);
    return true;
  });
});

test('refuses to sign a QR whose VIP files have not been built', async () => {
  await assert.rejects(sign(join(dir, 'leaf.p12'), { site: join(dir, 'empty-site') }), (error) => {
    assert.match(error.stderr, /pnpm build/);
    return true;
  });
});

test('fails with a helpful message on the wrong .p12 password', async () => {
  await assert.rejects(sign(join(dir, 'leaf.p12'), { password: 'nope' }), (error) => {
    assert.match(error.stderr, /wrong P12_PASSWORD/);
    return true;
  });
});
