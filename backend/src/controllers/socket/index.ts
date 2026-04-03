import type { Server, Socket } from 'socket.io';
import type { RoomService } from '../../services/RoomService.js';
import type { GameService } from '../../services/GameService.js';
import { RoomController } from './RoomController.js';
import { GameController } from './GameController.js';
import { ReadyController } from './ReadyController.js';

/**
 * Socket entry point — wires connection handler and registers controllers.
 */
export function setupSocketHandlers(
  io: Server,
  roomService: RoomService,
  gameService: GameService,
) {
  // Start server-side game clock
  gameService.startGameTimer(io);

  // Create controllers
  const roomCtrl = new RoomController(roomService, gameService);
  const gameCtrl = new GameController(roomService, gameService);
  const readyCtrl = new ReadyController(roomService);

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    const userEmail = socket.data.userEmail;
    console.log(`🔗 Connected: ${socket.id} (${userEmail})`);

    // Send initial room list
    socket.emit('room_list_update', roomService.getRoomList());

    socket.on('request_room_list', () => {
      socket.emit('room_list_update', roomService.getRoomList());
    });

    // Disconnect
    socket.on('disconnect', () => {
      const roomId = socket.data.currentRoomId as string | undefined;
      if (roomId) {
        const room = roomService.getRoom(roomId);
        if (room) {
          room.handleDisconnect(userId);
          if (room.hostId) gameService.startAfkTimer(roomId, io);
          io.to(roomId).emit('room_state_update', room.toStateDTO());
          io.emit('room_list_update', roomService.getRoomList());
        }
      }
      console.log(`🔌 Disconnected: ${socket.id} (${userEmail})`);
    });

    // Register domain controllers
    roomCtrl.register(socket, io);
    gameCtrl.register(socket, io);
    readyCtrl.register(socket, io);
  });
}
