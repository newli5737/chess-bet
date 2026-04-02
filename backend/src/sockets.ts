import type { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { prisma } from './db.js';

interface Room {
  id: string;
  hostId: string;
  opponentId: string | null;
  betAmount: number;
  gameType: 'chess' | 'xiangqi';
  chess?: Chess;
  xiangqiFen?: string;
  xiangqiTurn?: 'w' | 'b';
  status: 'waiting' | 'playing' | 'finished';
  spectators: string[];
  connectedPlayers?: Set<string>;
}

const rooms: Record<string, Room> = {};

const getRoomList = () => Object.values(rooms).map(r => {
  let count = 0;
  if (r.connectedPlayers?.has(r.hostId)) count++;
  if (r.opponentId && r.connectedPlayers?.has(r.opponentId)) count++;
  return { 
    id: r.id, 
    gameType: r.gameType, 
    betAmount: r.betAmount, 
    status: r.status,
    playerCount: count
  };
});

export default function setupSocketHandlers(io: Server) {
  // Hydrate rooms from DB on startup (useful if backend reboots while games are active)
  prisma.room.findMany({ where: { status: { in: ['waiting', 'playing'] } } }).then(dbRooms => {
    for (const r of dbRooms) {
      if (!rooms[r.id]) {
        rooms[r.id] = {
           id: r.id,
           hostId: r.hostId,
           opponentId: r.opponentId,
           betAmount: r.betAmount,
           gameType: (r.gameType as any) || 'chess',
           chess: r.gameType === 'xiangqi' ? undefined : new Chess(),
           xiangqiFen: r.gameType === 'xiangqi' ? 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w' : undefined,
           xiangqiTurn: 'w',
           status: r.status as any,
           spectators: [],
           connectedPlayers: new Set()
        };
      }
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('🔗 Client connected:', socket.id);
    socket.emit('room_list_update', getRoomList());

    socket.on('request_room_list', () => {
      socket.emit('room_list_update', getRoomList());
    });

    // A mapping from socket.id to userId should be ideally maintained.
    // We expect the client to send their userId when creating/joining.

    socket.on('disconnect', () => {
      const roomId = (socket as any).currentRoomId;
      const userId = (socket as any).currentUserId;
      if (roomId && userId && rooms[roomId]) {
         rooms[roomId].connectedPlayers?.delete(userId);
         io.emit('room_list_update', getRoomList());
      }
    });

    // Create a new room
    socket.on('create_room', async (data: { userId: string; betAmount: number; gameType: 'chess' | 'xiangqi' }) => {
      console.log('🎲 create_room request received:', data);
      try {
        const user = await prisma.user.findUnique({ where: { id: data.userId } });
        if (!user || user.balance < data.betAmount) {
          socket.emit('error', { message: 'Insufficient balance or invalid user' });
          return;
        }

        const roomRecord = await prisma.room.create({
          data: {
            hostId: data.userId,
            betAmount: data.betAmount,
            gameType: data.gameType || 'chess',
            status: 'waiting'
          }
        });

        const roomId = roomRecord.id;
        rooms[roomId] = {
          id: roomId,
          hostId: data.userId,
          opponentId: null,
          betAmount: data.betAmount,
          gameType: data.gameType || 'chess',
          chess: data.gameType === 'xiangqi' ? undefined : new Chess(),
          xiangqiFen: data.gameType === 'xiangqi' ? 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w' : undefined,
          xiangqiTurn: 'w',
          status: 'waiting',
          spectators: [],
          connectedPlayers: new Set()
        };

        socket.join(roomId);
        socket.emit('room_created', { 
          roomId, 
          room: { id: roomId, hostId: data.userId, betAmount: data.betAmount, gameType: data.gameType || 'chess', status: 'waiting' } 
        });
        io.emit('room_list_update', getRoomList());
      } catch (err) {
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // Join a room (as opponent or spectator)
    socket.on('join_room', async (data: { userId: string; roomId: string; isSpectator?: boolean }) => {
      const room = rooms[data.roomId];
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // Track connection locally
      (socket as any).currentRoomId = data.roomId;
      (socket as any).currentUserId = data.userId;
      room.connectedPlayers = room.connectedPlayers || new Set();
      room.connectedPlayers.add(data.userId);
      io.emit('room_list_update', getRoomList());

      if (data.isSpectator) {
        room.spectators.push(data.userId);
        socket.join(data.roomId);
        const fen = room.gameType === 'xiangqi' ? room.xiangqiFen : room.chess?.fen();
        socket.emit('game_state', { fen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn });
        return;
      }

      if (room.hostId === data.userId || room.opponentId === data.userId) {
        // Rejoining
        socket.join(data.roomId);
        const fen = room.gameType === 'xiangqi' ? room.xiangqiFen : room.chess?.fen();
        socket.emit('game_state', { fen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn });
        return;
      }

      // Check balance before joining
      const user = await prisma.user.findUnique({ where: { id: data.userId } });
      if (!user || user.balance < room.betAmount) {
        socket.emit('error', { message: 'Insufficient balance to join' });
        return;
      }

      // First one to join becomes opponent
      if (!room.opponentId) {
        room.opponentId = data.userId;
        room.status = 'playing';

        // Lock funds here ideally (transaction)
        await prisma.room.update({
          where: { id: data.roomId },
          data: { opponentId: data.userId, status: 'playing' }
        });

        socket.join(data.roomId);
        io.to(data.roomId).emit('room_update', { roomId: data.roomId, status: 'playing', opponentId: data.userId });
        const fen = room.gameType === 'xiangqi' ? room.xiangqiFen : room.chess?.fen();
        io.to(data.roomId).emit('game_state', { fen, status: room.status, gameType: room.gameType });
        io.emit('room_list_update', getRoomList());
      } else {
        // Auto assign as spectator if trying to join full room
        room.spectators.push(data.userId);
        socket.join(data.roomId);
        const fen = room.gameType === 'xiangqi' ? room.xiangqiFen : room.chess?.fen();
        socket.emit('game_state', { fen, status: room.status, gameType: room.gameType });
      }
    });

    // Handle Moves
    socket.on('make_move', (data: { roomId: string; userId: string; move?: any; fen?: string; xiangqiTurn?: 'w'|'b'; winnerId?: string | null }) => {
      const room = rooms[data.roomId];
      if (!room || room.status !== 'playing') return;

      // Ensure user is part of the game
      if (room.hostId !== data.userId && room.opponentId !== data.userId) return;

      if (room.gameType === 'xiangqi') {
        // Trust the client for Xiangqi MVP
        room.xiangqiFen = data.fen;
        if (data.xiangqiTurn) room.xiangqiTurn = data.xiangqiTurn;
        io.to(data.roomId).emit('move_made', { fen: data.fen, gameType: 'xiangqi', xiangqiTurn: room.xiangqiTurn });
        
        // Did anyone win? Let frontend tell us for now
        if (data.winnerId !== undefined) {
           room.status = 'finished';
           handlePayout(data.roomId, data.winnerId);
        }
        return;
      }

      const turn = room.chess!.turn() === 'w' ? room.hostId : room.opponentId;
      if (turn !== data.userId) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      try {
        const moveResult = room.chess!.move(data.move);
        io.to(data.roomId).emit('move_made', { move: moveResult, fen: room.chess!.fen(), gameType: 'chess' });

        if (room.chess!.isGameOver()) {
          room.status = 'finished';
          let winnerId = null;

          if (room.chess!.isCheckmate()) {
            winnerId = data.userId; // the one who just moved won
          }

          handlePayout(data.roomId, winnerId);
        }
      } catch (err) {
        socket.emit('error', { message: 'Invalid Move' });
      }
      
      function handlePayout(roomId: string, winnerId: string | null) {
          io.to(roomId).emit('game_end', {
            reason: winnerId ? 'checkmate' : 'draw',
            winnerId
          });

          // Update DB and process wallet transactions asynchronously
          prisma.room.update({
            where: { id: data.roomId },
            data: { status: 'finished', winnerId }
          }).then(async () => {
            io.emit('room_list_update', getRoomList());
            
            // Handle betting payout logic
            if (winnerId) {
              const loserId = winnerId === room.hostId ? room.opponentId! : room.hostId;

              // Deduct from loser
              await prisma.user.update({
                where: { id: loserId },
                data: { balance: { decrement: room.betAmount } }
              });
              await prisma.walletTransaction.create({
                data: { userId: loserId, type: 'bet', amount: room.betAmount, status: 'completed' }
              });

              // Add to winner
              await prisma.user.update({
                where: { id: winnerId },
                data: { balance: { increment: room.betAmount } }
              });
              await prisma.walletTransaction.create({
                data: { userId: winnerId, type: 'win', amount: room.betAmount, status: 'completed' }
              });
            }
          });
      }
    });

    socket.on('leave_room', (data: { roomId: string; userId?: string }) => {
      socket.leave(data.roomId);
      const room = rooms[data.roomId];
      if (room && data.userId) {
         room.connectedPlayers?.delete(data.userId);
         io.emit('room_list_update', getRoomList());
      }
    });
  });
}
