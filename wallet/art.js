/**
 * HTML templates for the pass artwork, rendered to PNG by scripts/render-pass.mjs.
 * Sizes are Wallet points; the renderer multiplies by 1x/2x/3x.
 */
import { escapeHtml as e } from './html.js';

// Store-card strips are 375x123pt on some layouts and 375x144pt on others.
// We render 144pt tall and keep everything inside the middle 123pt.
export const ART_SIZES = Object.freeze({
  strip: Object.freeze({ width: 375, height: 144 }),
  logo: Object.freeze({ height: 50 }),
  icon: Object.freeze({ width: 29, height: 29 }),
});

const SAFE_HEIGHT = 123;
const SIDE_MARGIN = 12;
const CROP = (ART_SIZES.strip.height - SAFE_HEIGHT) / 2;
export const STRIP_SAFE_AREA = Object.freeze({
  left: SIDE_MARGIN,
  top: CROP,
  right: ART_SIZES.strip.width - SIDE_MARGIN,
  bottom: ART_SIZES.strip.height - CROP,
});

// Garamond for the lettering, Fraktur for the F monogram (watermark, logo, icon).
export const FONTS = Object.freeze({ text: 'EB Garamond', mark: 'UnifrakturMaguntia' });
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=UnifrakturMaguntia&display=block';
const SERIF = `'${FONTS.text}', 'Hoefler Text', Garamond, serif`;
const BLACKLETTER = `'${FONTS.mark}', serif`;

// The renderer waits for these before taking each screenshot.
export const ART_FONTS = Object.freeze({
  strip: Object.freeze([FONTS.text, FONTS.mark]),
  logo: Object.freeze([FONTS.mark]),
  icon: Object.freeze([FONTS.mark]),
});

function page(body, css) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONT_URL}">
<style>html,body{margin:0;background:transparent}#art{font-family:${SERIF};font-kerning:normal}${css}</style>
</head><body>${body}</body></html>`;
}

const raised = 'text-shadow:0 .35px 0 rgba(255,255,255,.8),0 -.3px 0 rgba(0,0,0,.14)';

// Every line is tagged with data-line, and the watermark glyph with data-mark,
// so the renderer can check they all fit inside STRIP_SAFE_AREA.
export function stripHtml({ copy, colors }) {
  const { width, height } = ART_SIZES.strip;
  const css = `
#art{position:relative;box-sizing:border-box;width:${width}px;height:${height}px;padding:${CROP + 3}px 20px;
  display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:${colors.bone};
  color:${colors.ink};text-transform:uppercase;text-align:center;line-height:1}
#art>:not(.mark){position:relative}
#art [data-line]{${raised}}
.mark{position:absolute;inset:0;display:grid;place-items:center;font-family:${BLACKLETTER};font-size:130px;
  opacity:.045}
.mark span{transform:translateY(.042em)}
.corners{display:flex;justify-content:space-between;font-size:7px;letter-spacing:.12em}
.firm{font-size:19px;font-weight:500;letter-spacing:.24em;padding-left:.24em}
.name{font-size:15px;letter-spacing:.2em;padding-left:.2em}
.sub{margin-top:4px;font-size:9px;letter-spacing:.22em;padding-left:.22em}`;

  return page(
    `<div id="art">
  <div class="mark"><span data-mark>${e(copy.monogram)}</span></div>
  <div class="corners"><div data-line="topLeft">${e(copy.topLeft)}</div></div>
  <div class="firm" data-line="firm">${e(copy.firm)}</div>
  <div><div class="name" data-line="name">${e(copy.name)}</div><div class="sub" data-line="title">${e(copy.title)}</div></div>
  <div class="corners"><div data-line="bottomLeft">${e(copy.bottomLeft)}</div><div data-line="bottomRight">${e(copy.bottomRight)}</div></div>
</div>`,
    css,
  );
}

export function logoHtml({ copy, colors }) {
  const css = `
#art{display:inline-flex;align-items:center;height:${ART_SIZES.logo.height}px;padding:0 2px;
  color:${colors.ink};font-family:${BLACKLETTER};font-size:34px}`;
  return page(`<div id="art">${e(copy.monogram)}</div>`, css);
}

export function iconHtml({ copy, colors }) {
  const { width, height } = ART_SIZES.icon;
  const css = `
#art{width:${width}px;height:${height}px;display:grid;place-items:center;background:${colors.bone};
  color:${colors.ink};font-family:${BLACKLETTER};font-size:22px;line-height:1}`;
  return page(`<div id="art">${e(copy.monogram)}</div>`, css);
}
