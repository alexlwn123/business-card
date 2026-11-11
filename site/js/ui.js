/**
 * Small DOM helpers: rendering, one-shot Web Animations, palette lookup.
 */

const PERSPECTIVE = 'perspective(900px)';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function decorative(node) {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function renderLinks(nav, links, onPress) {
  const nodes = links.map((link, i) => {
    const anchor = el('a', link.vip ? 'link link--vip' : 'link');
    anchor.href = link.href;
    anchor.dataset.id = link.id;
    anchor.style.setProperty('--i', String(i));

    const text = el('span', 'link__text');
    text.append(el('span', 'link__label', link.label), el('span', 'link__sub', link.sub));
    anchor.append(
      decorative(el('span', 'link__emoji', link.emoji)),
      text,
      decorative(el('span', 'link__arrow', '→')),
    );
    anchor.addEventListener('pointerdown', (event) => onPress(event, link));
    return anchor;
  });
  nav.replaceChildren(...nodes);
}

export function fillMarquees(tracks, text, copies = 3) {
  const chunk = text.repeat(copies);
  tracks.forEach((track) => {
    track.replaceChildren(
      el('span', 'marquee__chunk', chunk),
      decorative(el('span', 'marquee__chunk', chunk)),
    );
  });
}

export function rollCounter(node, target, durationMs = 1800) {
  const digits = Math.max(node.textContent.length, String(target).length);
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = String(Math.round(target * eased)).padStart(digits, '0');
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function flash(node, peak = 0.9) {
  node.animate([{ opacity: peak }, { opacity: 0 }], { duration: 550, easing: 'ease-out' });
}

export function shake(node, intensity = 10) {
  const jitter = () => (Math.random() - 0.5) * 2 * intensity;
  const frames = Array.from({ length: 9 }, () => ({
    transform: `translate(${jitter()}px, ${jitter()}px) rotate(${jitter() / 6}deg)`,
  }));
  node.animate([{ transform: 'none' }, ...frames, { transform: 'none' }], {
    duration: 520,
    easing: 'linear',
  });
}

export function spin(node) {
  node.animate(
    [
      { transform: `${PERSPECTIVE} rotateY(0deg) scale(1)` },
      { transform: `${PERSPECTIVE} rotateY(360deg) scale(1.18)`, offset: 0.5 },
      { transform: `${PERSPECTIVE} rotateY(720deg) scale(1)` },
    ],
    { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
}

export function readPalette(varNames) {
  const styles = getComputedStyle(document.documentElement);
  return varNames.map((name) => styles.getPropertyValue(name).trim()).filter(Boolean);
}

export function center(node) {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
