import type { Socket, Server } from 'socket.io';
import type { RoomService } from '../../services/RoomService.js';
import type { GameService } from '../../services/GameService.js';

/**
 * GameController — handles start_game, make_move, play_again.
 */
export class GameController {
  constructor(
    private roomService: RoomService,
    private gameService: GameService,
  ) {}

  register(socket: Socket, io: Server) {
    const userId = socket.data.userId;

    socket.on('start_game', async (data: { roomId: string }) => {
      const result = await this.gameService.startGame(data.roomId, userId);
      if (!result.success) {
        io.to(data.roomId).emit('error', { message: result.error });
        return;
      }
      const room = this.roomService.getRoom(data.roomId);
      if (room) {
        io.to(data.roomId).emit('room_state_update', room.toStateDTO());
        io.emit('room_list_update', this.roomService.getRoomList());
      }
    });

    socket.on('make_move', async (data: { roomId: string; fen: string; xiangqiTurn: 'w' | 'b' }) => {
      const result = this.gameService.makeMove(data.roomId, userId, data.fen);
      if (!result) return;

      if (!result.valid) {
        socket.emit('error', { message: result.error || 'Invalid move' });
        return;
      }

      const room = this.roomService.getRoom(data.roomId)!;

      io.to(data.roomId).emit('move_made', {
        fen: data.fen,
        gameType: 'xiangqi',
        xiangqiTurn: result.nextTurn,
        hostTime: room.hostTime,
        opponentTime: room.opponentTime,
        lastMoveTimestamp: room.lastMoveTimestamp,
      });

      if (result.winner) {
        const winnerId = result.winner === 'host' ? room.hostId! : room.opponentId!;
        io.to(data.roomId).emit('game_end', { reason: 'checkmate', winnerId });

        await this.gameService.endGame(data.roomId, winnerId);
        io.to(data.roomId).emit('room_state_update', room.toStateDTO());
        io.emit('room_list_update', this.roomService.getRoomList());
      }
    });

    socket.on('play_again', (data: { roomId: string }) => {
      const room = this.roomService.getRoom(data.roomId);
      if (!room || room.status !== 'finished' || !room.isPlayer(userId)) return;

      room.resetForRematch();
      this.gameService.startAfkTimer(data.roomId, io);

      io.to(data.roomId).emit('room_state_update', room.toStateDTO());
      io.emit('room_list_update', this.roomService.getRoomList());
      console.log(`[REMATCH] ${data.roomId}`);
    });
  }
}
