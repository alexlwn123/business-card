/**
 * Types and deletes taglines forever, like a 2003 personal homepage.
 */

const TYPE_MS = 60;
const DELETE_MS = 26;
const HOLD_MS = 1500;
const GAP_MS = 280;

export function startTyper(el, phrases) {
  let phrase = 0;
  let chars = 0;
  let deleting = false;
  let timer = null;

  const tick = () => {
    const text = phrases[phrase];
    chars += deleting ? -1 : 1;
    el.textContent = text.slice(0, chars);

    if (!deleting && chars >= text.length) {
      deleting = true;
      timer = setTimeout(tick, HOLD_MS);
    } else if (deleting && chars <= 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      timer = setTimeout(tick, GAP_MS);
    } else {
      timer = setTimeout(tick, deleting ? DELETE_MS : TYPE_MS);
    }
  };

  el.textContent = '';
  tick();
  return () => clearTimeout(timer);
}
