// Signs the Wallet pass with your Pass Type ID certificate and writes out/alex-lewin.pkpass.
// Usage: P12_PASSWORD='…' npm run pass:sign -- ~/Downloads/PassTypeID.p12
// The pass type id + team id are read from the certificate, and the QR gets the
// VIP unlock link from private/vip.key, so there's nothing else to configure.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CONTACT } from '../site/js/config.js';
import { passIdentityFromSubject } from '../wallet/cert.js';
import * as PASS from '../wallet/config.js';
import { buildManifest } from '../wallet/manifest.js';
import { buildPassJson } from '../wallet/pass-json.js';
import { vipFiles, vipUrl } from '../site/js/vip.js';
import { loadVipKey } from './vip-key.mjs';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WWDR_URL = 'https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer';
const PATHS = Object.freeze({
  art: resolve(process.env.PASS_ART_DIR ?? join(ROOT, 'wallet/pass')),
  wwdr: resolve(process.env.WWDR_CERT ?? join(ROOT, 'wallet/certs/AppleWWDRCAG4.cer')),
  out: resolve(process.env.PKPASS_OUT ?? join(ROOT, 'out/alex-lewin.pkpass')),
  private: resolve(process.env.PRIVATE_DIR ?? join(ROOT, 'private')),
  site: resolve(process.env.SITE_DIR ?? join(ROOT, 'site')),
});

const openssl = (args) => run('openssl', args, { env: process.env });

async function extractFromP12(p12, outFile, selectArgs) {
  const args = ['pkcs12', '-in', p12, '-out', outFile, '-passin', 'env:P12_PASSWORD', ...selectArgs];
  try {
    await openssl(args);
  } catch (first) {
    try {
      await openssl([...args, '-legacy']); // older Keychain exports use RC2, which OpenSSL 3 hides
    } catch {
      throw new Error(`Could not read ${p12}: wrong P12_PASSWORD, or not a .p12 export.\n${first.stderr ?? ''}`);
    }
  }
}

async function readIdentity(certPem) {
  try {
    await openssl(['x509', '-in', certPem, '-noout', '-checkend', '0']);
  } catch {
    throw new Error('Your Pass Type ID certificate has expired. Make a new one in the Apple Developer portal.');
  }
  const { stdout } = await openssl(['x509', '-in', certPem, '-noout', '-subject', '-nameopt', 'RFC2253']);
  return passIdentityFromSubject(stdout.trim());
}

async function wwdrPem(outFile) {
  if (!existsSync(PATHS.wwdr)) {
    const response = await fetch(WWDR_URL);
    if (!response.ok) throw new Error(`Downloading Apple's WWDR G4 certificate failed (HTTP ${response.status})`);
    await mkdir(dirname(PATHS.wwdr), { recursive: true });
    await writeFile(PATHS.wwdr, Buffer.from(await response.arrayBuffer()));
  }
  const isPem = (await readFile(PATHS.wwdr, 'latin1')).startsWith('-----BEGIN');
  await openssl(['x509', ...(isPem ? [] : ['-inform', 'DER']), '-in', PATHS.wwdr, '-out', outFile]);
}

async function readArt() {
  const names = (await readdir(PATHS.art)).filter((name) => name.endsWith('.png'));
  if (!names.includes('icon.png')) throw new Error(`No icon.png in ${PATHS.art}. Run "npm run pass:art" first.`);
  return Promise.all(names.map(async (name) => [name, await readFile(join(PATHS.art, name))]));
}

async function stagePass(stageDir, identity, scanUrl) {
  const passJson = buildPassJson({
    contact: CONTACT,
    copy: PASS.PASS_COPY,
    colors: PASS.PASS_COLORS,
    meta: PASS.PASS_META,
    note: PASS.PASS_NOTE,
    cardUrl: PASS.CARD_URL,
    scanUrl,
    ...identity,
  });
  const files = Object.fromEntries([
    ['pass.json', Buffer.from(JSON.stringify(passJson, null, 2))],
    ...(await readArt()),
  ]);
  await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(stageDir, name), data)));
  await writeFile(join(stageDir, 'manifest.json'), JSON.stringify(buildManifest(files), null, 2));
}

async function signAndZip(stageDir, keys) {
  await openssl(['smime', '-binary', '-sign', '-certfile', keys.wwdr, '-signer', keys.cert, '-inkey', keys.key,
    '-in', join(stageDir, 'manifest.json'), '-out', join(stageDir, 'signature'), '-outform', 'DER']);
  await mkdir(dirname(PATHS.out), { recursive: true });
  await rm(PATHS.out, { force: true });
  await run('zip', ['-q', '-X', '-r', PATHS.out, '.'], { cwd: stageDir });
  await chmod(PATHS.out, 0o600); // its QR carries the VIP key
}

/** The QR is only useful if the files it unlocks have been built (and then deployed). */
async function scanUrlForPass() {
  const key = await loadVipKey(PATHS.private);
  if (!existsSync(join(PATHS.site, vipFiles(key).details))) {
    throw new Error('The VIP files for this key are not built. Run "npm run build" (then deploy) before signing.');
  }
  return vipUrl(PASS.CARD_URL, key);
}

async function main() {
  const [p12Arg] = process.argv.slice(2);
  if (!p12Arg) throw new Error("Usage: P12_PASSWORD='…' npm run pass:sign -- /path/to/PassTypeID.p12");
  if (process.env.P12_PASSWORD === undefined) {
    throw new Error("Set P12_PASSWORD (use P12_PASSWORD='' if the .p12 has no password).");
  }

  const scanUrl = await scanUrlForPass();
  const work = await mkdtemp(join(tmpdir(), 'pkpass-')); // 0700: the private key lives here briefly
  try {
    const keys = { cert: join(work, 'cert.pem'), key: join(work, 'key.pem'), wwdr: join(work, 'wwdr.pem') };
    const p12 = resolve(p12Arg);
    await extractFromP12(p12, keys.cert, ['-clcerts', '-nokeys']);
    await extractFromP12(p12, keys.key, ['-nocerts', '-nodes']);
    const identity = await readIdentity(keys.cert);
    await wwdrPem(keys.wwdr);

    const stage = join(work, 'pass');
    await mkdir(stage);
    await stagePass(stage, identity, scanUrl);
    await signAndZip(stage, keys);
    process.stdout.write(`Signed ${identity.passTypeIdentifier} (team ${identity.teamIdentifier})\n→ ${PATHS.out}\n`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
