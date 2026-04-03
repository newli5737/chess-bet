import type { Socket, Server } from 'socket.io';
import type { RoomService } from '../../services/RoomService.js';

/**
 * ReadyController — handles player_ready, player_unready.
 */
export class ReadyController {
  constructor(private roomService: RoomService) {}

  register(socket: Socket, io: Server) {
    const userId = socket.data.userId;

    socket.on('player_ready', (data: { roomId: string }) => {
      const room = this.roomService.getRoom(data.roomId);
      if (!room) return;
      if (room.setReady(userId)) {
        io.to(data.roomId).emit('room_state_update', room.toStateDTO());
        console.log(`[READY] ${socket.data.userEmail} in ${data.roomId}`);
      }
    });

    socket.on('player_unready', (data: { roomId: string }) => {
      const room = this.roomService.getRoom(data.roomId);
      if (!room) return;
      if (room.setUnready(userId)) {
        io.to(data.roomId).emit('room_state_update', room.toStateDTO());
        console.log(`[UNREADY] ${socket.data.userEmail} in ${data.roomId}`);
      }
    });
  }
}
