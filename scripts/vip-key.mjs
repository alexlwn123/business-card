// Loads (or creates) the VIP key that names the private files and goes in the Wallet QR.
// It lives in private/vip.key (mode 600) so the build and the pass always agree.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isVipKey } from '../site/js/vip.js';

const KEY_BYTES = 16; // 128 bits → 22 base64url characters

const newVipKey = () => randomBytes(KEY_BYTES).toString('base64url');

function checked(key, source) {
  if (!isVipKey(key)) throw new Error(`${source} is not a valid VIP key (expected 22 base64url characters).`);
  return key;
}

export const vipKeyFile = (privateDir) => join(privateDir, 'vip.key');

/** writeFile's mode only applies to new files, so lock existing ones down too. */
export async function writePrivate(file, contents) {
  await writeFile(file, contents, { mode: 0o600 });
  await chmod(file, 0o600);
}

export async function loadVipKey(privateDir, { create = false, rotate = false } = {}) {
  const file = vipKeyFile(privateDir);
  if (existsSync(file) && !rotate) return checked((await readFile(file, 'utf8')).trim(), file);
  if (!create && !rotate) throw new Error(`No VIP key at ${file}. Run "pnpm build" first; it creates one.`);

  const key = newVipKey();
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  await writePrivate(file, `${key}\n`);
  return key;
}
