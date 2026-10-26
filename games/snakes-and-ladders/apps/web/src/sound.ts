// Sound effects synthesised with the Web Audio API: no audio files, nothing to download.
// Browsers only allow audio after a user gesture, so the context is created on the first
// pointer or key press (see `unlockAudio`).

const MUTE_KEY = "doodle-snakes:muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(on: boolean) {
  muted = on;
  try {
    localStorage.setItem(MUTE_KEY, on ? "1" : "0");
  } catch {
    // storage blocked (private window): mute still works for this visit
  }
  if (master && ctx) master.gain.setTargetAtTime(on ? 0 : 0.55, ctx.currentTime, 0.02);
}

export function unlockAudio() {
  // iOS: route Web Audio as media playback so the ring/silent switch does not mute the game
  // (Safari 16.4+; elsewhere this property does not exist and the line is skipped)
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== "playback") session.type = "playback";
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state !== "running") void ctx.resume();
  // iOS only treats the context as unlocked once something has played inside the gesture:
  // play one silent sample
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  blip.connect(ctx.destination);
  blip.start();
}

function ready(): AudioContext | null {
  if (!ctx || !master || muted) return null;
  // iOS suspends ("interrupted") the context when the app is backgrounded or a call comes in
  if (ctx.state !== "running") {
    void ctx.resume();
    return null;
  }
  return ctx;
}

/**
 * Run `play` as soon as audio is running. The first tap of a visit both unlocks audio and starts the
 * game, so the intro begins while iOS is still waking the context (`ready()` would drop every note):
 * wait for the resume, but give up after a moment so the music never lands out of step.
 */
function whenRunning(play: () => void, maxWaitMs = 600) {
  if (!ctx || muted) return;
  if (ctx.state === "running") return play();
  const t0 = performance.now();
  ctx
    .resume()
    .then(() => {
      if (performance.now() - t0 <= maxWaitMs) play();
    })
    .catch(() => undefined);
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  /** glide to this frequency over the note */
  to?: number;
  attack?: number;
  delay?: number;
}

function tone(freq: number, dur: number, { type = "sine", gain = 0.2, to, attack = 0.005, delay = 0 }: ToneOpts = {}) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

interface NoiseOpts {
  freq?: number;
  q?: number;
  gain?: number;
  filter?: BiquadFilterType;
  delay?: number;
  /** sweep the filter to this frequency */
  to?: number;
}

function noise(dur: number, { freq = 2000, q = 1, gain = 0.2, filter = "bandpass", delay = 0, to }: NoiseOpts = {}) {
  const c = ready();
  if (!c || !noiseBuffer) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const bq = c.createBiquadFilter();
  bq.type = filter;
  bq.frequency.setValueAtTime(freq, t);
  if (to) bq.frequency.exponentialRampToValueAtTime(to, t + dur);
  bq.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(env).connect(master!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

interface HeldOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  delay?: number;
  /** lowpass cutoff, to keep pads soft */
  cutoff?: number;
  /** cents, for a slow chorus between two voices */
  detune?: number;
}

/** A sustained note (fade in, hold, fade out), for the pad under the intro tune. */
function held(freq: number, dur: number, { type = "triangle", gain = 0.03, attack = 0.25, release = 0.5, delay = 0, cutoff = 1400, detune = 0 }: HeldOpts = {}) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const lp = c.createBiquadFilter();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp).connect(env).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A music-box pluck: a bright fundamental with a quieter octave above, ringing out. */
function pluck(freq: number, delay: number, gain = 0.07, ring = 0.7) {
  tone(freq, ring, { type: "triangle", gain, delay, attack: 0.004 });
  tone(freq * 2, ring * 0.5, { type: "sine", gain: gain * 0.35, delay, attack: 0.004 });
}

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

// C major pentatonic, two octaves: ladders climb up it
const PENTA = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568, 1760];

export const sfx = {
  /** pencil tap for buttons */
  tap() {
    noise(0.03, { freq: 3200, q: 2, gain: 0.12 });
  },

  /** wooden die rattling in a cup, then landing */
  dice(ms = 650) {
    const hits = 7;
    for (let i = 0; i < hits; i++) {
      const d = (i / hits) * (ms / 1000) * 0.85 + Math.random() * 0.03;
      noise(0.035, { freq: 1800 + Math.random() * 1800, q: 4, gain: 0.14, delay: d });
      tone(700 + Math.random() * 500, 0.03, { type: "triangle", gain: 0.04, delay: d });
    }
    noise(0.06, { freq: 1200, q: 2, gain: 0.22, delay: ms / 1000 - 0.02 });
    tone(220, 0.09, { type: "triangle", gain: 0.12, to: 140, delay: ms / 1000 - 0.02 });
  },

  /** the die clattering down the wooden tower: a knock per baffle, softer taps in the tray */
  tower(ms: number, hits: number[]) {
    noise(0.12, { freq: 900, q: 1, gain: 0.08, delay: 0.02 });
    hits.forEach((h, i) => {
      const inTray = i >= hits.length - 2;
      const d = (h * ms) / 1000;
      tone(inTray ? 260 : 170 + (i % 3) * 40, inTray ? 0.08 : 0.12, { type: "triangle", gain: inTray ? 0.08 : 0.16, to: inTray ? 200 : 110, delay: d });
      noise(0.05, { freq: inTray ? 2600 : 1400 + (i % 2) * 500, q: 3, gain: inTray ? 0.06 : 0.12, delay: d });
    });
  },

  /** a paper sheet unfolding off the desk, then a soft pop as the board lands upright */
  unfold() {
    whenRunning(() => {
      noise(0.55, { freq: 700, q: 0.6, gain: 0.09, to: 3200 });
      tone(140, 0.18, { type: "sine", gain: 0.1, to: 90, delay: 0.5 });
    });
  },

  /** the music-box tune that plays while the board draws itself in */
  introMusic() {
    whenRunning(playIntroTune);
  },

  /** soft springy hop; rises a little each square */
  hop(step: number) {
    const f = 380 + step * 28;
    tone(f, 0.12, { type: "sine", gain: 0.13, to: f * 1.6 });
    tone(120, 0.06, { type: "sine", gain: 0.08, to: 70 });
  },

  land() {
    tone(190, 0.14, { type: "sine", gain: 0.16, to: 85 });
    noise(0.05, { freq: 600, q: 0.8, gain: 0.06 });
  },

  /** one marimba note per rung */
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
    const c = ready();
    if (!c) return;
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
    osc.connect(env).connect(master!);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + seconds + 0.05);
    lfo.stop(t + seconds + 0.05);
  },

  /** cartoon pop as the tail spits the token out */
  spit() {
    tone(180, 0.16, { type: "sine", gain: 0.25, to: 820 });
    noise(0.18, { freq: 900, q: 0.6, gain: 0.1, delay: 0.05, to: 3000 });
  },

  bonk() {
    tone(170, 0.16, { type: "square", gain: 0.05, to: 120 });
    tone(85, 0.18, { type: "sine", gain: 0.12 });
  },

  chime() {
    [659.3, 880, 1318.5].forEach((f, i) => tone(f, 0.3, { type: "sine", gain: 0.1, delay: i * 0.08 }));
  },

  /** sad trombone for a forfeited turn */
  womp() {
    tone(392, 0.28, { type: "triangle", gain: 0.12, to: 370 });
    tone(349, 0.28, { type: "triangle", gain: 0.12, to: 330, delay: 0.3 });
    tone(330, 0.55, { type: "triangle", gain: 0.12, to: 262, delay: 0.6 });
  },

  /** gentle tick when the turn passes */
  turn() {
    tone(740, 0.12, { type: "triangle", gain: 0.06 });
    tone(988, 0.16, { type: "triangle", gain: 0.05, delay: 0.07 });
  },

  win() {
    const notes = [523.3, 659.3, 784, 1046.5];
    notes.forEach((f, i) => tone(f, 0.22, { type: "triangle", gain: 0.13, delay: i * 0.12 }));
    [523.3, 659.3, 784, 1046.5].forEach((f) => tone(f, 0.9, { type: "sine", gain: 0.06, delay: 0.5 }));
    for (let i = 0; i < 6; i++) tone(1800 + Math.random() * 1200, 0.12, { type: "sine", gain: 0.03, delay: 0.55 + i * 0.09 });
  },
};
