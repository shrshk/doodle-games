// TV mode: a TV remote has arrow keys, OK (Enter) and Back, but no pointer. Opened with ?tv=1 (the TV app does),
// it stays on for the tab (sessionStorage), so the hub and every game it opens use it. The arrows move focus to the
// nearest control in that direction; OK presses it (buttons and links do that themselves); the focused control gets a
// large outline. Nothing changes on phones and computers, which never pass ?tv=1.

const KEY = "doodle-tv";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export function tvMode(): boolean {
  try {
    if (new URLSearchParams(location.search).get("tv") === "1") sessionStorage.setItem(KEY, "1");
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return new URLSearchParams(location.search).get("tv") === "1";
  }
}

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

/** The best control in that direction from `from`: ahead of it, close along the way and not far to the side. */
export function nearest(from: DOMRect, dir: Dir, rects: DOMRect[]): number {
  const cx = (r: DOMRect) => r.left + r.width / 2;
  const cy = (r: DOMRect) => r.top + r.height / 2;
  let best = -1;
  let bestScore = Infinity;
  rects.forEach((r, i) => {
    const ahead =
      dir === "ArrowRight" ? r.left - from.right : dir === "ArrowLeft" ? from.left - r.right
        : dir === "ArrowDown" ? r.top - from.bottom : from.top - r.bottom;
    if (ahead < -Math.min(from.width, from.height) / 2) return; // behind, or mostly overlapping
    const side = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(cy(r) - cy(from)) : Math.abs(cx(r) - cx(from));
    const score = Math.max(ahead, 0) + 2 * side;
    if (score < bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

/** Turns TV mode on when asked for; returns whether it is on. Call once, early, in each app's main. */
export function startTvRemote(): boolean {
  if (!tvMode()) return false;
  document.documentElement.classList.add("tv");
  window.addEventListener(
    "keydown",
    (e) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
      const first = all[0];
      if (!first) return;
      e.preventDefault();
      const current = active && all.includes(active) ? active : null;
      if (!current) {
        first.focus();
        return;
      }
      const others = all.filter((el) => el !== current);
      const i = nearest(current.getBoundingClientRect(), e.key as Dir, others.map((el) => el.getBoundingClientRect()));
      const next = others[i];
      if (next) {
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    },
    true,
  );
  return true;
}
