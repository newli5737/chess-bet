// ─────────────────────────────────────────────────────────
// Domain Types — ZERO external dependencies
// ─────────────────────────────────────────────────────────

// ─── Value Objects ─────────────────────────────────────

export type PieceSide = 'w' | 'b';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type PlayerRole = 'host' | 'opponent' | 'spectator';
export type Position = Record<string, string>;

// ─── DTOs ──────────────────────────────────────────────

export interface UserDTO {
  id: string;
  email: string;
  password: string;
  balance: number;
  avatar: string | null;
  role: string;
  sessionId: string | null | undefined;
}

export interface RoomListItem {
  id: string;
  gameType: string;
  betAmount: number;
  status: RoomStatus;
  playerCount: number;
  hostId: string | null;
  opponentId: string | null;
  readyCount: number;
}

export interface RoomStateDTO {
  roomId: string;
  fen: string;
  status: RoomStatus;
  gameType: string;
  xiangqiTurn: PieceSide;
  hostId: string | null;
  opponentId: string | null;
  hostTime: number;
  opponentTime: number;
  lastMoveTimestamp: number;
  readyPlayers: string[];
  spectators: string[];
}

// ─── Results ───────────────────────────────────────────

export interface JoinResult {
  success: boolean;
  role: PlayerRole;
  error?: string;
}

export interface LeaveResult {
  abandoned: boolean;
  winnerId?: string;
}

export interface MoveResult {
  valid: boolean;
  nextTurn: PieceSide;
  winner?: 'host' | 'opponent' | null;
  error?: string | undefined;
}

export interface StartGameResult {
  success: boolean;
  error?: string;
}

// ─── Constants ─────────────────────────────────────────

export const GAME_TIME_LIMIT = 1200; // 20 minutes per player
export const AFK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const XIANGQI_START_POSITION: Position = {
  a1: 'wR', b1: 'wN', c1: 'wB', d1: 'wA', e1: 'wK', f1: 'wA', g1: 'wB', h1: 'wN', i1: 'wR',
  b3: 'wC', h3: 'wC',
  a4: 'wP', c4: 'wP', e4: 'wP', g4: 'wP', i4: 'wP',
  a10: 'bR', b10: 'bN', c10: 'bB', d10: 'bA', e10: 'bK', f10: 'bA', g10: 'bB', h10: 'bN', i10: 'bR',
  b8: 'bC', h8: 'bC',
  a7: 'bP', c7: 'bP', e7: 'bP', g7: 'bP', i7: 'bP',
};
