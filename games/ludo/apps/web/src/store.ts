import { create } from "zustand";
import { BASE, botMove, createGame, HOME, reduce, type GameEvent, type GameState, type PlayerState, type RuleSet } from "@ludo-doodle/engine";
import { characterName, TOWER_HITS, TOWER_MS, type Mood } from "@doodle-games/ui-doodle";
import { progressPoint, type Pt } from "./board/geometry";
import { loadSetup, saveSetup, type Slot } from "./setup";
import { isMuted, setMuted, sfx } from "./sound";

export type { Slot, SlotKind } from "./setup";

export interface Note {
  id: number;
  text: string;
  tone: "red" | "blue" | "ink";
}

/** The token in flight, in board cell units. */
export interface Moving {
  playerId: string;
  token: number;
  at: Pt;
  /** hop height in cells */
  lift: number;
  /** 0..1 landing squash */
  squash: number;
}

/** Every timing in one place (ms). Reduced motion skips tweens and caps waits. */
export const PACE = {
  diceTumble: TOWER_MS,
  afterDice: 350,
  /** one movable token: it goes by itself after this */
  autoMove: 350,
  hopPerSquare: 240,
  afterLanding: 260,
  enter: 560,
  cutFly: 800,
  home: 700,
  noMove: 1000,
  extraTurn: 750,
  handoff: 950,
  beforeWin: 700,
  botThinkMin: 700,
  botThinkMax: 1200,
  botPick: 650,
} as const;

interface ViewState {
  /** each player's tokens as drawn, which trails the engine while a move plays */
  display: Record<string, number[]>;
  moving: Moving | null;
  moods: Record<string, Mood>;
  /** rollId bumps on every roll so the tower restarts its drop */
  dice: { value: number | null; rolling: boolean; rollId: number };
  notes: Note[];
  /** next player's id while the turn is being handed over */
  handoff: string | null;
  busy: boolean;
  showWin: boolean;
  announcement: string;
  /** bumps after every roll and move, so effects keyed on it re-run */
  turnNo: number;
}

interface Store extends ViewState {
  screen: "home" | "game";
  slots: Slot[];
  rules: RuleSet;
  game: GameState | null;
  /** bumps per started game, so the game screen remounts and replays its intro */
  gameNo: number;
  reducedMotion: boolean;
  introDone: boolean;
  muted: boolean;
  toggleMute(): void;
  setSlot(index: number, patch: Partial<Slot>): void;
  setRules(patch: Partial<RuleSet>): void;
  setReducedMotion(on: boolean): void;
  setIntroDone(): void;
  startGame(): void;
  goHome(): void;
  /** rolls for whoever's turn it is (the screen only offers it to people, and rolls for bots itself) */
  roll(): void;
  /** a person picks which of their tokens to move */
  pick(token: number): void;
}

const current = (g: GameState) => g.players.find((p) => p.id === g.turn.playerId)!;

/** Whether a person at this device may roll right now. */
export function canRollNow(s: Pick<Store, "game" | "busy" | "introDone">): boolean {
  const g = s.game;
  if (!g || s.busy || !s.introDone || g.turn.phase !== "awaitingRoll") return false;
  return !current(g).isBot;
}

/** The tokens a person at this device may tap right now (empty when it is not their pick). */
export function pickable(s: Pick<Store, "game" | "busy">): number[] {
  const g = s.game;
  if (!g || s.busy || g.turn.phase !== "awaitingMove" || current(g).isBot) return [];
  return g.turn.movable;
}

/**
 * The token to move without asking, or null when the choice matters. Ludo King moves by itself
 * when only one token can move; tokens sharing a square (or all still in the base) are one choice.
 */
export function onlyChoice(g: GameState): number | null {
  const me = current(g);
  const spots = new Set(g.turn.movable.map((i) => me.tokens[i]));
  return spots.size === 1 ? g.turn.movable[0]! : null;
}

const freshView = (): ViewState => ({
  display: {},
  moving: null,
  moods: {},
  dice: { value: null, rolling: false, rollId: 0 },
  notes: [],
  handoff: null,
  busy: false,
  showWin: false,
  announcement: "",
  turnNo: 0,
});

const tokensOf = (g: GameState) => Object.fromEntries(g.players.map((p) => [p.id, [...p.tokens]]));

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** Bumped whenever a game starts or ends, so in-flight animations from the old game stop. */
let generation = 0;
let noteId = 0;

export const useGame = create<Store>((set, get) => {
  const live = (gen: number) => gen === generation;
  const reduced = () => get().reducedMotion;

  const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, reduced() ? Math.min(ms, 250) : ms));

  const tween = (ms: number, onFrame: (t: number) => void, gen: number) =>
    new Promise<void>((res) => {
      if (reduced() || ms <= 0) {
        onFrame(1);
        res();
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        if (!live(gen)) return res();
        // rAF timestamps are frame-start times and can predate t0, so clamp at 0 too
        const t = Math.max(0, Math.min(1, (now - t0) / ms));
        onFrame(t);
        if (t < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });

  const later = (ms: number, gen: number, fn: () => void) =>
    setTimeout(() => {
      if (live(gen)) fn();
    }, ms);

  const note = (text: string, tone: Note["tone"], gen: number, ms = 1600) => {
    const id = ++noteId;
    set((s) => ({ notes: [...s.notes.slice(-1), { id, text, tone }] }));
    later(ms, gen, () => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })));
  };

  const setMood = (playerId: string, mood: Mood, gen: number, resetAfter?: number) => {
    set((s) => ({ moods: { ...s.moods, [playerId]: mood } }));
    if (resetAfter) later(resetAfter, gen, () => set((s) => ({ moods: { ...s.moods, [playerId]: "idle" } })));
  };

  const place = (playerId: string, token: number, progress: number) =>
    set((s) => {
      const tokens = [...(s.display[playerId] ?? [])];
      tokens[token] = progress;
      return { display: { ...s.display, [playerId]: tokens } };
    });

  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  /** One continuous tween along the path: each square is a hop with eased travel and an arc. */
  async function hop(player: PlayerState, token: number, from: number, to: number, gen: number) {
    const spots = Array.from({ length: to - from + 1 }, (_, k) => progressPoint(player.seat, token, from + k));
    const steps = spots.length - 1;
    let lastStep = -1;
    await tween(
      steps * PACE.hopPerSquare,
      (t) => {
        const x = Math.min(steps - 1e-9, t * steps);
        const k = Math.floor(x);
        const local = x - k;
        if (k !== lastStep) {
          lastStep = k;
          sfx.hop(k);
        }
        const squash = local > 0.86 ? (1 - local) * 6 : local < 0.08 ? local * 6 : 0;
        set({
          moving: { playerId: player.id, token, at: lerp(spots[k]!, spots[k + 1]!, easeInOut(local)), lift: Math.sin(Math.PI * local) * 0.4, squash: Math.min(1, squash) },
        });
      },
      gen,
    );
    sfx.land();
    place(player.id, token, to);
    set({ moving: null });
  }

  /** A single arc between two progress points (out of the base, back to the base). */
  async function arc(player: PlayerState, token: number, from: number, to: number, ms: number, height: number, gen: number) {
    const a = progressPoint(player.seat, token, from);
    const b = progressPoint(player.seat, token, to);
    await tween(
      ms,
      (t) => set({ moving: { playerId: player.id, token, at: lerp(a, b, easeInOut(t)), lift: Math.sin(Math.PI * t) * height, squash: t > 0.9 ? (1 - t) * 8 : 0 } }),
      gen,
    );
    place(player.id, token, to);
    set({ moving: null });
  }

  async function play(events: GameEvent[], gen: number) {
    const g = get().game!;
    const byId = (id: string) => g.players.find((p) => p.id === id)!;
    const said: string[] = [];

    for (const e of events) {
      if (!live(gen)) return;
      switch (e.type) {
        case "ROLLED":
          if (reduced()) set((s) => ({ dice: { value: e.value, rolling: false, rollId: s.dice.rollId + 1 } }));
          else {
            set((s) => ({ dice: { value: e.value, rolling: true, rollId: s.dice.rollId + 1 } }));
            sfx.tower(PACE.diceTumble, TOWER_HITS);
            await wait(PACE.diceTumble);
            set((s) => ({ dice: { ...s.dice, value: e.value, rolling: false } }));
            await wait(PACE.afterDice);
          }
          said.push(`${byId(e.playerId).name} rolled ${e.value}.`);
          break;
        case "ENTERED":
          sfx.enter();
          await arc(byId(e.playerId), e.token, BASE, 0, PACE.enter, 1.1, gen);
          said.push("A token comes out.");
          await wait(PACE.afterLanding);
          break;
        case "MOVED":
          await hop(byId(e.playerId), e.token, e.from, e.to, gen);
          said.push(e.to === HOME ? "" : `Moves ${e.to - e.from}.`);
          await wait(PACE.afterLanding);
          break;
        case "CUT": {
          const victim = byId(e.victimId);
          note(`cut! ${victim.name} goes home`, "red", gen, 2000);
          sfx.cut();
          setMood(e.playerId, "happy", gen, 1600);
          setMood(e.victimId, "dizzy", gen, 1800);
          await arc(victim, e.victimToken, e.from, BASE, PACE.cutFly, 2.2, gen);
          sfx.bonk();
          said.push(`Cuts ${victim.name}'s token.`);
          break;
        }
        case "HOME":
          note("home!", "blue", gen);
          sfx.home();
          setMood(e.playerId, "happy", gen, 1400);
          said.push("A token reaches home.");
          await wait(PACE.home);
          break;
        case "NO_MOVE":
          if (e.reason === "threeSixes") {
            note("three 6s... turn lost", "red", gen);
            sfx.womp();
            setMood(e.playerId, "surprised", gen, 1200);
            said.push("Three sixes, turn lost.");
          } else {
            note(byId(e.playerId).tokens.every((t) => t === BASE) ? "need a 6 to come out" : "no move", "ink", gen);
            sfx.bonk();
            said.push("No move.");
          }
          await wait(PACE.noMove);
          break;
        case "EXTRA_TURN":
          note(e.reason === "cut" ? "cut bonus: roll again" : e.reason === "home" ? "home bonus: roll again" : "a 6! roll again", "blue", gen);
          sfx.chime();
          said.push("Rolls again.");
          await wait(PACE.extraTurn);
          break;
        case "WON":
          setMood(e.playerId, "happy", gen);
          said.push(`${byId(e.playerId).name} ${e.place === 1 ? "wins" : `finishes #${e.place}`}!`);
          break;
        case "RESIGNED":
        case "GAME_OVER":
          break;
      }
    }
    set({ announcement: said.filter(Boolean).join(" ") });
  }

  /** Plays `events`, then settles the engine and hands over the turn, whatever the drawing does. */
  function run(prev: GameState, next: GameState, events: GameEvent[]) {
    const gen = generation;
    set((s) => ({ game: next, busy: true, turnNo: s.turnNo + 1 }));
    // a drawing bug must never freeze the game: log it and still finish the turn from engine state
    void play(events, gen)
      .catch((err: unknown) => console.error("event_playback_failed", err))
      .then(() => {
        if (!live(gen)) return;
        let after = get().game!;
        if (after.turn.phase === "awaitingMove") return awaitPick(after, gen);
        if (after.turn.phase === "animating") after = reduce(after, { type: "ANIMATION_DONE" }).state;
        return finishTurn(prev.turn.playerId, after, gen);
      });
  }

  /** After a roll with moves: bots pick, a lone choice goes by itself, people tap a token. */
  async function awaitPick(g: GameState, gen: number) {
    const me = current(g);
    if (me.isBot) {
      await wait(PACE.botPick);
      const token = botMove(g);
      if (live(gen) && token !== null) move(token);
      return;
    }
    const only = onlyChoice(g);
    if (only !== null) {
      await wait(PACE.autoMove);
      if (live(gen)) move(only);
      return;
    }
    sfx.choose();
    note("pick a token", "ink", gen, 1300);
    set({ busy: false, turnNo: get().turnNo + 1 });
  }

  function move(token: number) {
    const g = get().game!;
    const result = reduce(g, { type: "MOVE", playerId: g.turn.playerId, token });
    if (result.error) return;
    run(g, result.state, result.events);
  }

  async function finishTurn(prevPlayerId: string, after: GameState, gen: number) {
    set((st) => ({ game: after, moving: null, display: tokensOf(after), turnNo: st.turnNo + 1 }));
    if (after.turn.phase === "gameOver") {
      await wait(PACE.beforeWin);
      if (live(gen)) {
        set({ busy: false, showWin: true });
        sfx.win();
      }
      return;
    }
    const next = current(after);
    if (next.id !== prevPlayerId) {
      note(`${next.name}'s turn`, "ink", gen, PACE.handoff + 300);
      sfx.turn();
      set((st) => ({ handoff: next.id, announcement: `${st.announcement} ${next.name}'s turn.` }));
      await wait(PACE.handoff);
    }
    if (live(gen)) set({ handoff: null, busy: false });
  }

  return {
    ...freshView(),
    screen: "home",
    ...loadSetup(),
    game: null,
    gameNo: 0,
    reducedMotion: false,
    introDone: false,
    muted: isMuted(),

    toggleMute: () => {
      const next = !get().muted;
      setMuted(next);
      set({ muted: next });
      if (!next) sfx.tap();
    },

    setSlot: (index, patch) => {
      set((s) => ({ slots: s.slots.map((sl, i) => (i === index ? { ...sl, ...patch } : sl)) }));
      saveSetup(get());
    },

    setRules: (patch) => {
      set((s) => ({ rules: { ...s.rules, ...patch } }));
      saveSetup(get());
    },

    setReducedMotion: (on) => set({ reducedMotion: on }),

    setIntroDone: () => set({ introDone: true }),

    startGame: () => {
      generation++;
      const { slots, rules } = get();
      const players = slots
        .map((sl, seat) => ({ sl, seat }))
        .filter(({ sl }) => sl.kind !== "off")
        .map(({ sl, seat }) => ({
          id: `p${seat}`,
          name: sl.name.trim() || characterName[sl.color],
          color: sl.color,
          seat,
          isBot: sl.kind === "bot",
        }));
      const game = createGame({ players, rules, seed: randomSeed() });
      set((st) => ({ ...freshView(), screen: "game", game, gameNo: st.gameNo + 1, introDone: false, display: tokensOf(game) }));
    },

    goHome: () => {
      generation++;
      set({ ...freshView(), screen: "home", game: null });
    },

    roll: () => {
      const s = get();
      const g = s.game;
      if (!g || s.busy || !s.introDone || g.turn.phase !== "awaitingRoll") return;
      const result = reduce(g, { type: "ROLL", playerId: g.turn.playerId });
      if (result.error) return;
      run(g, result.state, result.events);
    },

    pick: (token) => {
      if (!pickable(get()).includes(token)) return;
      sfx.tap();
      move(token);
    },
  };
});
