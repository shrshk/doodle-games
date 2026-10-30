// Snakes & Ladders' sounds: the shared doodle effects (@doodle-games/doodle-sound) plus its own
// ladder, snake and intro-tune sounds, synthesised the same way.
import { PENTA, baseSfx, held, noise, pluck, tone, whenRunning, withAudio } from "@doodle-games/doodle-sound";

export { isMuted, setMuted, unlockAudio } from "@doodle-games/doodle-sound";

/**
 * The intro tune, timed to the board drawing itself in (GameScreen's INTRO): one chord per 0.8 s
 * while the grid, the hatching and the pieces arrive (C, A minor, F, G), then home to C as the
 * board is ready at 3.3 s. About 4 s, played once per game, under the sound effects' level.
 */
const INTRO_TUNE = {
  step: 0.2,
  chords: [
    { pad: [261.6, 329.6, 392], bass: 130.8, arp: [659.3, 784, 1046.5, 784] },
    { pad: [220, 261.6, 329.6], bass: 110, arp: [880, 1046.5, 1318.5, 1046.5] },
    { pad: [174.6, 220, 261.6], bass: 87.3, arp: [698.5, 880, 1046.5, 880] },
    { pad: [196, 246.9, 293.7], bass: 98, arp: [784, 987.8, 1174.7, 1568] },
  ],
  /** when the board is ready (GameScreen INTRO stage 6) */
  home: 3.3,
};

function playIntroTune() {
  const { step, chords, home } = INTRO_TUNE;
  const bar = step * 4;
  chords.forEach((ch, i) => {
    const at = i * bar;
    ch.pad.forEach((f) => {
      held(f, bar + 0.35, { delay: at, gain: 0.022, detune: -6 });
      held(f, bar + 0.35, { delay: at, gain: 0.018, detune: 7, type: "sine" });
    });
    tone(ch.bass, 0.5, { type: "sine", gain: 0.07, delay: at, attack: 0.01 });
    tone(ch.bass * 1.5, 0.3, { type: "sine", gain: 0.03, delay: at + bar / 2, attack: 0.01 });
    ch.arp.forEach((f, k) => pluck(f, at + k * step, k === 0 ? 0.08 : 0.06));
  });
  // home: the C chord rings out, a quick bell run on top, a few sparkles as the tokens appear
  [261.6, 329.6, 392, 523.3].forEach((f) => held(f, 1.3, { delay: home, gain: 0.024, attack: 0.05, release: 1 }));
  tone(130.8, 0.9, { type: "sine", gain: 0.08, delay: home, attack: 0.01 });
  [1046.5, 1318.5, 1568, 2093].forEach((f, k) => pluck(f, home + k * 0.07, 0.06, 1.1));
  for (let k = 0; k < 4; k++) tone(2400 + Math.random() * 1400, 0.15, { type: "sine", gain: 0.018, delay: home + 0.35 + k * 0.1 });
}

export const sfx = {
  ...baseSfx,

  /** the music-box tune that plays while the board draws itself in */
  introMusic() {
    whenRunning(playIntroTune);
  },

  /** one marimba note per rung: ladders climb up the pentatonic scale */
  rung(i: number) {
    const f = PENTA[Math.min(PENTA.length - 1, i)]!;
    tone(f, 0.22, { type: "triangle", gain: 0.12 });
    tone(f * 2, 0.08, { type: "sine", gain: 0.03 });
  },

  ladderTop() {
    tone(1568, 0.25, { type: "sine", gain: 0.08 });
    tone(2093, 0.35, { type: "sine", gain: 0.07, delay: 0.09 });
  },

  hiss() {
    noise(0.55, { freq: 5500, q: 0.7, gain: 0.09, filter: "highpass" });
  },

  gulp() {
    tone(320, 0.22, { type: "sine", gain: 0.28, to: 70 });
    noise(0.08, { freq: 400, q: 1, gain: 0.08, delay: 0.02 });
  },

  /** wobbly tummy rumble while the lump travels */
  digest(seconds: number) {
    withAudio((c, out) => {
      const t = c.currentTime;
      const osc = c.createOscillator();
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      const env = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.linearRampToValueAtTime(60, t + seconds);
      lfo.frequency.value = 7;
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain).connect(osc.frequency);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.09, t + 0.15);
      env.gain.setValueAtTime(0.09, t + seconds - 0.2);
      env.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      osc.connect(env).connect(out);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + seconds + 0.05);
      lfo.stop(t + seconds + 0.05);
    });
  },

  /** cartoon pop as the tail spits the token out */
  spit() {
    tone(180, 0.16, { type: "sine", gain: 0.25, to: 820 });
    noise(0.18, { freq: 900, q: 0.6, gain: 0.1, delay: 0.05, to: 3000 });
  },
};
