import type { Position, PieceSide, RoomStatus, RoomStateDTO, RoomListItem, JoinResult, LeaveResult, MoveResult } from '../types.js';
import { GAME_TIME_LIMIT, XIANGQI_START_POSITION } from '../types.js';
import { XiangqiRules } from '../rules/XiangqiRules.js';

/**
 * Room entity — encapsulates all room state and business rules.
 * No external dependencies (no Prisma, no Socket.io).
 */
export class Room {
  readonly id: string;
  readonly betAmount: number;
  readonly gameType: 'xiangqi' = 'xiangqi';
  readonly isFixed: boolean;

  private _hostId: string | null = null;
  private _opponentId: string | null = null;
  private _status: RoomStatus = 'waiting';
  private _position: Position | 'start' = 'start';
  private _turn: PieceSide = 'w';
  private _spectators: string[] = [];
  private _connectedPlayers = new Set<string>();
  private _readyPlayers = new Set<string>();
  private _hostTime = GAME_TIME_LIMIT;
  private _opponentTime = GAME_TIME_LIMIT;
  private _lastMoveTimestamp = 0;
  private _hostJoinedAt = 0;
  private _afkTimerId?: ReturnType<typeof setTimeout> | undefined;

  constructor(id: string, betAmount: number, isFixed: boolean) {
    this.id = id;
    this.betAmount = betAmount;
    this.isFixed = isFixed;
  }

  // ─── Getters ─────────────────────────────────────────

  get hostId() { return this._hostId; }
  get opponentId() { return this._opponentId; }
  get status() { return this._status; }
  get turn() { return this._turn; }
  get hostTime() { return this._hostTime; }
  get opponentTime() { return this._opponentTime; }
  get lastMoveTimestamp() { return this._lastMoveTimestamp; }
  get hostJoinedAt() { return this._hostJoinedAt; }
  get spectators() { return [...this._spectators]; }
  get readyPlayers() { return Array.from(this._readyPlayers); }
  get connectedPlayers() { return this._connectedPlayers; }

  get hasEmptySlot(): boolean { return !this._hostId || !this._opponentId; }
  get hasBothPlayers(): boolean { return !!this._hostId && !!this._opponentId; }
  get bothReady(): boolean {
    return this.hasBothPlayers && this._readyPlayers.has(this._hostId!) && this._readyPlayers.has(this._opponentId!);
  }

  get playerCount(): number {
    let count = 0;
    if (this._hostId && this._connectedPlayers.has(this._hostId)) count++;
    if (this._opponentId && this._connectedPlayers.has(this._opponentId)) count++;
    return count;
  }

  get currentPosition(): Position {
    return this._position === 'start' ? { ...XIANGQI_START_POSITION } : { ...this._position };
  }

  // ─── Player management ──────────────────────────────

  isHost(userId: string): boolean { return this._hostId === userId; }
  isOpponent(userId: string): boolean { return this._opponentId === userId; }
  isPlayer(userId: string): boolean { return this.isHost(userId) || this.isOpponent(userId); }
  isSpectator(userId: string): boolean { return this._spectators.includes(userId); }

  addConnected(userId: string) { this._connectedPlayers.add(userId); }
  removeConnected(userId: string) { this._connectedPlayers.delete(userId); }

  /**
   * Try to join this room. Returns the role assigned.
   */
  join(userId: string, asSpectator = false): JoinResult {
    // Already a player — rejoin
    if (this.isPlayer(userId)) {
      return { success: true, role: this.isHost(userId) ? 'host' : 'opponent' };
    }

    // Force spectator or game in progress
    if (asSpectator || this._status === 'playing') {
      this._addSpectator(userId);
      return { success: true, role: 'spectator' };
    }

    // Fill host slot
    if (!this._hostId) {
      this._hostId = userId;
      this._hostJoinedAt = Date.now();
      this._removeSpectator(userId);
      return { success: true, role: 'host' };
    }

    // Fill opponent slot
    if (!this._opponentId) {
      this._opponentId = userId;
      this._removeSpectator(userId);
      return { success: true, role: 'opponent' };
    }

    // Room full
    this._addSpectator(userId);
    return { success: true, role: 'spectator' };
  }

  /**
   * Leave the room. Returns whether this was an abandon (during game).
   */
  leave(userId: string): LeaveResult {
    // Spectator
    if (this.isSpectator(userId)) {
      this._removeSpectator(userId);
      return { abandoned: false };
    }

    if (this._status === 'waiting') {
      this._removePlayerWhileWaiting(userId);
      return { abandoned: false };
    }

    if (this._status === 'playing') {
      const winnerId = this._hostId === userId ? this._opponentId! : this._hostId!;
      this._status = 'finished';
      return { abandoned: true, winnerId };
    }

    // Finished
    this._removePlayerAfterGame(userId);
    return { abandoned: false };
  }

  /**
   * Promote a spectator to a player slot. Only when not playing.
   */
  promoteSpectator(userId: string): JoinResult {
    if (this._status === 'playing') {
      return { success: false, role: 'spectator', error: 'Game in progress' };
    }
    if (!this.isSpectator(userId)) {
      return { success: false, role: 'spectator', error: 'Not a spectator' };
    }

    if (!this._hostId) {
      this._hostId = userId;
      this._hostJoinedAt = Date.now();
      this._removeSpectator(userId);
      return { success: true, role: 'host' };
    }
    if (!this._opponentId) {
      this._opponentId = userId;
      this._removeSpectator(userId);
      return { success: true, role: 'opponent' };
    }

    return { success: false, role: 'spectator', error: 'Room full' };
  }

  // ─── Ready system ───────────────────────────────────

  setReady(userId: string): boolean {
    if (this._status !== 'waiting' || !this.isPlayer(userId)) return false;
    this._readyPlayers.add(userId);
    return true;
  }

  setUnready(userId: string): boolean {
    if (this._status !== 'waiting' || !this.isPlayer(userId)) return false;
    this._readyPlayers.delete(userId);
    return true;
  }

  // ─── Kick ───────────────────────────────────────────

  kick(targetId: string, requesterId: string): boolean {
    if (!this.isHost(requesterId)) return false;
    if (this._status === 'playing') return false;
    if (this._opponentId !== targetId) return false;

    this._readyPlayers.delete(targetId);
    this._opponentId = null;
    return true;
  }

  // ─── Game flow ──────────────────────────────────────

  canStart(): boolean {
    return this._status === 'waiting' && this.bothReady;
  }

  startGame(): void {
    this._status = 'playing';
    this._position = { ...XIANGQI_START_POSITION };
    this._turn = 'w';
    this._hostTime = GAME_TIME_LIMIT;
    this._opponentTime = GAME_TIME_LIMIT;
    this._lastMoveTimestamp = Date.now();
    this._readyPlayers.clear();
  }

  applyMove(newPos: Position, playerId: string): MoveResult {
    if (this._status !== 'playing') {
      return { valid: false, nextTurn: this._turn, error: 'Game not in progress' };
    }

    // Turn check
    const expectedPlayer = this._turn === 'w' ? this._hostId : this._opponentId;
    if (expectedPlayer !== playerId) {
      return { valid: false, nextTurn: this._turn, error: 'Not your turn' };
    }

    // Validate move
    const oldPos = this.currentPosition;
    const validation = XiangqiRules.validateMove(oldPos, newPos, this._turn);
    if (!validation.valid) {
      return { valid: false, nextTurn: this._turn, error: validation.error };
    }

    // Deduct time
    if (this._lastMoveTimestamp) {
      const elapsed = Math.floor((Date.now() - this._lastMoveTimestamp) / 1000);
      if (this._turn === 'w') {
        this._hostTime = Math.max(0, this._hostTime - elapsed);
      } else {
        this._opponentTime = Math.max(0, this._opponentTime - elapsed);
      }
    }
    this._lastMoveTimestamp = Date.now();

    // Apply
    this._position = newPos;
    const nextTurn: PieceSide = this._turn === 'w' ? 'b' : 'w';
    this._turn = nextTurn;

    // Check winner
    const winner = XiangqiRules.checkWinner(newPos);

    return { valid: true, nextTurn, winner };
  }

  /**
   * Called by timer when a player runs out of time.
   */
  timeoutLoss(side: PieceSide): string {
    this._status = 'finished';
    if (side === 'w') {
      this._hostTime = 0;
      return this._opponentId!;
    } else {
      this._opponentTime = 0;
      return this._hostId!;
    }
  }

  /**
   * Finish and reset room for a new game (after payout completes).
   */
  resetForRematch(): void {
    this._status = 'waiting';
    this._position = 'start';
    this._turn = 'w';
    this._hostTime = GAME_TIME_LIMIT;
    this._opponentTime = GAME_TIME_LIMIT;
    this._lastMoveTimestamp = 0;
    this._readyPlayers.clear();
    this._hostJoinedAt = Date.now();
  }

  /**
   * Clean up after a player leaves during/after game.
   * Keeps the remaining player as host.
   */
  handlePostGameLeave(leaverId: string): void {
    if (this._hostId === leaverId) {
      this._hostId = this._opponentId;
      this._opponentId = null;
    } else if (this._opponentId === leaverId) {
      this._opponentId = null;
    }
    this._readyPlayers.delete(leaverId);
    this._status = 'waiting';
    this._position = 'start';
    this._turn = 'w';
    this._hostTime = GAME_TIME_LIMIT;
    this._opponentTime = GAME_TIME_LIMIT;
    this._lastMoveTimestamp = 0;
    this._readyPlayers.clear();
    if (this._hostId) {
      this._hostJoinedAt = Date.now();
    }
  }

  // ─── AFK timer management ──────────────────────────

  setAfkTimer(timerId: ReturnType<typeof setTimeout>) {
    this.clearAfkTimer();
    this._afkTimerId = timerId;
  }

  clearAfkTimer() {
    if (this._afkTimerId) {
      clearTimeout(this._afkTimerId);
      this._afkTimerId = undefined;
    }
  }

  handleAfkKick(): string | null {
    if (this._status !== 'waiting' || !this._hostId) return null;

    const kickedHostId = this._hostId;
    this._readyPlayers.delete(kickedHostId);
    this._connectedPlayers.delete(kickedHostId);

    if (this._opponentId) {
      this._hostId = this._opponentId;
      this._opponentId = null;
      this._readyPlayers.delete(this._hostId);
      this._hostJoinedAt = Date.now();
    } else {
      this._hostId = null;
      this._hostJoinedAt = 0;
    }

    return kickedHostId;
  }

  // ─── Disconnect handling ────────────────────────────

  handleDisconnect(userId: string): void {
    this._connectedPlayers.delete(userId);
    this._removeSpectator(userId);

    if (this._status === 'waiting') {
      this._removePlayerWhileWaiting(userId);
    }
  }

  // ─── Serialization ─────────────────────────────────

  toStateDTO(): RoomStateDTO {
    return {
      roomId: this.id,
      fen: this._position === 'start' ? 'start' : JSON.stringify(this._position),
      status: this._status,
      gameType: this.gameType,
      xiangqiTurn: this._turn,
      hostId: this._hostId,
      opponentId: this._opponentId,
      hostTime: this._hostTime,
      opponentTime: this._opponentTime,
      lastMoveTimestamp: this._lastMoveTimestamp,
      readyPlayers: Array.from(this._readyPlayers),
      spectators: [...this._spectators],
    };
  }

  toListItem(): RoomListItem {
    return {
      id: this.id,
      gameType: this.gameType,
      betAmount: this.betAmount,
      status: this._status,
      playerCount: this.playerCount,
      hostId: this._hostId,
      opponentId: this._opponentId,
      readyCount: this._readyPlayers.size,
    };
  }

  // ─── Private helpers ────────────────────────────────

  private _addSpectator(userId: string) {
    if (!this._spectators.includes(userId)) this._spectators.push(userId);
  }

  private _removeSpectator(userId: string) {
    this._spectators = this._spectators.filter(id => id !== userId);
  }

  private _removePlayerWhileWaiting(userId: string) {
    if (this._hostId === userId) {
      this.clearAfkTimer();
      this._readyPlayers.delete(userId);
      if (this._opponentId) {
        this._hostId = this._opponentId;
        this._opponentId = null;
        this._readyPlayers.delete(this._hostId);
        this._hostJoinedAt = Date.now();
      } else {
        this._hostId = null;
        this._hostJoinedAt = 0;
      }
    } else if (this._opponentId === userId) {
      this._opponentId = null;
      this._readyPlayers.delete(userId);
    }
  }

  private _removePlayerAfterGame(userId: string) {
    if (this._hostId === userId) {
      this._hostId = this._opponentId;
      this._opponentId = null;
    } else if (this._opponentId === userId) {
      this._opponentId = null;
    }
    this._readyPlayers.delete(userId);
    this._status = 'waiting';
    this._position = 'start';
    this._turn = 'w';
    this._hostTime = GAME_TIME_LIMIT;
    this._opponentTime = GAME_TIME_LIMIT;
    this._lastMoveTimestamp = 0;
    this._readyPlayers.clear();
    if (this._hostId) {
      this._hostJoinedAt = Date.now();
    }
  }
}
