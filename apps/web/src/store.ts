import { create } from "zustand";
import type { Board } from "@snakes-doodle/boards";
import { createGame, reduce, trackFromBoard, type GameEvent, type GameState, type PlayerState, type RuleSet } from "@snakes-doodle/engine";
import { PACE, type PublicGame, type RoomView, type StartedMessage, type TurnMessage } from "@snakes-doodle/protocol";
import { characterName, TOWER_HITS, type Mood, type TokenColor } from "@snakes-doodle/ui-doodle";
import { buildBoardArt, type BoardArt } from "./board/art";
import type { Meal } from "./board/Snake";
import { boardById, loadSetup, saveSetup, type Slot, type Theme } from "./setup";
import { isMuted, setMuted, sfx } from "./sound";
import { cellCenter, flatDist, lerpFlat, startSpot, type FlatPt } from "./board/geometry";
import { createRoom, describeError, forgetRoom, joinRoom, rememberRoom, resumeRoom, type GameRoom } from "./net/online";

export type { Slot, SlotKind } from "./setup";

export interface Note {
  id: number;
  text: string;
  tone: "red" | "blue" | "ink";
}

/** The token currently in flight, in flat board coordinates. */
export interface Moving {
  playerId: string;
  at: FlatPt;
  /** hop height in cells */
  lift: number;
  /** 0..1 landing squash */
  squash: number;
  /** size multiplier, for being swallowed and spat out */
  scale?: number;
  /** inside a snake */
  hidden?: boolean;
}

/**
 * Every timing in one place (ms), shared with the online server so it knows how long a turn
 * plays on screen. Reduced motion skips tweens and caps waits.
 */
export { PACE };

export const DEFAULT_CAPTION = "the whale keeps the sleepers";

interface ViewState {
  display: Record<string, number>;
  moving: Moving | null;
  moods: Record<string, Mood>;
  /** rollId bumps on every roll so the tower restarts its drop */
  dice: { value: number | null; rolling: boolean; rollId: number };
  notes: Note[];
  caption: string;
  bigMoment: string | null;
  sunGrin: boolean;
  potatoesAwake: boolean;
  trail: FlatPt[];
  destination: number | null;
  activeSnake: number | null;
  /** player climbing a ladder right now (the light layer follows them with a glow) */
  climber: string | null;
  meal: Meal | null;
  /** next player's id while the turn is being handed over */
  handoff: string | null;
  busy: boolean;
  showWin: boolean;
  announcement: string;
  /** bumps after every finished turn (online states carry no log to count) */
  turnNo: number;
}

/** A room on the game server: the synced room state plus this tab's view of the turn clock. */
export interface OnlineState {
  status: "idle" | "connecting" | "in-room" | "reconnecting";
  view: RoomView | null;
  /** this tab's player (session) id */
  me: string;
  error: string;
  /** local Date.now() ms when this tab may roll next, and when the turn timer runs out (0 = none) */
  rollOpensAt: number;
  deadline: number;
  /** a roll is on its way to the server */
  rollSent: boolean;
}

export type OnlineMessage = "seat" | "name" | "addBot" | "removeBot" | "start" | "lobby";

interface Store extends ViewState {
  screen: "home" | "game" | "online";
  slots: Slot[];
  board: Board;
  art: BoardArt;
  rules: RuleSet;
  theme: Theme;
  toggleTheme(): void;
  game: GameState | null;
  /** bumps per started game, so the game screen remounts and replays its intro */
  gameNo: number;
  reducedMotion: boolean;
  introDone: boolean;
  muted: boolean;
  toggleMute(): void;
  setSlot(index: number, patch: Partial<Slot>): void;
  selectBoard(id: string): void;
  setRules(patch: Partial<RuleSet>): void;
  setReducedMotion(on: boolean): void;
  setIntroDone(): void;
  startGame(): void;
  goHome(): void;
  roll(): void;
  online: OnlineState | null;
  /** the online page, not yet in a room */
  openOnline(): void;
  hostOnline(name: string): Promise<void>;
  joinOnline(code: string, name: string): Promise<void>;
  /** back into the room a refresh left, if any; true when it worked */
  resumeOnline(): Promise<boolean>;
  leaveOnline(): void;
  sendOnline(type: OnlineMessage, payload?: object): void;
}

/** Whether this tab may roll right now: local turns any human's, online only its own seat once the server opens the roll. */
export function canRollNow(s: Pick<Store, "game" | "busy" | "introDone" | "online">, now = Date.now()): boolean {
  const g = s.game;
  if (!g || s.busy || !s.introDone || g.turn.phase !== "awaitingRoll") return false;
  const current = g.players.find((p) => p.id === g.turn.playerId);
  if (!current) return false;
  if (!s.online) return !current.isBot;
  return current.id === s.online.me && !s.online.rollSent && now >= s.online.rollOpensAt;
}

const freshView = (): ViewState => ({
  display: {},
  moving: null,
  moods: {},
  dice: { value: null, rolling: false, rollId: 0 },
  notes: [],
  caption: DEFAULT_CAPTION,
  bigMoment: null,
  sunGrin: false,
  potatoesAwake: false,
  trail: [],
  destination: null,
  activeSnake: null,
  climber: null,
  meal: null,
  handoff: null,
  busy: false,
  showWin: false,
  announcement: "",
  turnNo: 0,
});

const positionsOf = (g: GameState) => Object.fromEntries(g.players.map((p) => [p.id, p.position]));

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** An online state as an engine state: the server keeps the RNG and log, nothing here needs them. */
const fromPublic = (g: PublicGame): GameState => ({ ...g, rng: { seed: 0, cursor: 0 }, log: [] });

/** Rebuild the game from the synced room state alone, for a tab that comes back mid-game. */
function gameFromView(view: RoomView, board: Board): GameState {
  const players = view.turnOrder
    .map((id) => view.players[id])
    .filter((p) => !!p)
    .map((p) => ({ id: p.id, name: p.name, color: p.color, position: p.position, isBot: p.isBot, finishedPlace: p.place || undefined }));
  return {
    boardId: board.id,
    rules: JSON.parse(view.rulesJson) as RuleSet,
    track: trackFromBoard(board),
    players,
    turn: {
      playerId: view.currentPlayerId || players[0]!.id,
      consecutiveSixes: 0,
      phase: view.phase === "finished" ? "gameOver" : "awaitingRoll",
      startPosition: 0,
      extraTurn: false,
    },
    rng: { seed: 0, cursor: 0 },
    log: [],
  };
}

/** The open room lives outside the store: it is a connection, not state to render. */
let room: GameRoom | null = null;
/** Turns from the server wait here and play one at a time, at the client's own pace. */
let turnQueue: { msg: TurnMessage; at: number }[] = [];
let draining = false;
let lastSeq = 0;

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

  const note = (text: string, tone: Note["tone"], gen: number, ms = 1700) => {
    const id = ++noteId;
    set((s) => ({ notes: [...s.notes.slice(-1), { id, text, tone }] }));
    later(ms, gen, () => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })));
  };

  const setMood = (playerId: string, mood: Mood, gen: number, resetAfter?: number) => {
    set((s) => ({ moods: { ...s.moods, [playerId]: mood } }));
    if (resetAfter) later(resetAfter, gen, () => set((s) => ({ moods: { ...s.moods, [playerId]: "idle" } })));
  };

  const bigMoment = (text: string, gen: number) => {
    set({ bigMoment: text });
    later(2200, gen, () => set((s) => (s.bigMoment === text ? { bigMoment: null } : {})));
  };

  const spot = (player: PlayerState, square: number): FlatPt => {
    const g = get().game!;
    return square === 0
      ? startSpot(get().board.grid, g.players.findIndex((p) => p.id === player.id))
      : cellCenter(get().board.grid, square);
  };

  let trailGen = 0;
  const pushTrail = (p: FlatPt) =>
    set((s) => {
      const last = s.trail[s.trail.length - 1];
      return last && flatDist(last, p) < 0.11 ? {} : { trail: [...s.trail, p] };
    });
  const fadeTrail = (gen: number) => {
    const mine = ++trailGen;
    later(1400, gen, () => {
      if (mine === trailGen) set({ trail: [] });
    });
  };

  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /** One continuous tween across the whole path: each square is a hop with eased travel and an arc. */
  async function hop(player: PlayerState, squares: number[], gen: number) {
    const spots = squares.map((sq) => spot(player, sq));
    const steps = spots.length - 1;
    if (steps < 1) return;
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
        const at = lerpFlat(spots[k]!, spots[k + 1]!, easeInOut(local));
        pushTrail(at);
        const squash = local > 0.86 ? (1 - local) * 6 : local < 0.08 ? local * 6 : 0;
        set({ moving: { playerId: player.id, at, lift: Math.sin(Math.PI * local) * 0.42, squash: Math.min(1, squash) } });
      },
      gen,
    );
    sfx.land();
    set((s) => ({ display: { ...s.display, [player.id]: squares[steps]! } }));
  }

  async function jump(player: PlayerState, from: number, to: number, gen: number, lift = 0.9) {
    const a = spot(player, from);
    const b = spot(player, to);
    await tween(
      PACE.forfeitJump,
      (t) => set({ moving: { playerId: player.id, at: lerpFlat(a, b, easeInOut(t)), lift: Math.sin(Math.PI * t) * lift, squash: 0 } }),
      gen,
    );
    set((s) => ({ display: { ...s.display, [player.id]: to } }));
  }

  async function climb(player: PlayerState, from: number, to: number, gen: number) {
    const ladder = get().art.ladders.find((l) => l.from === from);
    if (!ladder) return jump(player, from, to, gen);
    const n = ladder.rungAt.length;
    let lastRung = -1;
    set({ climber: player.id });
    await tween(
      n * PACE.rung + PACE.rung,
      (t) => {
        // rung by rung: a quick step, then a breath on each rung
        const k = Math.min(n, Math.floor(t * n));
        const frac = t * n - k;
        if (k !== lastRung && k < n) {
          lastRung = k;
          sfx.rung(k);
        }
        const p = Math.min(1, (k + Math.min(1, frac * 1.6)) / n);
        set({ moving: { playerId: player.id, at: lerpFlat(ladder.foot, ladder.top, p), lift: 0, squash: 0 } });
      },
      gen,
    );
    sfx.ladderTop();
    set((s) => ({ display: { ...s.display, [player.id]: to }, climber: null }));
  }

  /** The snake swallows the token at its head, a lump carries it down the body, the tail spits it out. */
  async function slide(player: PlayerState, from: number, to: number, gen: number) {
    const index = get().art.snakes.findIndex((sn) => sn.from === from);
    const snake = get().art.snakes[index];
    if (!snake) return jump(player, from, to, gen);
    const color = player.color as TokenColor;
    // aim for the mouth, a little ahead of the head's centre
    const c0 = snake.centerline[0]!;
    const c3 = snake.centerline[Math.min(3, snake.centerline.length - 1)]!;
    const dl = Math.hypot(c0.c - c3.c, c0.r - c3.r) || 1;
    const head = { c: c0.c + ((c0.c - c3.c) / dl) * 0.18, r: c0.r + ((c0.r - c3.r) / dl) * 0.18 };
    const tail = snake.centerline[snake.bodyCount - 1]!;
    const start = spot(player, from);
    set({ activeSnake: index });
    sfx.hiss();
    let gulped = false;

    await tween(
      PACE.chomp,
      (t) => {
        // a beat of surprise, then pulled into the mouth
        const pull = t < 0.35 ? 0 : easeInOut((t - 0.35) / 0.65);
        if (!gulped && t >= 0.8) {
          gulped = true;
          sfx.gulp();
        }
        set({
          meal: { index, phase: "chomp", t, color },
          moving: { playerId: player.id, at: lerpFlat(start, head, pull), lift: t < 0.35 ? Math.sin((t / 0.35) * Math.PI) * 0.25 : 0, squash: 0, scale: 1 - pull * 0.85 },
        });
      },
      gen,
    );
    if (!live(gen)) return;
    set({ moving: { playerId: player.id, at: head, lift: 0, squash: 0, hidden: true } });
    const digestMs = Math.max(PACE.digestMin, snake.length * PACE.digestPerCell);
    if (!reduced()) sfx.digest(digestMs / 1000);
    await tween(
      digestMs,
      (t) => set({ meal: { index, phase: "digest", t, color } }),
      gen,
    );
    if (!live(gen)) return;
    const end = spot(player, to);
    sfx.spit();
    await tween(
      PACE.spit,
      (t) => {
        const pop = t < 0.6 ? easeInOut(t / 0.6) * 1.18 : 1.18 - ((t - 0.6) / 0.4) * 0.18;
        set({
          meal: { index, phase: "spit", t, color },
          moving: { playerId: player.id, at: lerpFlat(tail, end, easeInOut(t)), lift: Math.sin(Math.PI * t) * 0.35, squash: 0, scale: Math.max(0.15, pop) },
        });
      },
      gen,
    );
    set((s) => ({ display: { ...s.display, [player.id]: to }, activeSnake: null, meal: null }));
  }

  async function play(events: GameEvent[], gen: number) {
    const g = get().game!;
    const nameOf = (id: string) => g.players.find((p) => p.id === id)?.name ?? "someone";
    const said: string[] = [];

    for (const e of events) {
      if (!live(gen)) return;
      const player = "playerId" in e ? g.players.find((p) => p.id === e.playerId) : undefined;
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
          said.push(`${nameOf(e.playerId)} rolled ${e.value}.`);
          break;
        case "MOVED":
          set({ destination: e.to });
          await wait(PACE.beforeHop);
          await hop(player!, [e.from, ...e.path], gen);
          set({ moving: null, destination: null });
          fadeTrail(gen);
          await wait(PACE.afterLanding);
          said.push(`Moves to ${e.to}.`);
          break;
        case "LADDER":
          note("up the ladder!", "blue", gen);
          set({ sunGrin: true, caption: `${nameOf(e.playerId)} found a ladder` });
          later(2400, gen, () => set({ sunGrin: false }));
          if (e.from === get().art.longestLadder) bigMoment("the longest ladder", gen);
          setMood(e.playerId, "happy", gen);
          await climb(player!, e.from, e.to, gen);
          set({ moving: null });
          setMood(e.playerId, "happy", gen, 1400);
          await wait(PACE.afterLanding);
          said.push(`Ladder! Climbs to ${e.to}.`);
          break;
        case "SNAKE":
          note("oops, snake! gulp!", "red", gen, 2600);
          set({ potatoesAwake: true, caption: `the snake says hi to ${nameOf(e.playerId)}` });
          later(4200, gen, () => set({ potatoesAwake: false }));
          if (e.from === get().art.longestSnake) bigMoment("the longest snake", gen);
          setMood(e.playerId, "dizzy", gen);
          await slide(player!, e.from, e.to, gen);
          set({ moving: null });
          setMood(e.playerId, "dizzy", gen, 1600);
          await wait(PACE.afterLanding);
          said.push(`Snake! Slides down to ${e.to}.`);
          break;
        case "BLOCKED":
          note(e.reason === "overshoot" ? "too far! need exact" : "need a 6 to start", "ink", gen);
          sfx.bonk();
          said.push(e.reason === "overshoot" ? "Too far, stays put." : "Needs a 6 to start.");
          await wait(PACE.blocked);
          break;
        case "EXTRA_TURN":
          note("a six! roll again?", "blue", gen);
          sfx.chime();
          set({ caption: `six! ${nameOf(e.playerId)} goes again` });
          said.push("Rolled a six, rolls again.");
          await wait(PACE.extraTurn);
          break;
        case "TURN_FORFEITED":
          note("three sixes... turn lost", "red", gen);
          sfx.womp();
          set({ caption: "three sixes is too many" });
          setMood(e.playerId, "surprised", gen, 1200);
          await jump(player!, get().display[e.playerId] ?? 0, e.to, gen);
          set({ moving: null });
          said.push(`Three sixes, back to ${e.to === 0 ? "the start" : e.to}.`);
          break;
        case "WON":
          set({ caption: `${nameOf(e.playerId)} is home` });
          setMood(e.playerId, "happy", gen);
          said.push(`${nameOf(e.playerId)} wins!`);
          break;
        case "TURN_SKIPPED":
        case "RESIGNED":
        case "GAME_OVER":
          break;
      }
    }
    set({ announcement: said.join(" ") });
  }

  return {
    ...freshView(),
    screen: "home",
    ...(() => {
      const saved = loadSetup();
      return { slots: saved.slots, board: saved.board, art: buildBoardArt(saved.board), rules: saved.rules, theme: saved.theme };
    })(),
    game: null,
    gameNo: 0,
    reducedMotion: false,
    muted: isMuted(),

    toggleMute: () => {
      const next = !get().muted;
      setMuted(next);
      set({ muted: next });
      if (!next) sfx.tap();
    },
    introDone: false,

    setSlot: (index, patch) => {
      set((s) => ({ slots: s.slots.map((sl, i) => (i === index ? { ...sl, ...patch } : sl)) }));
      saveSetup(get());
    },

    selectBoard: (id) => {
      const board = boardById(id);
      set({ board, art: buildBoardArt(board) });
      saveSetup(get());
    },

    toggleTheme: () => {
      set((s) => ({ theme: s.theme === "night" ? "day" : "night" }));
      saveSetup(get());
    },

    setRules: (patch) => {
      set((s) => ({ rules: { ...s.rules, ...patch } }));
      saveSetup(get());
    },

    setReducedMotion: (on) => set({ reducedMotion: on }),

    setIntroDone: () => {
      set({ introDone: true });
      // the first server turn may have arrived while the board was still drawing itself in
      void drain();
    },

    startGame: () => {
      generation++;
      const { slots, board, rules } = get();
      const players = slots
        .map((sl, i) => ({ sl, i }))
        .filter(({ sl }) => sl.kind !== "off")
        .map(({ sl, i }) => ({
          id: `p${i}`,
          name: sl.name.trim() || characterName[sl.color],
          color: sl.color,
          isBot: sl.kind === "bot",
        }));
      const game = createGame({ board, players, rules, seed: randomSeed() });
      set((st) => ({ ...freshView(), screen: "game", game, gameNo: st.gameNo + 1, introDone: false, display: positionsOf(game) }));
    },

    goHome: () => {
      if (get().online) return get().leaveOnline();
      generation++;
      set({ ...freshView(), screen: "home", game: null });
    },

    roll: () => {
      const s = get();
      const g = s.game;
      // locally this also rolls for bots; canRollNow is the "may a person here roll" check
      if (!g || s.busy || !s.introDone || g.turn.phase !== "awaitingRoll") return;
      if (s.online) {
        if (!canRollNow(s)) return;
        // the server rolls; its turn message comes back to every tab, this one included
        room?.send("roll");
        set({ online: { ...s.online, rollSent: true } });
        return;
      }
      const result = reduce(g, { type: "ROLL", playerId: g.turn.playerId });
      if (result.error) return;
      const gen = generation;
      set({ game: result.state, busy: true });
      // a drawing bug must never freeze the game: log it and still finish the turn from engine state
      void play(result.events, gen)
        .catch((err: unknown) => console.error("event_playback_failed", err))
        .then(() => {
          if (!live(gen)) return;
          let after = get().game!;
          if (after.turn.phase === "animating") after = reduce(after, { type: "ANIMATION_DONE" }).state;
          return finishTurn(g.turn.playerId, after, gen);
        });
    },

    online: null,

    openOnline: () => {
      generation++;
      set({ ...freshView(), screen: "online", game: null, online: { ...freshOnline(), error: get().online?.error ?? "" } });
    },

    hostOnline: async (name) => {
      const { board, rules, slots } = get();
      await connect(() =>
        createRoom({ boardId: board.id, rules, name, seat: slots.find((sl) => sl.kind === "human")?.color }),
      );
    },

    joinOnline: async (code, name) => {
      await connect(() => joinRoom(code, { name }));
    },

    resumeOnline: async () => {
      const r = await resumeRoom();
      if (!r) return false;
      set({ screen: "online", online: { ...freshOnline(), status: "in-room" } });
      attach(r);
      return true;
    },

    leaveOnline: () => {
      generation++;
      const r = room;
      room = null;
      turnQueue = [];
      forgetRoom();
      void r?.leave(true).catch(() => undefined);
      set({ ...freshView(), screen: "home", game: null, online: null });
    },

    sendOnline: (type, payload) => room?.send(type, payload ?? {}),
  };

  function freshOnline(): OnlineState {
    return { status: "idle", view: null, me: "", error: "", rollOpensAt: 0, deadline: 0, rollSent: false };
  }

  function patchOnline(patch: Partial<OnlineState>) {
    const o = get().online;
    if (o) set({ online: { ...o, ...patch } });
  }

  /** After a turn has played: settle the final state, then the win or the hand-over to the next player. */
  async function finishTurn(prevPlayerId: string, after: GameState, gen: number) {
    set((st) => ({ game: after, moving: null, destination: null, display: positionsOf(after), turnNo: st.turnNo + 1 }));
    if (after.turn.phase === "gameOver") {
      await wait(PACE.beforeWin);
      if (live(gen)) {
        set({ busy: false, showWin: true });
        sfx.win();
      }
      return;
    }
    // hand the turn over: a note, the next token wakes up, the roster loop slides down
    const next = after.players.find((p) => p.id === after.turn.playerId)!;
    if (next.id !== prevPlayerId) {
      note(`${next.name}'s turn`, "ink", gen, PACE.handoff + 300);
      sfx.turn();
    }
    set((st) => ({ handoff: next.id, announcement: `${st.announcement} ${next.name}'s turn.` }));
    await wait(PACE.handoff);
    if (live(gen)) set({ handoff: null, busy: false });
  }

  async function connect(open: () => Promise<GameRoom>) {
    patchOnline({ status: "connecting", error: "" });
    try {
      attach(await open());
    } catch (err) {
      console.error("room_connect_failed", err);
      patchOnline({ status: "idle", error: describeError(err) });
    }
  }

  function attach(r: GameRoom) {
    // one room per tab: a second open (a double click, a stale join) replaces the first
    if (room && room !== r) {
      room.removeAllListeners();
      void room.leave(true).catch(() => undefined);
    }
    room = r;
    turnQueue = [];
    lastSeq = 0;
    rememberRoom(r);
    patchOnline({ status: "in-room", me: r.sessionId, error: "" });
    r.onStateChange((state) => {
      if (room !== r) return;
      const view = state.toJSON();
      patchOnline({ view });
      route(view);
    });
    r.onMessage("started", (msg: StartedMessage) => room === r && enterGame(fromPublic(msg.game), msg.seq, Date.now() + msg.rollInMs));
    r.onMessage("turn", (msg: TurnMessage) => {
      if (room !== r) return;
      turnQueue.push({ msg, at: Date.now() });
      void drain();
    });
    r.onDrop(() => room === r && patchOnline({ status: "reconnecting" }));
    r.onReconnect(() => {
      if (room !== r) return;
      rememberRoom(r);
      patchOnline({ status: "in-room" });
    });
    r.onLeave(() => {
      if (room !== r) return;
      // the server closed the room, or the seat's reconnection window ran out
      room = null;
      forgetRoom();
      generation++;
      set({ ...freshView(), screen: "online", game: null, online: { ...freshOnline(), error: "the room closed" } });
    });
  }

  /** Follow the room between its lobby and the board. */
  function route(view: RoomView) {
    const s = get();
    if (view.phase === "lobby" && s.screen !== "online") {
      generation++;
      set({ ...freshView(), screen: "online", game: null });
    } else if (view.phase !== "lobby" && !s.game) {
      // back in mid-game (a refresh or a late join): there was no "started" message to build from
      const board = JSON.parse(view.boardJson) as Board;
      const game = gameFromView(view, board);
      const deadline = view.turnDeadline ? Date.now() + Math.max(0, view.turnDeadline - Date.now()) : 0;
      enterGame(game, 0, Date.now(), board, deadline);
      if (view.phase === "finished") set({ showWin: true });
    }
  }

  function enterGame(game: GameState, seq: number, rollOpensAt: number, boardIn?: Board, deadlineIn?: number) {
    const view = get().online?.view;
    const board = boardIn ?? (view ? (JSON.parse(view.boardJson) as Board) : get().board);
    generation++;
    turnQueue = [];
    lastSeq = seq;
    const deadline = deadlineIn ?? rollOpensAt + (view?.turnSeconds ?? 20) * 1000;
    set((st) => ({
      ...freshView(),
      screen: "game",
      board,
      art: board.id === st.board.id ? st.art : buildBoardArt(board),
      game,
      gameNo: st.gameNo + 1,
      introDone: false,
      display: positionsOf(game),
      online: st.online ? { ...st.online, rollOpensAt, deadline, rollSent: false } : st.online,
    }));
  }

  /** Play queued server turns one after another; waits for the board intro to finish first. */
  async function drain() {
    if (draining || !get().introDone) return;
    draining = true;
    try {
      while (turnQueue.length) {
        const { msg, at } = turnQueue.shift()!;
        if (msg.seq <= lastSeq) continue;
        lastSeq = msg.seq;
        const gen = generation;
        const before = get().game;
        if (!before) break;
        set({ busy: true });
        patchOnline({ rollSent: false });
        await play(msg.events, gen).catch((err: unknown) => console.error("event_playback_failed", err));
        if (!live(gen)) break;
        patchOnline({ rollOpensAt: at + msg.rollInMs, deadline: msg.deadlineInMs ? at + msg.deadlineInMs : 0 });
        await finishTurn(before.turn.playerId, fromPublic(msg.game), gen);
        if (!live(gen)) break;
      }
    } finally {
      draining = false;
    }
  }
});

// Dev-only handle for driving the game from the browser console or e2e scripts.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;
