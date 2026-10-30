// Ludo's sounds: the shared doodle effects (@doodle-games/doodle-sound) plus a token popping out
// of its base, a cut, a token reaching home and a short intro jingle, synthesised the same way.
import { PENTA, baseSfx, held, noise, pluck, tone, whenRunning } from "@doodle-games/doodle-sound";

export { isMuted, setMuted, unlockAudio } from "@doodle-games/doodle-sound";

/** About 2.4 s: four plucked bars over a soft G-C pad while the board draws itself in. */
function playIntroTune() {
  const step = 0.15;
  const bars = [
    [784, 1046.5, 1318.5, 1046.5],
    [880, 1174.7, 1396.9, 1174.7],
    [784, 987.8, 1174.7, 1568],
  ];
  bars.forEach((notes, i) => {
    const at = i * step * 4;
    notes.forEach((f, k) => pluck(f, at + k * step, k === 0 ? 0.08 : 0.06));
    tone([130.8, 146.8, 98][i]!, 0.45, { type: "sine", gain: 0.07, delay: at, attack: 0.01 });
  });
  const home = 1.8;
  [261.6, 329.6, 392, 523.3].forEach((f) => held(f, 1.1, { delay: home, gain: 0.024, attack: 0.05, release: 0.9 }));
  [1046.5, 1318.5, 1568, 2093].forEach((f, k) => pluck(f, home + k * 0.07, 0.06, 1));
}

export const sfx = {
  ...baseSfx,

  introMusic() {
    whenRunning(playIntroTune);
  },

  /** a cork pop as a token comes out of its base onto the start square */
  enter() {
    tone(260, 0.14, { type: "sine", gain: 0.22, to: 760 });
    noise(0.06, { freq: 2400, q: 2, gain: 0.1 });
  },

  /** a cartoon thwack, then a falling whistle as the cut token flies back to its base */
  cut() {
    noise(0.09, { freq: 900, q: 0.8, gain: 0.28 });
    tone(160, 0.12, { type: "square", gain: 0.06, to: 90 });
    tone(1500, 0.6, { type: "sine", gain: 0.07, to: 300, delay: 0.1 });
  },

  /** a little run up the scale as a token reaches the middle */
  home() {
    [0, 2, 4, 5, 7].forEach((n, k) => pluck(PENTA[n]!, k * 0.06, 0.07, 0.8));
  },

  /** which token? a soft tick for each token that can move */
  choose() {
    tone(1318.5, 0.08, { type: "sine", gain: 0.06 });
    tone(1568, 0.1, { type: "sine", gain: 0.05, delay: 0.07 });
  },
};
