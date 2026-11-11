// Usage: npm run qr -- https://your-card.vercel.app
// Writes out/card-qr.png (high-res, for scanning into Wallet) and out/card-qr.svg (for print).
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const MODULE_COLOR = '#07000fff';
const BACKGROUND_COLOR = '#ffe600ff';
const PNG_WIDTH = 1200;
const OUT_DIR = new URL('../out/', import.meta.url);

function parseUrl(raw) {
  if (!raw) throw new Error('Usage: npm run qr -- https://your-card.vercel.app');
  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new Error(`Not a valid URL: ${raw}`, { cause: error });
  }
  if (url.protocol !== 'https:') throw new Error(`QR target must be https, got ${url.protocol}`);
  return url.href;
}

async function main() {
  const href = parseUrl(process.argv[2]);
  const options = {
    errorCorrectionLevel: 'M',
    margin: 4,
    color: { dark: MODULE_COLOR, light: BACKGROUND_COLOR },
  };

  await mkdir(OUT_DIR, { recursive: true });
  const pngPath = fileURLToPath(new URL('card-qr.png', OUT_DIR));
  const svgPath = fileURLToPath(new URL('card-qr.svg', OUT_DIR));
  await QRCode.toFile(pngPath, href, { ...options, width: PNG_WIDTH });
  await writeFile(svgPath, await QRCode.toString(href, { ...options, type: 'svg' }), 'utf8');
  process.stdout.write(`QR for ${href}\n  ${pngPath}\n  ${svgPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
