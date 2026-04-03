import type { Server } from 'socket.io';
import type { RoomService } from './RoomService.js';
import type { PayoutService } from './PayoutService.js';
import type { Position, PieceSide, MoveResult } from '../domain/types.js';
import { AFK_TIMEOUT_MS } from '../domain/types.js';
import type { Room } from '../domain/entities/Room.js';

/**
 * GameService — orchestrates game flow (start, move, end, timers).
 * This is the only service that coordinates between RoomService and PayoutService.
 */
export class GameService {
  constructor(
    private roomService: RoomService,
    private payoutService: PayoutService,
  ) {}

  // ─── Start Game ──────────────────────────────────────

  async startGame(roomId: string, requesterId: string): Promise<{ success: boolean; error?: string }> {
    const room = this.roomService.getRoom(roomId);
    if (!room) return { success: false, error: 'Room not found' };
    if (!room.isHost(requesterId)) return { success: false, error: 'Chỉ chủ phòng mới có thể bắt đầu!' };
    if (!room.hasBothPlayers) return { success: false, error: 'Cần đủ 2 người chơi!' };
    if (!room.canStart()) return { success: false, error: 'Cả hai phải sẵn sàng!' };

    try {
      await this.payoutService.deductBets(room.hostId!, room.opponentId!, room.betAmount);
    } catch (err: any) {
      return { success: false, error: 'Không đủ số dư để bắt đầu!' };
    }

    room.clearAfkTimer();
    room.startGame();
    console.log(`[GAME_START] ${roomId} | Host: ${room.hostId}, Opp: ${room.opponentId}, Bet: ${room.betAmount}`);
    return { success: true };
  }

  // ─── Make Move ──────────────────────────────────────

  makeMove(roomId: string, playerId: string, newPosJson: string): MoveResult & { room: Room } | null {
    const room = this.roomService.getRoom(roomId);
    if (!room) return null;
    if (!room.isPlayer(playerId)) return null;

    let newPos: Position;
    try {
      newPos = JSON.parse(newPosJson);
      if (typeof newPos !== 'object' || Array.isArray(newPos)) throw new Error();
    } catch {
      return { valid: false, nextTurn: 'w' as PieceSide, error: 'Invalid move data', room };
    }

    const result = room.applyMove(newPos, playerId);

    if (result.valid) {
      console.log(`[MOVE] ${roomId} | ${playerId} → next: ${result.nextTurn === 'w' ? 'Red' : 'Black'}`);
    }

    return { ...result, room };
  }

  // ─── Handle Game End (payout + reset) ────────────────

  async endGame(roomId: string, winnerId: string | null): Promise<void> {
    const room = this.roomService.getRoom(roomId);
    if (!room) return;

    await this.payoutService.handlePayout(room, winnerId);
    room.resetForRematch();
    console.log(`[GAME_END] ${roomId} | Winner: ${winnerId || 'draw'}`);
  }

  // ─── Handle Abandon ─────────────────────────────────

  async handleAbandon(roomId: string, leaverId: string): Promise<string | undefined> {
    const room = this.roomService.getRoom(roomId);
    if (!room) return undefined;

    const result = room.leave(leaverId);
    if (result.abandoned && result.winnerId) {
      await this.payoutService.handlePayout(room, result.winnerId);
      room.handlePostGameLeave(leaverId);
      return result.winnerId;
    }
    return undefined;
  }

  // ─── Timer: check all rooms for timeouts ────────────

  startGameTimer(io: Server): void {
    setInterval(() => {
      for (const room of this.roomService.getAllRooms()) {
        if (room.status !== 'playing' || !room.lastMoveTimestamp) continue;

        const elapsed = Math.floor((Date.now() - room.lastMoveTimestamp) / 1000);
        const currentSide = room.turn;
        const timeRemaining = currentSide === 'w' ? room.hostTime - elapsed : room.opponentTime - elapsed;

        if (timeRemaining <= 0) {
          const winnerId = room.timeoutLoss(currentSide);
          console.log(`[TIMEOUT] ${room.id}: ${currentSide === 'w' ? 'Host' : 'Opponent'} timed out`);

          io.to(room.id).emit('game_end', { reason: 'timeout', winnerId });

          this.payoutService.handlePayout(room, winnerId).then(() => {
            room.resetForRematch();
            io.emit('room_list_update', this.roomService.getRoomList());
          });
        }
      }
    }, 5000);
  }

  // ─── AFK Timer ──────────────────────────────────────

  startAfkTimer(roomId: string, io: Server): void {
    const room = this.roomService.getRoom(roomId);
    if (!room) return;

    const timerId = setTimeout(() => {
      const kickedId = room.handleAfkKick();
      if (!kickedId) return;

      console.log(`[AFK] Host ${kickedId} kicked from ${roomId}`);
      io.to(roomId).emit('kicked', { roomId, userId: kickedId, reason: 'AFK quá 5 phút — tự động kick' });

      // If new host exists, restart AFK timer
      if (room.hostId) {
        this.startAfkTimer(roomId, io);
      }

      io.to(roomId).emit('room_state_update', room.toStateDTO());
      io.emit('room_list_update', this.roomService.getRoomList());
    }, AFK_TIMEOUT_MS);

    room.setAfkTimer(timerId);
  }
}
