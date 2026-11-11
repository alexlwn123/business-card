/**
 * Fake BIOS boot screen. Resolves when done, or early when tapped.
 */

const LINE_MS = 280;
const HOLD_MS = 420;

function appendLine(log, text, isFinal) {
  const row = document.createElement('div');
  row.className = isFinal ? 'boot__line boot__line--final' : 'boot__line';
  row.textContent = text;
  log.append(row);
}

export function runBoot(overlay, log, lines) {
  return new Promise((resolve) => {
    let timers = [];
    const finish = () => {
      timers.forEach(clearTimeout);
      timers = [];
      overlay.removeEventListener('pointerdown', finish);
      resolve();
    };

    overlay.addEventListener('pointerdown', finish);
    timers = [
      ...lines.map((line, i) =>
        setTimeout(() => appendLine(log, line, i === lines.length - 1), (i + 1) * LINE_MS),
      ),
      setTimeout(finish, lines.length * LINE_MS + HOLD_MS),
    ];
  });
}

export function dismissBoot(overlay, { instant = false } = {}) {
  if (instant) {
    overlay.remove();
    return;
  }
  const onEnd = (event) => {
    if (event.target !== overlay) return; // ignore child animations bubbling up
    overlay.removeEventListener('animationend', onEnd);
    overlay.remove();
  };
  overlay.addEventListener('animationend', onEnd);
  overlay.classList.add('is-done');
}
