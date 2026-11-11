// Writes site/<VCARD_FILENAME> from the card config so "SAVE MY CONTACT" works.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CONTACT, VCARD_FILENAME } from '../site/js/config.js';
import { buildVCard } from '../site/js/vcard.js';

const target = fileURLToPath(new URL(`../site/${VCARD_FILENAME}`, import.meta.url));

try {
  await writeFile(target, buildVCard(CONTACT), 'utf8');
  process.stdout.write(`wrote ${target}\n`);
} catch (error) {
  process.stderr.write(`Failed to build vCard at ${target}: ${error.message}\n`);
  process.exitCode = 1;
}
