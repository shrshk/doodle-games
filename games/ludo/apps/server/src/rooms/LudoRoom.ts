import { randomInt } from "node:crypto";
import { Room, type AuthContext, type Client } from "@colyseus/core";
import {
  DEFAULT_LIMITS,
  checkJoinRate,
  claimCode,
  cleanName,
  closeRoom,
  log,
  openRoom,
  releaseCode,
  type RoomLimits,
} from "@doodle-games/rooms/server";
import { EMPTY_ROOM_SECONDS, REACTION_COOLDOWN_MS, RECONNECT_SECONDS } from "@doodle-games/rooms";
import { botMove, createGame, DEFAULT_RULES, onlyChoice, reduce, type GameEvent, type GameState, type RuleSet } from "@ludo-doodle/engine";
import {
  BOT_NAMES,
  INTRO_MS,
  PACE,
  SEATS,
  TURN_SECONDS,
  isReaction,
  isSeat,
  publicGame,
  stepPlaybackMs,
  type CreateRoomOptions,
  type JoinRoomOptions,
  type ReactionMessage,
  type Seat,
  type StartedMessage,
  type StepMessage,
} from "@ludo-doodle/protocol";
import { LudoRoomState, PlayerState } from "../schema";

export { DEFAULT_LIMITS, RoomOptionsError, resetRateLimits, type RoomLimits } from "@doodle-games/rooms/server";

/** a roll or pick may arrive this early, to forgive clock jitter between server and client */
const ACT_EARLY_MS = 400;
/** at most one roll or move message per client per this many ms */
const ACT_COOLDOWN_MS = 300;
/** a disconnected player is played for after this pause, so the table sees it happen */
const AWAY_ACT_MS = 1500;
const SPECTATOR_SLOTS = 8;

export function resolveRules(raw: Partial<RuleSet> | undefined): RuleSet {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_RULES };
  for (const k of Object.keys(DEFAULT_RULES) as (keyof RuleSet)[]) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  return out;
}

/** Real-time pacing. Tests shrink it so a whole game runs in milliseconds. */
export interface RoomTiming {
  introMs: number;
  /** multiplies every step's playback estimate */
  playbackScale: number;
  /** length of one turn-timer "second" */
  secondMs: number;
  botThinkMinMs: number;
  botThinkMaxMs: number;
  /** a bot's pause between seeing its roll and moving */
  botPickMs: number;
  awayActMs: number;
  /** an empty room closes after this long */
  emptyRoomMs: number;
}

export const REAL_TIMING: RoomTiming = {
  introMs: INTRO_MS,
  playbackScale: 1,
  secondMs: 1000,
  botThinkMinMs: PACE.botThinkMin,
  botThinkMaxMs: PACE.botThinkMax,
  botPickMs: PACE.botPick,
  awayActMs: AWAY_ACT_MS,
  emptyRoomMs: EMPTY_ROOM_SECONDS * 1000,
};

type Act = { type: "roll" } | { type: "move"; token: number };

/**
 * A Ludo table. The server holds the engine state and the die; clients send rolls and picks and
 * play each step back at their own pace. A turn has two steps, the roll and the pick, and each
 * gets the turn timer: when it runs out the server rolls, or picks the bot's move, for the player.
 */
export class LudoRoom extends Room<{ state: LudoRoomState }> {
  static timing: RoomTiming = REAL_TIMING;
  static limits: RoomLimits = DEFAULT_LIMITS;

  /** Runs before every create and join (not reconnects): a per-address rate limit. */
  static override async onAuth(_token: string, _options: unknown, context: AuthContext) {
    checkJoinRate(context, LudoRoom.limits);
    return true;
  }

  override state = new LudoRoomState();
  override maxClients = SEATS.length + SPECTATOR_SLOTS;
  override autoDispose = false;
  override maxMessagesPerSecond = LudoRoom.limits.messagesPerSecond;

  private rules!: RuleSet;
  private game: GameState | null = null;
  private seq = 0;
  /** server clock ms when the next roll or pick may be taken */
  private actOpensAt = 0;
  private turnTimer: { clear(): void } | null = null;
  private emptyTimer: { clear(): void } | null = null;
  private lastActAt = new Map<string, number>();
  private lastReactionAt = new Map<string, number>();
  private spectatorIds = new Set<string>();

  override messages = {
    roll: (client: Client) => this.onAct(client, { type: "roll" }),
    move: (client: Client, msg: { token?: unknown }) => {
      const token = msg?.token;
      if (typeof token === "number" && Number.isInteger(token)) this.onAct(client, { type: "move", token });
    },
    seat: (client: Client, msg: { seat?: unknown }) => this.onSeat(client, msg?.seat),
    name: (client: Client, msg: { name?: unknown }) => this.onName(client, msg?.name),
    addBot: (client: Client, msg: { seat?: unknown }) => this.onAddBot(client, msg?.seat),
    removeBot: (client: Client, msg: { seat?: unknown }) => this.onRemoveBot(client, msg?.seat),
    start: (client: Client) => this.onStart(client),
    lobby: (client: Client) => this.onLobby(client),
    react: (client: Client, msg: { reaction?: unknown }) => this.onReact(client, msg?.reaction),
  };

  override async onCreate(options: CreateRoomOptions = {}) {
    this.rules = resolveRules(options.rules);
    openRoom(LudoRoom.limits);
    this.roomId = await claimCode(this.presence);
    const turnSeconds = Number.isFinite(options.turnSeconds) ? Math.round(options.turnSeconds!) : TURN_SECONDS.default;
    Object.assign(this.state, {
      code: this.roomId,
      rulesJson: JSON.stringify(this.rules),
      turnSeconds: Math.min(TURN_SECONDS.max, Math.max(TURN_SECONDS.min, turnSeconds)),
    });
    // nobody may join until the creator has; an unclaimed room closes like an empty one
    this.armEmptyTimer();
    log("room_created", { game: "ludo", room: this.roomId });
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
    const seat = isSeat(options.seat) && free.includes(options.seat) ? options.seat : this.oppositeFirst(free);
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
      // a player who drops on their own turn gets played for after a short pause
      if (this.isCurrent(client.sessionId)) this.scheduleAct();
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
    if (this.isCurrent(client.sessionId)) this.scheduleAct();
  }

  override onLeave(client: Client, code?: number) {
    const id = client.sessionId;
    log("player_left", { room: this.roomId, session: id, code });
    this.lastActAt.delete(id);
    this.lastReactionAt.delete(id);
    if (this.spectatorIds.delete(id)) this.state.spectators = this.spectatorIds.size;
    const player = this.state.players.get(id);
    if (player) {
      if (this.state.phase === "lobby") {
        this.state.players.delete(id);
        this.syncTurnOrder();
      } else {
        // mid-game the seat stays: it keeps being played for, like a bot
        player.connected = false;
        if (this.isCurrent(id)) this.scheduleAct();
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

  /** A second player sits opposite the first, as on a real board; then the corners fill in. */
  private oppositeFirst(free: Seat[]): Seat {
    const order: Seat[] = ["red", "orange", "yellow", "indigo"];
    return order.find((s) => free.includes(s)) ?? free[0]!;
  }

  /** A newcomer whose name is taken gets their seat's character name instead. */
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
      return { id: p.id, name: p.name, color: p.color, seat: SEATS.indexOf(p.color as Seat), isBot: p.isBot };
    });
    this.game = createGame({ players, rules: this.rules, seed: randomInt(2 ** 32) });
    this.state.phase = "playing";
    this.applyGame();
    this.seq++;
    const { introMs, secondMs } = LudoRoom.timing;
    this.actOpensAt = Date.now() + introMs;
    this.state.turnDeadline = this.actOpensAt + this.state.turnSeconds * secondMs;
    this.broadcast("started", { game: publicGame(this.game), seq: this.seq, actInMs: introMs } satisfies StartedMessage);
    log("game_started", { room: this.roomId, players: players.length });
    this.scheduleAct();
  }

  /** After a game, anyone can take the table back to the lobby; seats and bots stay. */
  private onLobby(client: Client) {
    if (this.state.phase !== "finished" || !this.state.players.get(client.sessionId)) return;
    this.game = null;
    Object.assign(this.state, { phase: "lobby", currentPlayerId: "", turnDeadline: 0, gameJson: "" });
    // players who left for good free their seats for the next game
    for (const p of [...this.state.players.values()]) {
      if (!p.isBot && !p.connected) this.state.players.delete(p.id);
      else p.place = 0;
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

  private onAct(client: Client, act: Act) {
    const id = client.sessionId;
    const now = Date.now();
    if (now - (this.lastActAt.get(id) ?? 0) < ACT_COOLDOWN_MS) return;
    this.lastActAt.set(id, now);
    if (!this.isCurrent(id) || now < this.actOpensAt - ACT_EARLY_MS) return;
    this.step(act);
  }

  /**
   * Plan the current step: a bot thinks, an absent player is played for, a present one gets the
   * timer. Whoever acts for a player who is not acting picks the bot's move.
   */
  private scheduleAct() {
    this.turnTimer?.clear();
    this.turnTimer = null;
    const game = this.game;
    if (!game || this.state.phase !== "playing") return;
    const player = this.state.players.get(game.turn.playerId);
    if (!player) return;
    const picking = game.turn.phase === "awaitingMove";
    const now = Date.now();
    const opens = Math.max(now, this.actOpensAt);
    const { botThinkMinMs, botThinkMaxMs, botPickMs, awayActMs } = LudoRoom.timing;
    let at: number;
    if (player.isBot) at = opens + (picking ? botPickMs : botThinkMinMs + Math.random() * (botThinkMaxMs - botThinkMinMs));
    else if (!player.connected) at = opens + awayActMs;
    else at = this.state.turnDeadline;
    this.turnTimer = this.clock.setTimeout(() => {
      const g = this.game;
      if (!g) return;
      const token = g.turn.phase === "awaitingMove" ? botMove(g) : null;
      this.step(token === null ? { type: "roll" } : { type: "move", token });
    }, Math.max(0, at - now));
  }

  /** One step of a turn: apply it, finish what needs no choice, broadcast, plan the next step. */
  private step(act: Act) {
    const game = this.game;
    if (!game || this.state.phase !== "playing") return;
    const playerId = game.turn.playerId;
    const first = reduce(game, act.type === "roll" ? { type: "ROLL", playerId } : { type: "MOVE", playerId, token: act.token });
    if (first.error) return;
    let next = first.state;
    let events: GameEvent[] = first.events;
    // a roll with only one possible move plays it at once, as Ludo King does
    const only = onlyChoice(next);
    if (act.type === "roll" && only !== null) {
      const moved = reduce(next, { type: "MOVE", playerId, token: only });
      next = moved.state;
      events = [...events, ...moved.events];
    }
    // nobody watches the server animate: finish the step at once, clients play it at their pace
    if (next.turn.phase === "animating") {
      const done = reduce(next, { type: "ANIMATION_DONE" });
      next = done.state;
      events = [...events, ...done.events];
    }
    this.game = next;
    this.applyGame();

    const over = next.turn.phase === "gameOver";
    const handoff = !over && next.turn.playerId !== playerId;
    const { playbackScale, secondMs } = LudoRoom.timing;
    const actInMs = Math.round(stepPlaybackMs(events, handoff) * playbackScale);
    const timerMs = this.state.turnSeconds * secondMs;
    this.actOpensAt = Date.now() + actInMs;
    this.state.turnDeadline = over ? 0 : this.actOpensAt + timerMs;
    if (over) this.state.phase = "finished";
    this.seq++;
    this.broadcast("step", {
      events,
      game: publicGame(next),
      seq: this.seq,
      actInMs,
      deadlineInMs: over ? 0 : actInMs + timerMs,
    } satisfies StepMessage);
    if (over) {
      this.turnTimer?.clear();
      this.turnTimer = null;
      log("game_over", { room: this.roomId });
    } else this.scheduleAct();
  }

  /** Engine state -> synced schema: places, whose turn it is, and the public game. */
  private applyGame() {
    const game = this.game;
    if (!game) return;
    for (const p of game.players) {
      const s = this.state.players.get(p.id);
      if (s) s.place = p.finishedPlace ?? 0;
    }
    this.state.currentPlayerId = game.turn.phase === "gameOver" ? "" : game.turn.playerId;
    this.state.gameJson = JSON.stringify(publicGame(game));
  }

  // ---------- lifetime ----------

  private armEmptyTimer() {
    this.clearEmptyTimer();
    this.emptyTimer = this.clock.setTimeout(() => void this.disconnect(), LudoRoom.timing.emptyRoomMs);
  }

  private clearEmptyTimer() {
    this.emptyTimer?.clear();
    this.emptyTimer = null;
  }
}
