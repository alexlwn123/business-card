/**
 * Checks the measured lines of the strip (CSS px boxes relative to the strip)
 * against the area Wallet always shows, so the lettering never gets clipped
 * or runs into itself. Backdrop boxes (the watermark) sit behind the lettering,
 * so they only have to stay inside the area.
 */
const inside = (box, area) =>
  box.left >= area.left && box.right <= area.right && box.top >= area.top && box.bottom <= area.bottom;

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function layoutProblems(lines, area, { backdrop = [] } = {}) {
  const outside = [...lines, ...backdrop]
    .filter((box) => !inside(box, area))
    .map((box) => `${box.name} spills outside the visible strip`);
  const collisions = lines.flatMap((a, i) =>
    lines.slice(i + 1).filter((b) => overlaps(a, b)).map((b) => `${a.name} overlaps ${b.name}`),
  );
  return [...outside, ...collisions];
}
