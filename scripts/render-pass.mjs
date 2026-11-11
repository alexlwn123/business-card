// Renders the Wallet artwork (strip/logo/icon at 1x/2x/3x) into wallet/pass/
// and a rough Wallet mock-up into out/pass-preview.png.
// Usage: npm run pass:art   (set BROWSER_PATH to override the browser)
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import { ART_FONTS, STRIP_SAFE_AREA, iconHtml, logoHtml, stripHtml } from '../wallet/art.js';
import { layoutProblems } from '../wallet/layout.js';
import { previewHtml } from '../wallet/preview.js';
import { findBrowser } from './browser.mjs';
import { CARD_URL, PASS_COLORS, PASS_COPY } from '../wallet/config.js';

const ART_DIR = new URL('../wallet/pass/', import.meta.url);
const PREVIEW = new URL('../out/pass-preview.png', import.meta.url);
const SCALES = Object.freeze([1, 2, 3]);

const fileName = (name, scale) => `${name}${scale === 1 ? '' : `@${scale}x`}.png`;

async function assertFontsLoaded(page, families) {
  const missing = await page.evaluate(async (wanted) => {
    await Promise.all(wanted.map((family) => document.fonts.load(`16px "${family}"`)));
    const loaded = (family) =>
      [...document.fonts].some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded');
    return wanted.filter((family) => !loaded(family));
  }, families);
  if (missing.length) throw new Error(`${missing.join(', ')} did not load from Google Fonts (are you offline?)`);
}

// Text extents come from a Range (the glyphs), heights from the line's box.
// The watermark's curls reach past its line box, so its ink is measured from
// the glyph metrics instead.
async function assertStripFits(page) {
  const { lines, watermark } = await page.evaluate(() => {
    const art = document.querySelector('#art').getBoundingClientRect();
    const relative = (name, { left, right, top, bottom }) => ({
      name,
      left: left - art.left,
      right: right - art.left,
      top: top - art.top,
      bottom: bottom - art.top,
    });
    const lineBox = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return relative(element.dataset.line, { left: text.left, right: text.right, top: box.top, bottom: box.bottom });
    };
    const inkBox = (element) => {
      const style = getComputedStyle(element);
      const context = document.createElement('canvas').getContext('2d');
      context.font = `${style.fontSize} ${style.fontFamily}`;
      const glyph = context.measureText(element.textContent);
      const box = element.getBoundingClientRect();
      const halfLeading = (parseFloat(style.lineHeight) - glyph.fontBoundingBoxAscent - glyph.fontBoundingBoxDescent) / 2;
      const baseline = box.top + halfLeading + glyph.fontBoundingBoxAscent;
      return relative('watermark', {
        left: box.left - glyph.actualBoundingBoxLeft,
        right: box.left + glyph.actualBoundingBoxRight,
        top: baseline - glyph.actualBoundingBoxAscent,
        bottom: baseline + glyph.actualBoundingBoxDescent,
      });
    };
    return {
      lines: [...document.querySelectorAll('#art [data-line]')].map(lineBox),
      watermark: inkBox(document.querySelector('#art [data-mark]')),
    };
  });
  const problems = layoutProblems(lines, STRIP_SAFE_AREA, { backdrop: [watermark] });
  if (problems.length) throw new Error(`Strip lettering does not fit: ${problems.join('; ')}`);
}

async function snap(browser, html, { scale, path, transparent = false, fonts = [], check }) {
  const context = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: 800, height: 900 } });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await assertFontsLoaded(page, fonts);
    if (check) await check(page);
    await page.locator('#art').screenshot({ path, omitBackground: transparent });
  } finally {
    await context.close();
  }
}

async function renderArt(browser) {
  const input = { copy: PASS_COPY, colors: PASS_COLORS };
  const assets = [
    { name: 'strip', html: stripHtml(input), check: assertStripFits },
    { name: 'logo', html: logoHtml(input), transparent: true },
    { name: 'icon', html: iconHtml(input) },
  ];
  for (const { name, html, transparent, check } of assets) {
    for (const scale of SCALES) {
      const path = fileURLToPath(new URL(fileName(name, scale), ART_DIR));
      await snap(browser, html, { scale, path, transparent, check, fonts: ART_FONTS[name] });
    }
  }
}

async function renderPreview(browser) {
  const asDataUri = async (name) =>
    `data:image/png;base64,${(await readFile(new URL(fileName(name, 3), ART_DIR))).toString('base64')}`;
  const images = {
    strip: await asDataUri('strip'),
    logo: await asDataUri('logo'),
    qr: await QRCode.toDataURL(CARD_URL, { margin: 0, width: 400 }),
  };
  const html = previewHtml({ colors: PASS_COLORS, images });
  await snap(browser, html, { scale: 2, path: fileURLToPath(PREVIEW) });
}

async function main() {
  await mkdir(ART_DIR, { recursive: true });
  await mkdir(new URL('.', PREVIEW), { recursive: true });
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  try {
    await renderArt(browser);
    await renderPreview(browser);
    process.stdout.write(`art → ${fileURLToPath(ART_DIR)}\npreview → ${fileURLToPath(PREVIEW)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
