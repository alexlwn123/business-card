// Finds a local Chromium-based browser for playwright-core (BROWSER_PATH overrides).
import { existsSync } from 'node:fs';

const BROWSERS = Object.freeze([
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]);

export function findBrowser({ optional = false } = {}) {
  const path = process.env.BROWSER_PATH ?? BROWSERS.find((candidate) => existsSync(candidate));
  if (!path && !optional) throw new Error('No Chromium-based browser found. Set BROWSER_PATH to Chrome, Brave or Edge.');
  return path ?? null;
}
