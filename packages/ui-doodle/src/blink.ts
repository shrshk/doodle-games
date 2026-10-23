/**
 * Eyes blink one face at a time, on a timer. A CSS animation on every eye (36 on a full board) keeps
 * the browser restyling and repainting each eye every frame, even while it is open; on iPhones that
 * meant re-running the crayon filter of every snake and token, every frame. Here only the face
 * that blinks is touched, for 180 ms, every couple of seconds.
 *
 * Returns a stop function. Does nothing under prefers-reduced-motion.
 */
export function startBlinking(minGapMs = 1400, maxGapMs = 3200): () => void {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  let timer: ReturnType<typeof setTimeout>;
  const next = () => {
    timer = setTimeout(() => {
      const eyes = document.querySelectorAll<SVGGElement>(".doodle-blink:not(.blinking)");
      const pick = eyes[Math.floor(Math.random() * eyes.length)];
      // both eyes of a face are siblings: blink them together
      const face = pick ? Array.from(pick.parentElement?.querySelectorAll<SVGGElement>(":scope > .doodle-blink") ?? [pick]) : [];
      face.forEach((e) => e.classList.add("blinking"));
      setTimeout(() => face.forEach((e) => e.classList.remove("blinking")), 200);
      next();
    }, minGapMs + Math.random() * (maxGapMs - minGapMs));
  };
  next();
  return () => clearTimeout(timer);
}
