import type { Socket, Server } from 'socket.io';
import type { RoomService } from '../../services/RoomService.js';
import type { GameService } from '../../services/GameService.js';

/**
 * RoomController — handles join/leave/kick/promote socket events.
 * Thin layer: validates input, calls services, emits responses.
 */
export class RoomController {
  constructor(
    private roomService: RoomService,
    private gameService: GameService,
  ) {}

  register(socket: Socket, io: Server) {
    const userId = socket.data.userId;
    const userEmail = socket.data.userEmail;

    socket.on('join_room', (data: { roomId: string; isSpectator?: boolean }) => {
      const room = this.roomService.getRoom(data.roomId);
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

      if (socket.data.currentRoomId && socket.data.currentRoomId !== data.roomId) {
        socket.leave(socket.data.currentRoomId);
      }
      socket.data.currentRoomId = data.roomId;
      room.addConnected(userId);
      socket.join(data.roomId);

      const result = room.join(userId, data.isSpectator);
      if (result.role === 'host') {
        this.gameService.startAfkTimer(data.roomId, io);
      }

      socket.emit('room_state_update', room.toStateDTO());
      io.emit('room_list_update', this.roomService.getRoomList());
      console.log(`[JOIN] ${userEmail} → ${data.roomId} as ${result.role.toUpperCase()}`);
    });

    socket.on('leave_room', async (data: { roomId: string }) => {
      socket.leave(data.roomId);
      const room = this.roomService.getRoom(data.roomId);
      if (!room) return;

      room.removeConnected(userId);
      socket.data.currentRoomId = undefined;

      if (room.isSpectator(userId)) {
        room.leave(userId);
        io.to(data.roomId).emit('room_state_update', room.toStateDTO());
        io.emit('room_list_update', this.roomService.getRoomList());
        return;
      }

      if (room.status === 'playing') {
        const winnerId = await this.gameService.handleAbandon(data.roomId, userId);
        if (winnerId) {
          io.to(data.roomId).emit('game_end', { reason: 'abandon', winnerId });
          if (room.hostId) this.gameService.startAfkTimer(data.roomId, io);
        }
      } else {
        room.leave(userId);
        if (room.hostId) this.gameService.startAfkTimer(data.roomId, io);
      }

      io.to(data.roomId).emit('room_state_update', room.toStateDTO());
      io.emit('room_list_update', this.roomService.getRoomList());
      console.log(`[LEAVE] ${userEmail} left ${data.roomId}`);
    });

    socket.on('kick_player', (data: { roomId: string; targetUserId: string }) => {
      const room = this.roomService.getRoom(data.roomId);
      if (!room) return;

      const kicked = room.kick(data.targetUserId, userId);
      if (!kicked) {
        socket.emit('error', { message: 'Không thể kick!' });
        return;
      }

      io.to(data.roomId).emit('kicked', { roomId: data.roomId, userId: data.targetUserId, reason: 'Chủ phòng đã kick bạn' });
      io.to(data.roomId).emit('room_state_update', room.toStateDTO());
      io.emit('room_list_update', this.roomService.getRoomList());
      console.log(`[KICK] ${data.targetUserId} from ${data.roomId}`);
    });

    socket.on('join_as_player', (data: { roomId: string }) => {
      const room = this.roomService.getRoom(data.roomId);
      if (!room) return;

      const result = room.promoteSpectator(userId);
      if (!result.success) {
        socket.emit('error', { message: result.error || 'Cannot join' });
        return;
      }
      if (result.role === 'host') {
        this.gameService.startAfkTimer(data.roomId, io);
      }

      io.to(data.roomId).emit('room_state_update', room.toStateDTO());
      io.emit('room_list_update', this.roomService.getRoomList());
      console.log(`[PROMOTE] ${userEmail} → player in ${data.roomId}`);
    });
  }
}
