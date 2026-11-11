/**
 * manifest.json for a .pkpass: SHA-1 of every file in the bundle except
 * manifest.json and signature themselves.
 */
import { createHash } from 'node:crypto';

const RESERVED = Object.freeze(['manifest.json', 'signature']);
const REQUIRED = Object.freeze(['pass.json', 'icon.png']);

const sha1 = (data) => createHash('sha1').update(data).digest('hex');

export function buildManifest(files) {
  const names = Object.keys(files);
  const reserved = names.find((name) => RESERVED.includes(name));
  if (reserved) throw new Error(`${reserved} must not be listed in its own manifest`);
  const missing = REQUIRED.find((name) => !names.includes(name));
  if (missing) throw new Error(`A pass bundle needs ${missing}`);

  return Object.fromEntries(
    [...names].sort().map((name) => [name, sha1(files[name])]),
  );
}
