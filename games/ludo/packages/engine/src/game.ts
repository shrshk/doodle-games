import { rollDie } from "./rng";
import { BASE, HOME, LAST_TRACK, SAFE_SQUARES, trackSquare } from "./track";
import {
  DEFAULT_RULES,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PlayerState,
  type ReduceResult,
  type RuleSet,
} from "./types";

export interface NewPlayer {
  id: PlayerId;
  name: string;
  color: string;
  /** board quadrant 0-3 (clockwise); two players usually sit opposite, 0 and 2 */
  seat: number;
  isBot?: boolean;
}

export interface NewGameOptions {
  players: NewPlayer[];
  rules?: Partial<RuleSet>;
  seed: number;
}

export const TOKENS_PER_PLAYER = 4;

export function createGame({ players, rules, seed }: NewGameOptions): GameState {
  if (players.length < 2 || players.length > 4) throw new Error("a game needs 2-4 players");
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error("player ids must be unique");
  if (new Set(players.map((p) => p.seat)).size !== players.length) throw new Error("seats must be unique");
  if (players.some((p) => !Number.isInteger(p.seat) || p.seat < 0 || p.seat > 3)) throw new Error("seats are 0-3");
  // turn order runs clockwise round the board, whatever order the players came in
  const seated = [...players].sort((a, b) => a.seat - b.seat);
  return {
    rules: { ...DEFAULT_RULES, ...rules },
    players: seated.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      seat: p.seat,
      isBot: p.isBot ?? false,
      tokens: Array.from({ length: TOKENS_PER_PLAYER }, () => BASE),
    })),
    turn: { playerId: seated[0]!.id, phase: "awaitingRoll", roll: null, sixes: 0, movable: [], extraTurn: false },
    rng: { seed: seed >>> 0, cursor: 0 },
    log: [],
  };
}

const isActive = (p: PlayerState) => p.finishedPlace === undefined && !p.resigned;

/** The tokens `player` can move with `roll`. */
export function legalMoves(state: GameState, player: PlayerState, roll: number): number[] {
  const out: number[] = [];
  player.tokens.forEach((progress, i) => {
    if (progress === HOME) return;
    if (progress === BASE) {
      if (state.rules.needSixToStart && roll !== 6) return;
      if (state.rules.blocks && blockedAt(state, player, 0)) return;
      out.push(i);
      return;
    }
    const to = progress + roll;
    if (to > HOME) return; // home takes an exact roll
    if (state.rules.blocks) {
      for (let p = progress + 1; p <= Math.min(to, LAST_TRACK); p++) if (blockedAt(state, player, p)) return;
    }
    out.push(i);
  });
  return out;
}

/** True when an opponent has two or more tokens on the shared square `player` would reach at `progress`. */
function blockedAt(state: GameState, player: PlayerState, progress: number): boolean {
  const square = trackSquare(player.seat, progress);
  if (square === null) return false;
  return state.players.some(
    (o) => o.id !== player.id && o.tokens.filter((t) => trackSquare(o.seat, t) === square).length >= 2,
  );
}

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case "ROLL":
      return roll(state, action.playerId);
    case "MOVE":
      return move(state, action.playerId, action.token);
    case "ANIMATION_DONE":
      return animationDone(state);
    case "RESIGN":
      return resign(state, action.playerId);
  }
}

const reject = (state: GameState, error: string): ReduceResult => ({ state, events: [], error });

function commit(state: GameState, events: GameEvent[]): ReduceResult {
  return { state: { ...state, log: [...state.log, ...events] }, events };
}

const current = (state: GameState) => state.players.find((p) => p.id === state.turn.playerId)!;

function withTokens(players: PlayerState[], id: PlayerId, tokens: number[]): PlayerState[] {
  return players.map((p) => (p.id === id ? { ...p, tokens } : p));
}

function roll(state: GameState, playerId: PlayerId): ReduceResult {
  if (state.turn.phase !== "awaitingRoll") return reject(state, "not_awaiting_roll");
  if (playerId !== state.turn.playerId) return reject(state, "not_your_turn");
  const { value, rng } = rollDie(state.rng);
  const { rules } = state;
  const sixes = value === 6 ? state.turn.sixes + 1 : 0;
  const events: GameEvent[] = [{ type: "ROLLED", playerId, value }];
  const base = { ...state, rng };

  if (rules.sixAgain && rules.threeSixesForfeit && sixes >= 3) {
    events.push({ type: "NO_MOVE", playerId, reason: "threeSixes" });
    return commit({ ...base, turn: { ...state.turn, phase: "animating", roll: value, sixes, movable: [], extraTurn: false } }, events);
  }

  const movable = legalMoves(state, current(state), value);
  if (movable.length === 0) {
    const again = rules.sixAgain && value === 6;
    events.push({ type: "NO_MOVE", playerId, reason: "noMovable" });
    if (again) events.push({ type: "EXTRA_TURN", playerId, reason: "six" });
    return commit({ ...base, turn: { ...state.turn, phase: "animating", roll: value, sixes, movable: [], extraTurn: again } }, events);
  }
  return commit({ ...base, turn: { ...state.turn, phase: "awaitingMove", roll: value, sixes, movable, extraTurn: false } }, events);
}

function move(state: GameState, playerId: PlayerId, token: number): ReduceResult {
  if (state.turn.phase !== "awaitingMove") return reject(state, "not_awaiting_move");
  if (playerId !== state.turn.playerId) return reject(state, "not_your_turn");
  if (!state.turn.movable.includes(token)) return reject(state, "token_cannot_move");
  const { rules } = state;
  const roll = state.turn.roll!;
  const player = current(state);
  const from = player.tokens[token]!;
  const to = from === BASE ? 0 : from + roll;
  const events: GameEvent[] = [
    from === BASE ? { type: "ENTERED", playerId, token } : { type: "MOVED", playerId, token, from, to },
  ];

  const tokens = [...player.tokens];
  tokens[token] = to;
  let players = withTokens(state.players, playerId, tokens);

  // cut: every opponent token on the landing square goes back to its base, unless the square is safe
  let cuts = 0;
  const square = trackSquare(player.seat, to);
  if (square !== null && !(rules.safeSquares && SAFE_SQUARES.has(square))) {
    for (const other of players) {
      if (other.id === playerId) continue;
      const hit = other.tokens.map((t, i) => (trackSquare(other.seat, t) === square ? i : -1)).filter((i) => i >= 0);
      if (hit.length === 0) continue;
      const otherTokens = [...other.tokens];
      for (const i of hit) {
        events.push({ type: "CUT", playerId, token, victimId: other.id, victimToken: i, from: otherTokens[i]! });
        otherTokens[i] = BASE;
        cuts++;
      }
      players = withTokens(players, other.id, otherTokens);
    }
  }

  const home = to === HOME;
  if (home) events.push({ type: "HOME", playerId, token });

  let next: GameState = { ...state, players };
  let won = false;
  if (tokens.every((t) => t === HOME)) {
    const place = state.players.filter((p) => p.finishedPlace !== undefined).length + 1;
    next = { ...next, players: next.players.map((p) => (p.id === playerId ? { ...p, finishedPlace: place } : p)) };
    events.push({ type: "WON", playerId, place });
    next = settleGameOver(next, events);
    won = true;
  }

  // another roll for a cut, a token home, or a 6 (cut and home first: they are the bigger news)
  const reason = won ? null : rules.cutBonus && cuts > 0 ? "cut" : rules.homeBonus && home ? "home" : rules.sixAgain && roll === 6 ? "six" : null;
  if (reason) events.push({ type: "EXTRA_TURN", playerId, reason });
  return commit({ ...next, turn: { ...next.turn, phase: next.turn.phase === "gameOver" ? "gameOver" : "animating", movable: [], extraTurn: reason !== null } }, events);
}

/** Ends the game when it is decided: the first winner, or with playForPlaces when one player is left. */
function settleGameOver(state: GameState, events: GameEvent[]): GameState {
  const active = state.players.filter(isActive);
  const winners = state.players.filter((p) => p.finishedPlace !== undefined).length;
  const over = state.rules.playForPlaces ? active.length <= 1 : winners >= 1 || active.length <= 1;
  if (!over) return state;
  let players = state.players;
  // the last player left takes the next place (with no winner yet, everyone else resigned: they win)
  if (active.length === 1 && (state.rules.playForPlaces || winners === 0)) {
    const last = active[0]!;
    const place = winners + 1;
    players = players.map((p) => (p.id === last.id ? { ...p, finishedPlace: place } : p));
    events.push({ type: "WON", playerId: last.id, place });
  }
  events.push({ type: "GAME_OVER" });
  return { ...state, players, turn: { ...state.turn, phase: "gameOver", movable: [], extraTurn: false } };
}

function animationDone(state: GameState): ReduceResult {
  if (state.turn.phase !== "animating") return reject(state, "not_animating");
  const me = current(state);
  if (state.turn.extraTurn && isActive(me)) {
    return commit({ ...state, turn: { ...state.turn, phase: "awaitingRoll", roll: null, movable: [], extraTurn: false } }, []);
  }
  return commit(advance(state), []);
}

/** Hands the turn to the next active player clockwise. */
function advance(state: GameState): GameState {
  const order = state.players;
  const at = order.findIndex((p) => p.id === state.turn.playerId);
  for (let k = 1; k <= order.length; k++) {
    const p = order[(at + k) % order.length]!;
    if (isActive(p)) {
      return { ...state, turn: { playerId: p.id, phase: "awaitingRoll", roll: null, sixes: 0, movable: [], extraTurn: false } };
    }
  }
  return { ...state, turn: { ...state.turn, phase: "gameOver", movable: [], extraTurn: false } };
}

function resign(state: GameState, playerId: PlayerId): ReduceResult {
  if (state.turn.phase === "gameOver") return reject(state, "game_over");
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !isActive(player)) return reject(state, "player_not_active");
  const events: GameEvent[] = [{ type: "RESIGNED", playerId }];
  let next: GameState = { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, resigned: true } : p)) };
  next = settleGameOver(next, events);
  if (next.turn.phase !== "gameOver" && next.turn.playerId === playerId) next = advance(next);
  return commit(next, events);
}
