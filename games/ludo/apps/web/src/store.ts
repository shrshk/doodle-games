import { create } from "zustand";
import { CloseCode } from "@colyseus/sdk";
import { BASE, botMove, createGame, HOME, onlyChoice, reduce, type GameEvent, type GameState, type PlayerState, type RuleSet } from "@ludo-doodle/engine";
import { PACE, type PublicGame, type Reaction, type ReactionMessage, type RoomView, type StartedMessage, type StepMessage } from "@ludo-doodle/protocol";
import { characterName, TOWER_HITS, type Mood } from "@doodle-games/ui-doodle";
import { progressPoint, type Pt } from "./board/geometry";
import { createRoom, describeError, forgetRoom, joinRoom, rememberRoom, resumeRoom, type GameRoom } from "./net/online";
import { loadSetup, saveSetup, type Slot } from "./setup";
import { isMuted, setMuted, sfx } from "./sound";

export type { Slot, SlotKind } from "./setup";

/**
 * Every timing in one place (ms), shared with the online server so it knows how long a step plays
 * on screen. Reduced motion skips tweens and caps waits.
 */
export { PACE };

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
  /** online quick reactions on show, by player; `key` restarts the pop when the same word repeats */
  reactions: Record<string, { reaction: Reaction; key: number }>;
}

/** A room on the game server: the synced room state plus this tab's view of the turn clock. */
export interface OnlineState {
  status: "idle" | "connecting" | "in-room" | "reconnecting";
  view: RoomView | null;
  /** this tab's player (session) id */
  me: string;
  error: string;
  /** local Date.now() ms when this tab may roll or pick next, and when the timer runs out (0 = none) */
  actOpensAt: number;
  deadline: number;
  /** a roll or pick is on its way to the server */
  actSent: boolean;
}

export type OnlineMessage = "seat" | "name" | "addBot" | "removeBot" | "start" | "lobby";

interface Store extends ViewState {
  screen: "home" | "game" | "online";
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
  /** rolls for whoever's turn it is (locally the screen also rolls for bots; online, the server does) */
  roll(): void;
  /** a person picks which of their tokens to move */
  pick(token: number): void;
  online: OnlineState | null;
  /** the online page, not yet in a room */
  openOnline(): void;
  hostOnline(name: string): Promise<void>;
  joinOnline(code: string, name: string): Promise<void>;
  /** back into the room a refresh left, if any; true when it worked */
  resumeOnline(): Promise<boolean>;
  leaveOnline(): void;
  sendOnline(type: OnlineMessage, payload?: object): void;
  react(reaction: Reaction): void;
}

const current = (g: GameState) => g.players.find((p) => p.id === g.turn.playerId)!;

type ActState = Pick<Store, "game" | "busy" | "introDone" | "online">;

/** Whether this tab may act for the current player: locally any person, online only its own seat once the server opens it. */
function mayAct(s: ActState, now: number): boolean {
  const g = s.game;
  if (!g || s.busy || !s.introDone) return false;
  const me = current(g);
  if (!s.online) return !me.isBot;
  return me.id === s.online.me && !s.online.actSent && now >= s.online.actOpensAt;
}

/** Whether a person at this device may roll right now. */
export function canRollNow(s: ActState, now = Date.now()): boolean {
  return s.game?.turn.phase === "awaitingRoll" && mayAct(s, now);
}

/** The tokens a person at this device may tap right now (empty when it is not their pick). */
export function pickable(s: ActState, now = Date.now()): number[] {
  return s.game?.turn.phase === "awaitingMove" && mayAct(s, now) ? s.game.turn.movable : [];
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
  reactions: {},
});

const tokensOf = (g: GameState) => Object.fromEntries(g.players.map((p) => [p.id, [...p.tokens]]));

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** An online state as an engine state: the server keeps the RNG and log, nothing here needs them. */
const fromPublic = (g: PublicGame): GameState => ({ ...g, rng: { seed: 0, cursor: 0 }, log: [] });

/** Bumped whenever a game starts or ends, so in-flight animations from the old game stop. */
let generation = 0;
let noteId = 0;
/** how long a reaction bubble stays up */
const REACTION_SHOW_MS = 2600;

/** The open room lives outside the store: it is a connection, not state to render. */
let room: GameRoom | null = null;
/** Steps from the server wait here and play one at a time, at the client's own pace. */
let stepQueue: { msg: StepMessage; at: number }[] = [];
let draining = false;
let lastSeq = 0;
let resuming: Promise<boolean> | null = null;
/** after a reconnect, rebuild the board from the room state: steps may have happened meanwhile */
let resyncPending = false;
/** removes the wake-up listeners of the current room */
let stopWakeCheck: () => void = () => undefined;
/** counts reconnects, so a wake-up ping sent on a socket that has since been replaced is ignored */
let reconnects = 0;
/** a ping that gets no answer this fast means the socket died while the app was in the background */
const WAKE_PING_MS = 1500;

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
    let afterRoll = false;

    for (const e of events) {
      if (!live(gen)) return;
      // online, a roll with only one move arrives with that move: give it the same pause as locally
      if (afterRoll && (e.type === "ENTERED" || e.type === "MOVED")) await wait(PACE.autoMove);
      afterRoll = e.type === "ROLLED";
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

  /** After a local roll with moves: bots pick, a lone choice goes by itself, people tap a token. */
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
    askToPick(gen);
  }

  function askToPick(gen: number) {
    sfx.choose();
    note("pick a token", "ink", gen, 1300);
    set((s) => ({ busy: false, turnNo: s.turnNo + 1 }));
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

    setIntroDone: () => {
      set({ introDone: true });
      // the first server step may have arrived while the board was still drawing itself in
      void drain();
    },

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
      if (get().online) return get().leaveOnline();
      generation++;
      set({ ...freshView(), screen: "home", game: null });
    },

    roll: () => {
      const s = get();
      const g = s.game;
      if (!g || s.busy || !s.introDone || g.turn.phase !== "awaitingRoll") return;
      if (s.online) {
        if (!canRollNow(s)) return;
        // the server rolls; its step message comes back to every tab, this one included
        room?.send("roll");
        patchOnline({ actSent: true });
        return;
      }
      const result = reduce(g, { type: "ROLL", playerId: g.turn.playerId });
      if (result.error) return;
      run(g, result.state, result.events);
    },

    pick: (token) => {
      const s = get();
      if (!pickable(s).includes(token)) return;
      sfx.tap();
      if (s.online) {
        room?.send("move", { token });
        patchOnline({ actSent: true });
        return;
      }
      move(token);
    },

    online: null,

    openOnline: () => {
      generation++;
      set({ ...freshView(), screen: "online", game: null, online: { ...freshOnline(), error: get().online?.error ?? "" } });
    },

    hostOnline: async (name) => {
      const { rules, slots } = get();
      await connect(() => createRoom({ rules, name, seat: slots.find((sl) => sl.kind === "human")?.color }));
    },

    joinOnline: async (code, name) => {
      await connect(() => joinRoom(code, { name }));
    },

    resumeOnline: () => {
      // once at a time: a second try with the same token would fail and forget the room
      // (React's dev StrictMode runs the startup effect twice)
      if (room) return Promise.resolve(true);
      resuming ??= resumeRoom()
        .then((r) => {
          if (!r) return false;
          set({ screen: "online", online: { ...freshOnline(), status: "in-room" } });
          attach(r);
          return true;
        })
        .finally(() => (resuming = null));
      return resuming;
    },

    leaveOnline: () => {
      generation++;
      const r = room;
      room = null;
      stopWakeCheck();
      stepQueue = [];
      forgetRoom();
      void r?.leave(true).catch(() => undefined);
      set({ ...freshView(), screen: "home", game: null, online: null });
    },

    sendOnline: (type, payload) => room?.send(type, payload ?? {}),

    react: (reaction) => room?.send("react", { reaction }),
  };

  function freshOnline(): OnlineState {
    return { status: "idle", view: null, me: "", error: "", actOpensAt: 0, deadline: 0, actSent: false };
  }

  function patchOnline(patch: Partial<OnlineState>) {
    const o = get().online;
    if (o) set({ online: { ...o, ...patch } });
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
    stepQueue = [];
    lastSeq = 0;
    rememberRoom(r);
    watchForWake(r);
    if (import.meta.env.DEV) (window as unknown as { __room: GameRoom }).__room = r;
    patchOnline({ status: "in-room", me: r.sessionId, error: "" });
    r.onStateChange((state) => {
      if (room !== r) return;
      const view = state.toJSON();
      patchOnline({ view });
      route(view);
    });
    r.onMessage("started", (msg: StartedMessage) => room === r && enterGame(fromPublic(msg.game), msg.seq, Date.now() + msg.actInMs));
    r.onMessage("step", (msg: StepMessage) => {
      if (room !== r) return;
      stepQueue.push({ msg, at: Date.now() });
      void drain();
    });
    r.onMessage("reaction", (msg: ReactionMessage) => {
      if (room !== r) return;
      const key = ++noteId;
      set((st) => ({ reactions: { ...st.reactions, [msg.playerId]: { reaction: msg.reaction, key } } }));
      sfx.tap();
      later(REACTION_SHOW_MS, generation, () =>
        set((st) => {
          if (st.reactions[msg.playerId]?.key !== key) return {};
          const { [msg.playerId]: _gone, ...rest } = st.reactions;
          return { reactions: rest };
        }),
      );
    });
    r.onDrop(() => room === r && patchOnline({ status: "reconnecting" }));
    r.onReconnect(() => {
      if (room !== r) return;
      rememberRoom(r);
      reconnects++;
      resyncPending = true;
      patchOnline({ status: "in-room" });
    });
    r.onLeave(() => {
      if (room !== r) return;
      // the server closed the room, or the seat's reconnection window ran out
      room = null;
      stopWakeCheck();
      forgetRoom();
      generation++;
      set({ ...freshView(), screen: "online", game: null, online: { ...freshOnline(), error: "the room closed" } });
    });
  }

  /**
   * iOS freezes a backgrounded PWA (the share sheet is enough) and its socket can die without a
   * close event, so on return the page would sit on a stale room until a timeout minutes later.
   * When the app comes back, or the network does, ping the room; no answer means the socket is
   * dead, and closing it with MAY_TRY_RECONNECT starts the SDK's own reconnect into the same seat.
   */
  function watchForWake(r: GameRoom) {
    stopWakeCheck();
    const check = () => {
      if (document.visibilityState !== "visible" || room !== r || !r.connection.isOpen) return;
      let answered = false;
      const sentAt = reconnects;
      r.ping(() => (answered = true));
      setTimeout(() => {
        // the SDK may have noticed and reconnected by itself meanwhile: leave the new socket alone
        if (answered || room !== r || !r.connection.isOpen || reconnects !== sentAt) return;
        console.warn("room_wake_ping_unanswered");
        patchOnline({ status: "reconnecting" });
        r.connection.close(CloseCode.MAY_TRY_RECONNECT);
      }, WAKE_PING_MS);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("online", check);
    stopWakeCheck = () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("online", check);
    };
  }

  /** The room's turn deadline on this tab's clock (0 = none). A function: code after the return is only hoisted. */
  function deadlineFrom(view: RoomView) {
    return view.turnDeadline ? Date.now() + Math.max(0, view.turnDeadline - Date.now()) : 0;
  }

  /** Back from a reconnect mid-game: put every token where the room says, drop half-played steps. */
  function resync(view: RoomView) {
    const game = fromPublic(JSON.parse(view.gameJson) as PublicGame);
    generation++;
    stepQueue = [];
    set((st) => ({
      ...freshView(),
      game,
      display: tokensOf(game),
      dice: st.dice,
      introDone: true,
      showWin: view.phase === "finished",
      online: st.online ? { ...st.online, actOpensAt: Date.now(), deadline: deadlineFrom(view), actSent: false } : st.online,
    }));
  }

  /** Follow the room between its lobby and the board. */
  function route(view: RoomView) {
    const s = get();
    if (resyncPending) {
      resyncPending = false;
      if (view.phase !== "lobby" && s.game && view.gameJson) return resync(view);
    }
    if (view.phase === "lobby" && s.screen !== "online") {
      generation++;
      set({ ...freshView(), screen: "online", game: null });
    } else if (view.phase !== "lobby" && !s.game && view.gameJson) {
      // back in mid-game (a refresh or a late join): there was no "started" message to build from
      enterGame(fromPublic(JSON.parse(view.gameJson) as PublicGame), 0, Date.now(), deadlineFrom(view));
      if (view.phase === "finished") set({ showWin: true });
    }
  }

  function enterGame(game: GameState, seq: number, actOpensAt: number, deadlineIn?: number) {
    const view = get().online?.view;
    generation++;
    stepQueue = [];
    lastSeq = seq;
    const deadline = deadlineIn ?? actOpensAt + (view?.turnSeconds ?? 20) * 1000;
    set((st) => ({
      ...freshView(),
      screen: "game",
      game,
      gameNo: st.gameNo + 1,
      introDone: false,
      display: tokensOf(game),
      online: st.online ? { ...st.online, actOpensAt, deadline, actSent: false } : st.online,
    }));
  }

  /** Play queued server steps one after another; waits for the board intro to finish first. */
  async function drain() {
    if (draining || !get().introDone) return;
    draining = true;
    try {
      while (stepQueue.length) {
        const { msg, at } = stepQueue.shift()!;
        if (msg.seq <= lastSeq) continue;
        lastSeq = msg.seq;
        const gen = generation;
        const before = get().game;
        if (!before) break;
        const after = fromPublic(msg.game);
        // as locally: the engine is ahead, and the drawn tokens catch up as the events play
        set((s) => ({ busy: true, game: after, turnNo: s.turnNo + 1 }));
        patchOnline({ actSent: false });
        await play(msg.events, gen).catch((err: unknown) => console.error("event_playback_failed", err));
        if (!live(gen)) break;
        patchOnline({ actOpensAt: at + msg.actInMs, deadline: msg.deadlineInMs ? at + msg.deadlineInMs : 0 });
        if (after.turn.phase === "awaitingMove") {
          set({ game: after, display: tokensOf(after) });
          if (current(after).id === get().online?.me) askToPick(gen);
          else set({ busy: false });
        } else await finishTurn(before.turn.playerId, after, gen);
        if (!live(gen)) break;
      }
    } finally {
      draining = false;
    }
  }
});

// Dev-only handle for driving the game from the browser console or e2e scripts.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;
