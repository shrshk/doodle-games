import type { Board } from "@snakes-doodle/boards";
import { rollDie } from "./rng";
import {
  DEFAULT_RULES,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PlayerState,
  type ReduceResult,
  type RuleSet,
  type Track,
} from "./types";
import { validateBoard } from "./validate";

export interface NewPlayer {
  id: PlayerId;
  name: string;
  color: string;
  isBot?: boolean;
}

export interface NewGameOptions {
  board: Board;
  players: NewPlayer[];
  rules?: Partial<RuleSet>;
  seed: number;
}

export function trackFromBoard(board: Board): Track {
  const jumps: Record<number, number> = {};
  for (const s of board.snakes) jumps[s.from] = s.to;
  for (const l of board.ladders) jumps[l.from] = l.to;
  return { finalSquare: board.grid.rows * board.grid.cols, jumps };
}

export function createGame({ board, players, rules, seed }: NewGameOptions): GameState {
  if (players.length < 2 || players.length > 4) throw new Error("a game needs 2-4 players");
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error("player ids must be unique");
  const ruleSet: RuleSet = { ...DEFAULT_RULES, ...rules };
  const check = validateBoard(board, { chainJumps: ruleSet.chainJumps });
  if (!check.ok) throw new Error(`invalid board: ${check.errors.join("; ")}`);

  const first = players[0]!;
  return {
    boardId: board.id,
    rules: ruleSet,
    track: trackFromBoard(board),
    players: players.map((p) => ({ id: p.id, name: p.name, color: p.color, position: 0, isBot: p.isBot ?? false })),
    turn: { playerId: first.id, consecutiveSixes: 0, phase: "awaitingRoll", startPosition: 0, extraTurn: false },
    rng: { seed: seed >>> 0, cursor: 0 },
    log: [],
  };
}

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case "ROLL":
      return roll(state, action.playerId);
    case "ANIMATION_DONE":
      return animationDone(state);
    case "SKIP_TURN":
      return skipTurn(state, action.playerId);
    case "RESIGN":
      return resign(state, action.playerId);
  }
}

const reject = (state: GameState, error: string): ReduceResult => ({ state, events: [], error });

const isActive = (p: PlayerState) => p.finishedPlace === undefined && !p.resigned;

function commit(state: GameState, events: GameEvent[]): ReduceResult {
  return { state: { ...state, log: [...state.log, ...events] }, events };
}

function withPlayer(players: PlayerState[], id: PlayerId, patch: Partial<PlayerState>): PlayerState[] {
  return players.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

/** Next active player after `afterId` in seat order, wrapping. */
function nextActive(players: PlayerState[], afterId: PlayerId): PlayerState | undefined {
  const start = players.findIndex((p) => p.id === afterId);
  for (let k = 1; k <= players.length; k++) {
    const p = players[(start + k) % players.length]!;
    if (isActive(p)) return p;
  }
  return undefined;
}

function finishedCount(players: PlayerState[]): number {
  return players.filter((p) => p.finishedPlace !== undefined).length;
}

/**
 * Applies the end-of-game rule after someone finished or resigned. Without play-for-places the
 * first finisher ends the game; otherwise it ends when one active player is left, who takes the
 * last place.
 */
function settleGameOver(state: GameState, events: GameEvent[]): GameState {
  const active = state.players.filter(isActive);
  const someoneWon = finishedCount(state.players) > 0;
  const over = (someoneWon && !state.rules.playForPlaces) || active.length <= 1;
  if (!over) return state;

  let players = state.players;
  if (active.length === 1 && (state.rules.playForPlaces || !someoneWon)) {
    const last = active[0]!;
    const place = finishedCount(players) + 1;
    players = withPlayer(players, last.id, { finishedPlace: place });
    events.push({ type: "WON", playerId: last.id, place });
  }
  events.push({ type: "GAME_OVER" });
  return { ...state, players, turn: { ...state.turn, phase: "gameOver", extraTurn: false } };
}

/** Squares walked for a roll, or null when the move is forfeited by overshoot. */
function walk(from: number, value: number, track: Track, rules: RuleSet): number[] | null {
  const final = track.finalSquare;
  const path: number[] = [];
  const target = from + value;
  if (target <= final) {
    for (let s = from + 1; s <= target; s++) path.push(s);
    return path;
  }
  if (rules.overshoot === "stay") return null;
  for (let s = from + 1; s <= final; s++) path.push(s);
  for (let s = final - 1; s >= final - (target - final); s--) path.push(s);
  return path;
}

function roll(state: GameState, playerId: PlayerId): ReduceResult {
  const { turn, rules, track } = state;
  if (turn.phase !== "awaitingRoll") return reject(state, "not_awaiting_roll");
  if (playerId !== turn.playerId) return reject(state, "not_your_turn");
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !isActive(player)) return reject(state, "player_not_active");

  const { value, rng } = rollDie(state.rng);
  const events: GameEvent[] = [{ type: "ROLLED", playerId, value }];
  const isSix = value === 6;
  let sixes = rules.sixRule && isSix ? turn.consecutiveSixes + 1 : 0;
  let position = player.position;
  let extraTurn = false;
  let won = false;

  if (rules.sixRule && sixes >= 3) {
    position = turn.startPosition;
    sixes = 0;
    events.push({ type: "TURN_FORFEITED", playerId, to: position });
  } else {
    let path: number[] | null;
    if (position === 0 && rules.startOnSix) {
      path = isSix ? [1] : null;
      if (!path) events.push({ type: "BLOCKED", playerId, reason: "needSix" });
    } else {
      path = walk(position, value, track, rules);
      if (!path) events.push({ type: "BLOCKED", playerId, reason: "overshoot" });
    }

    if (path) {
      const landed = path[path.length - 1]!;
      events.push({ type: "MOVED", playerId, from: position, to: landed, path });
      position = landed;
      const seen = new Set<number>([position]);
      for (let dest = track.jumps[position]; dest !== undefined; dest = track.jumps[position]) {
        events.push({ type: dest > position ? "LADDER" : "SNAKE", playerId, from: position, to: dest });
        position = dest;
        if (!rules.chainJumps || seen.has(position)) break;
        seen.add(position);
      }
    }

    won = position === track.finalSquare;
    if (!won && rules.sixRule && isSix) {
      extraTurn = true;
      events.push({ type: "EXTRA_TURN", playerId });
    }
  }

  let players = withPlayer(state.players, playerId, { position });
  if (won) {
    const place = finishedCount(players) + 1;
    players = withPlayer(players, playerId, { finishedPlace: place });
    events.push({ type: "WON", playerId, place });
  }

  const next = settleGameOver(
    { ...state, players, rng, turn: { ...turn, consecutiveSixes: sixes, phase: "animating", extraTurn } },
    events,
  );
  return commit(next, events);
}

function animationDone(state: GameState): ReduceResult {
  const { turn } = state;
  if (turn.phase !== "animating") return reject(state, "not_animating");
  const current = state.players.find((p) => p.id === turn.playerId);
  if (turn.extraTurn && current && isActive(current)) {
    return commit({ ...state, turn: { ...turn, phase: "awaitingRoll", extraTurn: false } }, []);
  }
  return commit(advance(state), []);
}

function advance(state: GameState): GameState {
  const next = nextActive(state.players, state.turn.playerId);
  if (!next) return { ...state, turn: { ...state.turn, phase: "gameOver", extraTurn: false } };
  return {
    ...state,
    turn: { playerId: next.id, consecutiveSixes: 0, phase: "awaitingRoll", startPosition: next.position, extraTurn: false },
  };
}

function skipTurn(state: GameState, playerId: PlayerId): ReduceResult {
  if (state.turn.phase !== "awaitingRoll") return reject(state, "not_awaiting_roll");
  if (playerId !== state.turn.playerId) return reject(state, "not_your_turn");
  return commit(advance(state), [{ type: "TURN_SKIPPED", playerId }]);
}

function resign(state: GameState, playerId: PlayerId): ReduceResult {
  if (state.turn.phase === "gameOver") return reject(state, "game_over");
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !isActive(player)) return reject(state, "player_not_active");

  const events: GameEvent[] = [{ type: "RESIGNED", playerId }];
  let next = settleGameOver({ ...state, players: withPlayer(state.players, playerId, { resigned: true }) }, events);
  // Mid-animation, ANIMATION_DONE moves the turn on; it skips the resigned player.
  if (next.turn.phase === "awaitingRoll" && next.turn.playerId === playerId) next = advance(next);
  return commit(next, events);
}
