import { randomInt } from "node:crypto";
import { Room, type AuthContext, type Client } from "@colyseus/core";
import {
  DEFAULT_LIMITS,
  RoomOptionsError,
  checkJoinRate,
  claimCode,
  cleanName,
  closeRoom,
  log,
  openRoom,
  releaseCode,
  type RoomLimits,
} from "@doodle-games/rooms/server";
import { inbuiltBoards, type Board } from "@snakes-doodle/boards";
import { DEFAULT_RULES, createGame, reduce, validateBoard, type GameEvent, type GameState, type RuleSet } from "@snakes-doodle/engine";
import {
  BOT_NAMES,
  EMPTY_ROOM_SECONDS,
  INTRO_MS,
  PACE,
  REACTION_COOLDOWN_MS,
  RECONNECT_SECONDS,
  SEATS,
  TURN_SECONDS,
  isReaction,
  isSeat,
  publicGame,
  turnPlaybackMs,
  type CreateRoomOptions,
  type JoinRoomOptions,
  type ReactionMessage,
  type Seat,
  type StartedMessage,
  type TurnMessage,
} from "@snakes-doodle/protocol";
import { GameRoomState, PlayerState } from "../schema";

/** a roll may arrive this early, to forgive clock jitter between server and client */
const ROLL_EARLY_MS = 400;
/** at most one roll message per client per this many ms */
const ROLL_COOLDOWN_MS = 300;
/** a disconnected player is rolled for after this pause, so the table sees it happen */
const AWAY_ROLL_MS = 1500;
const SPECTATOR_SLOTS = 8;

// shared with every game's rooms; re-exported for this server's tests and callers
export { DEFAULT_LIMITS, RoomOptionsError, cleanName, resetRateLimits, type RoomLimits } from "@doodle-games/rooms/server";

export function resolveBoard(options: CreateRoomOptions): Board {
  const board = inbuiltBoards.find((b) => b.id === (options.boardId ?? "classic-100"));
  if (!board) throw new RoomOptionsError("board_unknown");
  return board;
}

export function resolveRules(raw: Partial<RuleSet> | undefined): RuleSet {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (k: "chainJumps" | "sixRule" | "startOnSix" | "playForPlaces") => (typeof r[k] === "boolean" ? (r[k] as boolean) : DEFAULT_RULES[k]);
  return {
    chainJumps: bool("chainJumps"),
    sixRule: bool("sixRule"),
    startOnSix: bool("startOnSix"),
    playForPlaces: bool("playForPlaces"),
    overshoot: r.overshoot === "bounce" ? "bounce" : "stay",
  };
}

/** Real-time pacing. Tests shrink it so a whole game runs in milliseconds. */
export interface RoomTiming {
  introMs: number;
  /** multiplies every turn's playback estimate */
  playbackScale: number;
  /** length of one turn-timer "second" */
  secondMs: number;
  botThinkMinMs: number;
  botThinkMaxMs: number;
  awayRollMs: number;
  /** an empty room closes after this long */
  emptyRoomMs: number;
}

export const REAL_TIMING: RoomTiming = {
  introMs: INTRO_MS,
  playbackScale: 1,
  secondMs: 1000,
  botThinkMinMs: PACE.botThinkMin,
  botThinkMaxMs: PACE.botThinkMax,
  awayRollMs: AWAY_ROLL_MS,
  emptyRoomMs: EMPTY_ROOM_SECONDS * 1000,
};

export class GameRoom extends Room<{ state: GameRoomState }> {
  static timing: RoomTiming = REAL_TIMING;
  static limits: RoomLimits = DEFAULT_LIMITS;

  /** Runs before every create and join (not reconnects): a per-address rate limit. */
  static override async onAuth(_token: string, _options: unknown, context: AuthContext) {
    checkJoinRate(context, GameRoom.limits);
    return true;
  }
  override state = new GameRoomState();
  override maxClients = SEATS.length + SPECTATOR_SLOTS;
  override autoDispose = false;
  override maxMessagesPerSecond = GameRoom.limits.messagesPerSecond;

  private board!: Board;
  private rules!: RuleSet;
  private onTimeout: "roll" | "skip" = "roll";
  private game: GameState | null = null;
  private seq = 0;
  /** server clock ms when the next roll may be taken */
  private rollOpensAt = 0;
  private turnTimer: { clear(): void } | null = null;
  private emptyTimer: { clear(): void } | null = null;
  private lastRollAt = new Map<string, number>();
  private lastReactionAt = new Map<string, number>();
  private spectatorIds = new Set<string>();

  override messages = {
    roll: (client: Client) => this.onRoll(client),
    seat: (client: Client, msg: { seat?: unknown }) => this.onSeat(client, msg?.seat),
    name: (client: Client, msg: { name?: unknown }) => this.onName(client, msg?.name),
    addBot: (client: Client, msg: { seat?: unknown }) => this.onAddBot(client, msg?.seat),
    removeBot: (client: Client, msg: { seat?: unknown }) => this.onRemoveBot(client, msg?.seat),
    start: (client: Client) => this.onStart(client),
    lobby: (client: Client) => this.onLobby(client),
    react: (client: Client, msg: { reaction?: unknown }) => this.onReact(client, msg?.reaction),
  };

  override async onCreate(options: CreateRoomOptions = {}) {
    this.board = resolveBoard(options);
    this.rules = resolveRules(options.rules);
    // inbuilt boards are tested valid under every rule set; this keeps a bad future board out of play
    const check = validateBoard(this.board, { chainJumps: this.rules.chainJumps });
    if (!check.ok) throw new RoomOptionsError(`board_invalid: ${check.errors.join("; ")}`);
    this.onTimeout = options.onTimeout === "skip" ? "skip" : "roll";

    openRoom(GameRoom.limits);
    this.roomId = await claimCode(this.presence);
    const turnSeconds = Number.isFinite(options.turnSeconds) ? Math.round(options.turnSeconds!) : TURN_SECONDS.default;
    Object.assign(this.state, {
      code: this.roomId,
      boardId: this.board.id,
      boardJson: JSON.stringify(this.board),
      rulesJson: JSON.stringify(this.rules),
      turnSeconds: Math.min(TURN_SECONDS.max, Math.max(TURN_SECONDS.min, turnSeconds)),
    });
    // nobody may join until the creator has; an unclaimed room closes like an empty one
    this.armEmptyTimer();
    log("room_created", { room: this.roomId, board: this.board.id });
  }

  override onJoin(client: Client, options: JoinRoomOptions = {}) {
    this.clearEmptyTimer();
    const free = this.freeSeats();
    if (this.state.phase !== "lobby" || free.length === 0) {
      this.spectatorIds.add(client.sessionId);
      this.state.spectators = this.spectatorIds.size;
      log("spectator_joined", { room: this.roomId, session: client.sessionId });
      return;
    }
    const seat = isSeat(options.seat) && free.includes(options.seat) ? options.seat : free[0]!;
    const player = new PlayerState();
    Object.assign(player, { id: client.sessionId, name: this.uniqueName(cleanName(options.name, BOT_NAMES[seat]), seat), color: seat });
    this.state.players.set(client.sessionId, player);
    this.syncTurnOrder();
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    log("player_joined", { room: this.roomId, session: client.sessionId, seat, players: this.state.turnOrder.length });
  }

  override onDrop(client: Client, code?: number) {
    log("player_dropped", { room: this.roomId, session: client.sessionId, code });
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
      // a player who drops on their own turn gets rolled for after a short pause
      if (this.isCurrent(client.sessionId)) this.scheduleTurn();
    }
    this.allowReconnection(client, RECONNECT_SECONDS);
    if (this.clients.length === 0) this.armEmptyTimer();
  }

  override onReconnect(client: Client) {
    log("player_reconnected", { room: this.roomId, session: client.sessionId });
    this.clearEmptyTimer();
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = true;
    if (this.isCurrent(client.sessionId)) this.scheduleTurn();
  }

  override onLeave(client: Client, code?: number) {
    const id = client.sessionId;
    log("player_left", { room: this.roomId, session: id, code });
    this.lastRollAt.delete(id);
    this.lastReactionAt.delete(id);
    if (this.spectatorIds.delete(id)) this.state.spectators = this.spectatorIds.size;
    const player = this.state.players.get(id);
    if (player) {
      if (this.state.phase === "lobby") {
        this.state.players.delete(id);
        this.syncTurnOrder();
      } else {
        // mid-game the seat stays: it keeps being rolled for, like a bot
        player.connected = false;
        if (this.isCurrent(id)) this.scheduleTurn();
      }
    }
    if (this.state.hostId === id) this.state.hostId = this.nextHost();
    if (this.clients.length === 0) this.armEmptyTimer();
  }

  override async onDispose() {
    closeRoom();
    log("room_closed", { room: this.roomId });
    this.turnTimer?.clear();
    this.clearEmptyTimer();
    await releaseCode(this.presence, this.roomId);
  }

  // ---------- lobby ----------

  private isHost = (client: Client) => this.state.hostId === client.sessionId;

  private freeSeats(): Seat[] {
    const taken = new Set<string>([...this.state.players.values()].map((p: PlayerState) => p.color));
    return SEATS.filter((s) => !taken.has(s));
  }

  /**
   * Every device defaults to its own first character's name, so two friends who never typed one
   * would both be "Mush". A newcomer whose name is taken gets their seat's character name instead.
   */
  private uniqueName(name: string, seat: Seat): string {
    const taken = new Set([...this.state.players.values()].map((p: PlayerState) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    const base = BOT_NAMES[seat];
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
  }

  private syncTurnOrder() {
    const bySeat = [...this.state.players.values()].sort((a, b) => SEATS.indexOf(a.color as Seat) - SEATS.indexOf(b.color as Seat));
    this.state.turnOrder.splice(0, this.state.turnOrder.length, ...bySeat.map((p) => p.id));
  }

  private nextHost(): string {
    const humans = this.state.turnOrder
      .map((id) => this.state.players.get(id))
      .filter((p): p is PlayerState => !!p && !p.isBot && p.connected);
    return humans[0]?.id ?? "";
  }

  private onSeat(client: Client, seat: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.phase !== "lobby" || !player || !isSeat(seat) || !this.freeSeats().includes(seat)) return;
    // a player still named after their old character takes the new one's name
    if (player.name === BOT_NAMES[player.color as Seat]) player.name = BOT_NAMES[seat];
    player.color = seat;
    this.syncTurnOrder();
  }

  private onName(client: Client, name: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.phase !== "lobby" || !player) return;
    player.name = cleanName(name, BOT_NAMES[player.color as Seat]);
  }

  private onAddBot(client: Client, seat: unknown) {
    if (this.state.phase !== "lobby" || !this.isHost(client) || !isSeat(seat) || !this.freeSeats().includes(seat)) return;
    const bot = new PlayerState();
    Object.assign(bot, { id: `bot-${seat}`, name: BOT_NAMES[seat], color: seat, isBot: true });
    this.state.players.set(bot.id, bot);
    this.syncTurnOrder();
  }

  private onRemoveBot(client: Client, seat: unknown) {
    if (this.state.phase !== "lobby" || !this.isHost(client) || !isSeat(seat)) return;
    const id = `bot-${seat}`;
    if (!this.state.players.get(id)?.isBot) return;
    this.state.players.delete(id);
    this.syncTurnOrder();
  }

  private onStart(client: Client) {
    if (this.state.phase !== "lobby" || !this.isHost(client) || this.state.turnOrder.length < 2) return;
    const players = this.state.turnOrder.map((id) => {
      const p = this.state.players.get(id)!;
      return { id: p.id, name: p.name, color: p.color, isBot: p.isBot };
    });
    this.game = createGame({ board: this.board, players, rules: this.rules, seed: randomInt(2 ** 32) });
    this.state.phase = "playing";
    this.state.lastRoll = 0;
    this.applyGame();
    this.seq++;
    const { introMs, secondMs } = GameRoom.timing;
    this.rollOpensAt = Date.now() + introMs;
    this.state.turnDeadline = this.rollOpensAt + this.state.turnSeconds * secondMs;
    this.broadcast("started", { game: publicGame(this.game), seq: this.seq, rollInMs: introMs } satisfies StartedMessage);
    log("game_started", { room: this.roomId, players: players.length });
    this.scheduleTurn();
  }

  /** After a game, anyone can take the table back to the lobby; seats and bots stay. */
  private onLobby(client: Client) {
    if (this.state.phase !== "finished" || !this.state.players.get(client.sessionId)) return;
    this.game = null;
    this.state.phase = "lobby";
    this.state.currentPlayerId = "";
    this.state.turnDeadline = 0;
    this.state.lastRoll = 0;
    // players who left for good free their seats for the next game
    for (const p of [...this.state.players.values()]) {
      if (!p.isBot && !p.connected) this.state.players.delete(p.id);
      else Object.assign(p, { position: 0, place: 0 });
    }
    this.syncTurnOrder();
    if (!this.state.players.get(this.state.hostId)) this.state.hostId = this.nextHost();
  }

  /** Seated players can react at any time; spectators watch quietly. Relayed, never stored. */
  private onReact(client: Client, reaction: unknown) {
    const id = client.sessionId;
    if (!isReaction(reaction) || !this.state.players.get(id)) return;
    const now = Date.now();
    if (now - (this.lastReactionAt.get(id) ?? 0) < REACTION_COOLDOWN_MS) return;
    this.lastReactionAt.set(id, now);
    this.broadcast("reaction", { playerId: id, reaction } satisfies ReactionMessage);
  }

  // ---------- turns ----------

  private isCurrent = (id: string) => this.state.phase === "playing" && this.game?.turn.playerId === id;

  private onRoll(client: Client) {
    const id = client.sessionId;
    const now = Date.now();
    if (now - (this.lastRollAt.get(id) ?? 0) < ROLL_COOLDOWN_MS) return;
    this.lastRollAt.set(id, now);
    if (!this.isCurrent(id) || now < this.rollOpensAt - ROLL_EARLY_MS) return;
    this.takeTurn("roll");
  }

  /** Plan what happens to the current turn: a bot thinks, an absent player is rolled for, a present one gets the timer. */
  private scheduleTurn() {
    this.turnTimer?.clear();
    this.turnTimer = null;
    const game = this.game;
    if (!game || this.state.phase !== "playing") return;
    const player = this.state.players.get(game.turn.playerId);
    if (!player) return;
    const now = Date.now();
    const opens = Math.max(now, this.rollOpensAt);
    let at: number;
    let action: "roll" | "skip" = "roll";
    const { botThinkMinMs, botThinkMaxMs, awayRollMs } = GameRoom.timing;
    if (player.isBot) at = opens + botThinkMinMs + Math.random() * (botThinkMaxMs - botThinkMinMs);
    else if (!player.connected) at = opens + awayRollMs;
    else {
      at = this.state.turnDeadline;
      action = this.onTimeout;
    }
    this.turnTimer = this.clock.setTimeout(() => this.takeTurn(action), Math.max(0, at - now));
  }

  private takeTurn(action: "roll" | "skip") {
    const game = this.game;
    if (!game || this.state.phase !== "playing") return;
    const playerId = game.turn.playerId;
    const first = reduce(game, action === "roll" ? { type: "ROLL", playerId } : { type: "SKIP_TURN", playerId });
    if (first.error) return;
    let next = first.state;
    let events: GameEvent[] = first.events;
    // nobody watches the server animate: finish the turn at once, clients play it at their pace
    if (next.turn.phase === "animating") {
      const done = reduce(next, { type: "ANIMATION_DONE" });
      next = done.state;
      events = [...events, ...done.events];
    }
    this.game = next;
    const rolled = events.find((e): e is Extract<GameEvent, { type: "ROLLED" }> => e.type === "ROLLED");
    if (rolled) this.state.lastRoll = rolled.value;
    this.applyGame();

    const over = next.turn.phase === "gameOver";
    const { playbackScale, secondMs } = GameRoom.timing;
    const rollInMs = Math.round(turnPlaybackMs(events, this.board) * playbackScale);
    const timerMs = this.state.turnSeconds * secondMs;
    this.rollOpensAt = Date.now() + rollInMs;
    this.state.turnDeadline = over ? 0 : this.rollOpensAt + timerMs;
    if (over) this.state.phase = "finished";
    this.seq++;
    this.broadcast("turn", {
      events,
      game: publicGame(next),
      seq: this.seq,
      rollInMs,
      deadlineInMs: over ? 0 : rollInMs + timerMs,
    } satisfies TurnMessage);
    if (over) {
      this.turnTimer?.clear();
      this.turnTimer = null;
    } else this.scheduleTurn();
  }

  /** Engine state -> synced schema: positions, places and whose turn it is. */
  private applyGame() {
    const game = this.game;
    if (!game) return;
    for (const p of game.players) {
      const s = this.state.players.get(p.id);
      if (s) Object.assign(s, { position: p.position, place: p.finishedPlace ?? 0 });
    }
    this.state.currentPlayerId = game.turn.phase === "gameOver" ? "" : game.turn.playerId;
  }

  // ---------- lifetime ----------

  private armEmptyTimer() {
    this.clearEmptyTimer();
    this.emptyTimer = this.clock.setTimeout(() => void this.disconnect(), GameRoom.timing.emptyRoomMs);
  }

  private clearEmptyTimer() {
    this.emptyTimer?.clear();
    this.emptyTimer = null;
  }
}
