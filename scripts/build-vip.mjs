// Writes the VIP files that only the Wallet pass QR can find:
//   site/vip/<key>.json  private details shown on the page
//   site/vip/<key>.vcf   the full contact card
// from private/contact.json, which stays outside site/ and is never deployed.
// Usage: npm run build   (or npm run vip:rotate to retire the current key)
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT } from '../site/js/config.js';
import { buildVCard } from '../site/js/vcard.js';
import { parseVipDetails, vipFiles, vipUrl } from '../site/js/vip.js';
import { CARD_URL } from '../wallet/config.js';
import { loadVipKey, vipKeyFile, writePrivate } from './vip-key.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PATHS = Object.freeze({
  private: resolve(process.env.PRIVATE_DIR ?? join(ROOT, 'private')),
  site: resolve(process.env.SITE_DIR ?? join(ROOT, 'site')),
});

async function readDetails(file) {
  let raw;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error.message}`);
  }
  return parseVipDetails(raw);
}

async function main() {
  const contactFile = join(PATHS.private, 'contact.json');
  const vipDir = join(PATHS.site, 'vip');

  if (!existsSync(contactFile)) {
    if (existsSync(vipKeyFile(PATHS.private))) {
      throw new Error(`${contactFile} is missing but a VIP key exists: passes already out there would stop unlocking.`);
    }
    await rm(vipDir, { recursive: true, force: true });
    process.stdout.write(`VIP mode off: no ${contactFile}\n`);
    return;
  }

  // Validate everything before touching site/vip, so a bad edit never takes VIP mode down.
  const details = await readDetails(contactFile);
  const vcard = buildVCard({ ...CONTACT, ...details });
  const key = await loadVipKey(PATHS.private, { create: true, rotate: process.argv.includes('--rotate') });
  const files = vipFiles(key);

  await rm(vipDir, { recursive: true, force: true }); // retire files from any previous key
  await mkdir(vipDir, { recursive: true });
  await writeFile(join(PATHS.site, files.details), JSON.stringify(details));
  await writeFile(join(PATHS.site, files.vcard), vcard, 'utf8');
  await writePrivate(join(PATHS.private, 'vip-url.txt'), `${vipUrl(CARD_URL, key)}\n`);

  const unlocked = Object.keys(details).join(', ') || 'nothing yet';
  process.stdout.write(`VIP files written (${unlocked}). Unlock link: ${join(PATHS.private, 'vip-url.txt')}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
