import type { Server, Socket } from 'socket.io';
import { prisma } from './db.js';

interface Room {
  id: string;
  hostId: string | null;
  opponentId: string | null;
  betAmount: number;
  gameType: 'xiangqi';
  xiangqiFen?: string | undefined;
  xiangqiTurn?: 'w' | 'b' | undefined;
  status: 'waiting' | 'playing' | 'finished';
  spectators: string[];
  connectedPlayers?: Set<string> | undefined;
  isFixed?: boolean | undefined;
  hostTimeRemaining?: number;
  opponentTimeRemaining?: number;
  lastMoveTimestamp?: number;
  readyPlayers?: Set<string>;
}

const rooms: Record<string, Room> = {};

// Initialize 30 fixed tables
const initFixedTables = () => {
   const levels = [
      { prefix: 'basic', bet: 50000 },
      { prefix: 'medium', bet: 500000 },
      { prefix: 'premium', bet: 2000000 }
   ];
   
   levels.forEach(level => {
      for(let i=1; i<=10; i++) {
         const id = `table-${level.prefix}-${i}`;
         rooms[id] = {
            id,
            hostId: null,
            opponentId: null,
            betAmount: level.bet,
            gameType: 'xiangqi',
            status: 'waiting',
            spectators: [],
            connectedPlayers: new Set(),
            isFixed: true,
            xiangqiFen: 'start',
            xiangqiTurn: 'w',
            hostTimeRemaining: 1200,
            opponentTimeRemaining: 1200,
            lastMoveTimestamp: 0
         };
      }
   });
};
initFixedTables();

const getRoomList = () => Object.values(rooms).map(r => {
  let count = 0;
  if (r.hostId && r.connectedPlayers?.has(r.hostId)) count++;
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
           gameType: 'xiangqi',
           xiangqiFen: 'start',
           xiangqiTurn: 'w',
           hostTimeRemaining: 1200,
           opponentTimeRemaining: 1200,
           lastMoveTimestamp: 0,
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
         
         // If waiting and host disconnected, we could clear hostId so table is empty again
         if (rooms[roomId].status === 'waiting' && rooms[roomId].hostId === userId) {
            rooms[roomId].hostId = null;
         }
         io.emit('room_list_update', getRoomList());
      }
    });

    // Create a new room dynamically (Admin/Test only)
    socket.on('create_room', async (data: { userId: string; betAmount: number; gameType: 'xiangqi' }) => {
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
            gameType: 'xiangqi',
            status: 'waiting'
          }
        });

        const roomId = roomRecord.id;
        rooms[roomId] = {
          id: roomId,
          hostId: data.userId,
          opponentId: null,
          betAmount: data.betAmount,
          gameType: 'xiangqi',
          xiangqiFen: 'start',
          xiangqiTurn: 'w',
          status: 'waiting',
          spectators: [],
          connectedPlayers: new Set()
        };

        socket.join(roomId);
        socket.emit('room_created', { 
          roomId, 
          room: { id: roomId, hostId: data.userId, betAmount: data.betAmount, gameType: 'xiangqi', status: 'waiting' } 
        });
        io.emit('room_list_update', getRoomList());
      } catch (err) {
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // Join a room (as opponent or spectator, or filling an empty table)
    socket.on('join_room', async (data: { userId: string; roomId: string; isSpectator?: boolean }) => {
      const room = rooms[data.roomId];
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      (socket as any).currentRoomId = data.roomId;
      (socket as any).currentUserId = data.userId;
      room.connectedPlayers = room.connectedPlayers || new Set();
      room.connectedPlayers.add(data.userId);

      if (data.isSpectator) {
        room.spectators.push(data.userId);
        socket.join(data.roomId);
        const fen = room.xiangqiFen;
        socket.emit('game_state', { fen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn, hostId: room.hostId, opponentId: room.opponentId, hostTime: room.hostTimeRemaining, opponentTime: room.opponentTimeRemaining, lastMoveTimestamp: room.lastMoveTimestamp });
        io.emit('room_list_update', getRoomList());
        
        console.log(`[JOIN_ROOM] ${data.userId} joined ${data.roomId} as SPECTATOR. Status: ${room.status}`);
        return;
      }

      if (room.hostId === data.userId || room.opponentId === data.userId) {
        // Rejoining
        socket.join(data.roomId);
        const fen = room.xiangqiFen;
        socket.emit('game_state', { fen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn, hostId: room.hostId, opponentId: room.opponentId, hostTime: room.hostTimeRemaining, opponentTime: room.opponentTimeRemaining, lastMoveTimestamp: room.lastMoveTimestamp });
        io.emit('room_list_update', getRoomList());
        
        console.log(`[JOIN_ROOM] ${data.userId} rejoined ${data.roomId} as PLAYER. Status: ${room.status}`);
        return;
      }

      // Check balance before joining as player
      const user = await prisma.user.findUnique({ where: { id: data.userId } });
      if (!user || user.balance < room.betAmount) {
        socket.emit('error', { message: 'Không đủ số dư để tham gia bàn này!' });
        return;
      }

      // Claim empty host slot
      if (!room.hostId) {
        await prisma.user.update({ where: { id: data.userId }, data: { balance: { decrement: room.betAmount } } });
        await prisma.walletTransaction.create({ data: { userId: data.userId, type: 'bet', amount: room.betAmount, status: 'completed' } });
        room.hostId = data.userId;
        socket.join(data.roomId);
        io.to(data.roomId).emit('room_update', { roomId: data.roomId, status: 'waiting' });
        io.emit('room_list_update', getRoomList());
        
        console.log(`[ROOM_STATE] ${data.roomId} is now WAITING (1/2). Host: ${data.userId} (Deducted ${room.betAmount})`);
        return;
      }

      // First one to join after host becomes opponent
      if (!room.opponentId) {
        await prisma.user.update({ where: { id: data.userId }, data: { balance: { decrement: room.betAmount } } });
        await prisma.walletTransaction.create({ data: { userId: data.userId, type: 'bet', amount: room.betAmount, status: 'completed' } });
        room.opponentId = data.userId;
        room.status = 'playing';

        // Write to DB history only when a game actually starts!
        if (room.isFixed) {
          // Can create a match history record if needed for tracking
        }

        socket.join(data.roomId);
        io.to(data.roomId).emit('room_update', { roomId: data.roomId, status: 'playing', opponentId: data.userId });
        const fen = room.xiangqiFen;
        room.lastMoveTimestamp = Date.now();
        io.to(data.roomId).emit('game_state', { fen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn, hostId: room.hostId, opponentId: room.opponentId, hostTime: room.hostTimeRemaining, opponentTime: room.opponentTimeRemaining, lastMoveTimestamp: room.lastMoveTimestamp });
        io.emit('room_list_update', getRoomList());
        
        console.log(`[ROOM_STATE] ${data.roomId} is now PLAYING (2/2). Host: ${room.hostId}, Opponent: ${room.opponentId}`);
      } else {
        // Full room -> spectators
        room.spectators.push(data.userId);
        socket.join(data.roomId);
        const fen = room.xiangqiFen;
        socket.emit('game_state', { fen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn, hostId: room.hostId, opponentId: room.opponentId });
        
        console.log(`[JOIN_ROOM] ${data.userId} joined ${data.roomId} as SPECTATOR (Room Full).`);
      }
    });

    // Handle Moves
    socket.on('make_move', (data: { roomId: string; userId: string; move?: any; fen?: string; xiangqiTurn?: 'w'|'b'; winnerId?: string | null }) => {
      const room = rooms[data.roomId];
      if (!room || room.status !== 'playing') return;

      if (room.hostId !== data.userId && room.opponentId !== data.userId) return;

      const expectedTurnUserId = room.xiangqiTurn === 'w' ? room.hostId : room.opponentId;
      if (expectedTurnUserId !== data.userId) {
        socket.emit('error', { message: 'Chưa đến lượt của bạn!' });
        console.warn(`[CHEAT_ATTEMPT] User ${data.userId} tried to move out of turn in ${data.roomId}`);
        return;
      }

      // Timer diff deduction
      if (room.lastMoveTimestamp) {
        const timeTaken = Math.floor((Date.now() - room.lastMoveTimestamp) / 1000);
        if (room.xiangqiTurn === 'w') {
           room.hostTimeRemaining = Math.max(0, (room.hostTimeRemaining || 1200) - timeTaken);
        } else {
           room.opponentTimeRemaining = Math.max(0, (room.opponentTimeRemaining || 1200) - timeTaken);
        }
      }
      room.lastMoveTimestamp = Date.now();

      // Trust the client for Xiangqi MVP piece movement
      room.xiangqiFen = data.fen;
      if (data.xiangqiTurn) room.xiangqiTurn = data.xiangqiTurn;
      
      let winnerId = data.winnerId;
      if (data.fen) {
        try {
           const fenObj = data.fen.startsWith('{') ? JSON.parse(data.fen) : null;
           if (fenObj && typeof fenObj === 'object') {
              const pieces = Object.values(fenObj) as string[];
              if (!pieces.includes('bK')) {
                 winnerId = room.hostId; // Red (Host) wins
              } else if (!pieces.includes('wK')) {
                 winnerId = room.opponentId; // Black (Opponent) wins
              }
           }
        } catch(e) {}
      }

      io.to(data.roomId).emit('move_made', { fen: data.fen, gameType: 'xiangqi', xiangqiTurn: room.xiangqiTurn, hostTime: room.hostTimeRemaining, opponentTime: room.opponentTimeRemaining, lastMoveTimestamp: room.lastMoveTimestamp });
      
      console.log(`[MOVE] ${data.roomId} | User ${data.userId} played. Next turn: ${room.xiangqiTurn === 'w' ? 'Red' : 'Black'}. FEN: ${room.xiangqiFen?.substring(0, 30)}...`);

      // Did anyone win? Let frontend tell us for now, OR rely on backend check
      if (winnerId !== undefined && winnerId !== null) {
         room.status = 'finished';
         console.log(`[GAME_END] ${data.roomId} | Winner: ${winnerId || 'Draw'}`);
         handlePayout(data.roomId, winnerId);
      }
      return;
      
      function handlePayout(roomId: string, winnerId: string | null) {
          io.to(roomId).emit('game_end', {
            reason: winnerId ? 'checkmate' : 'draw',
            winnerId
          });

          // Async payout processing
          Promise.resolve().then(async () => {
            
            if (winnerId) {
              const loserId = winnerId === room!.hostId ? room!.opponentId! : room!.hostId!;
              // Create room record since we don't save DB at start for fixed tables
              await prisma.room.create({
                 data: {
                    hostId: room!.hostId!,
                    opponentId: room!.opponentId,
                    betAmount: room!.betAmount,
                    gameType: room!.gameType,
                    status: 'finished',
                    winnerId: winnerId
                 }
              });

              // Add to winner (x2 because both lost betAmount upfront)
              await prisma.user.update({
                where: { id: winnerId },
                data: { balance: { increment: room!.betAmount * 2 } }
              });
              await prisma.walletTransaction.create({
                data: { userId: winnerId, type: 'win', amount: room!.betAmount * 2, status: 'completed' }
              });
            } else {
               // Draw! Refund both players
               if (room!.hostId) {
                 await prisma.user.update({ where: { id: room!.hostId }, data: { balance: { increment: room!.betAmount } } });
               }
               if (room!.opponentId) {
                 await prisma.user.update({ where: { id: room!.opponentId }, data: { balance: { increment: room!.betAmount } } });
               }
            }

            // DO NOT kick them out. Let them choose to play again or leave.
            // But reset internal board state silently so if they replay it's fast
            room!.xiangqiFen = 'start';
            room!.xiangqiTurn = 'w';
            room!.hostTimeRemaining = 1200;
            room!.opponentTimeRemaining = 1200;
            room!.lastMoveTimestamp = 0;
            room!.readyPlayers = new Set();
            
            console.log(`[GAME_WAIT_REMATCH] ${data.roomId} waiting for players to rematch or leave.`);
            io.emit('room_list_update', getRoomList());
          });
      }
    });

    socket.on('play_again', async (data: { roomId: string; userId: string }) => {
       const room = rooms[data.roomId];
       if (room && room.status === 'finished') {
           room.readyPlayers = room.readyPlayers || new Set();
           room.readyPlayers.add(data.userId);
           io.to(data.roomId).emit('player_ready', { userId: data.userId });
           console.log(`[PLAY_AGAIN] User ${data.userId} is ready for rematch in ${data.roomId}`);
           
           if (room.readyPlayers.size === 2 && room.hostId && room.opponentId) {
               // Both are ready, start new match!
               // 1. Deduct bets again!
               const host = await prisma.user.findUnique({ where: { id: room.hostId } });
               const opp = await prisma.user.findUnique({ where: { id: room.opponentId } });
               if (!host || host.balance < room.betAmount || !opp || opp.balance < room.betAmount) {
                     io.to(data.roomId).emit('error', { message: 'Một trong hai người không đủ số dư để đấu lại!' });
                     return;
               }
               // Deduct host
               await prisma.user.update({ where: { id: room.hostId }, data: { balance: { decrement: room.betAmount } } });
               await prisma.walletTransaction.create({ data: { userId: room.hostId, type: 'bet', amount: room.betAmount, status: 'completed' } });
               // Deduct opponent
               await prisma.user.update({ where: { id: room.opponentId }, data: { balance: { decrement: room.betAmount } } });
               await prisma.walletTransaction.create({ data: { userId: room.opponentId, type: 'bet', amount: room.betAmount, status: 'completed' } });

               // 2. Start game
               room.status = 'playing';
               room.xiangqiFen = 'start';
               room.xiangqiTurn = 'w';
               room.hostTimeRemaining = 1200;
               room.opponentTimeRemaining = 1200;
               room.lastMoveTimestamp = Date.now();
               room.readyPlayers.clear();
               io.to(data.roomId).emit('room_update', { roomId: data.roomId, status: 'playing', opponentId: room.opponentId });
               io.to(data.roomId).emit('game_state', { fen: room.xiangqiFen, status: room.status, gameType: room.gameType, xiangqiTurn: room.xiangqiTurn, hostId: room.hostId, opponentId: room.opponentId, hostTime: room.hostTimeRemaining, opponentTime: room.opponentTimeRemaining, lastMoveTimestamp: room.lastMoveTimestamp });
               io.emit('room_list_update', getRoomList());
               console.log(`[REMATCH_START] ${data.roomId} has started a new match!`);
           }
       }
    });

    socket.on('leave_room', (data: { roomId: string; userId?: string }) => {
      socket.leave(data.roomId);
      const room = rooms[data.roomId];
      if (room && data.userId) {
         room.connectedPlayers?.delete(data.userId);
         if (room.status === 'waiting' && room.hostId === data.userId) {
             // Refund Host
             prisma.user.update({ where: { id: data.userId }, data: { balance: { increment: room.betAmount } } }).catch(console.error);
             room.hostId = null;
             console.log(`[LEAVE_ROOM] Host ${data.userId} left waiting room ${data.roomId}. Refunded. Table is now empty.`);
         } else if (room.status === 'playing') {
             // Player abandons game! Other player wins!
             if (room.hostId === data.userId && room.opponentId) {
                 console.log(`[ABANDON] Host ${data.userId} left! Opponent ${room.opponentId} wins!`);
                 if (room.status !== 'finished') {
                    room.status = 'finished';
                    // The function is bound to the outer scope but we can just emit here
                    io.to(data.roomId).emit('game_end', { reason: 'checkmate', winnerId: room.opponentId });
                    
                    // Simple inline payout logic to prevent calling undefined function
                    prisma.user.update({ where: { id: room.opponentId }, data: { balance: { increment: room.betAmount * 2 } } }).catch(console.error);
                    
                    room.hostId = null;
                    room.opponentId = null;
                    room.status = 'waiting';
                    room.spectators = [];
                    room.xiangqiFen = 'start';
                    room.xiangqiTurn = 'w';
                    io.emit('room_list_update', getRoomList());
                 }
             } else if (room.opponentId === data.userId && room.hostId) {
                 console.log(`[ABANDON] Opponent ${data.userId} left! Host ${room.hostId} wins!`);
                 if (room.status !== 'finished') {
                    room.status = 'finished';
                    io.to(data.roomId).emit('game_end', { reason: 'checkmate', winnerId: room.hostId });
                    
                    prisma.user.update({ where: { id: room.hostId }, data: { balance: { increment: room.betAmount * 2 } } }).catch(console.error);
                    
                    room.hostId = null;
                    room.opponentId = null;
                    room.status = 'waiting';
                    room.spectators = [];
                    room.xiangqiFen = 'start';
                    room.xiangqiTurn = 'w';
                    io.emit('room_list_update', getRoomList());
                 }
             }
         } else if (room.status === 'finished') {
             // Leave while waiting to play again
             if (room.hostId === data.userId) {
                 room.hostId = room.opponentId; // other player becomes host of waiting room
                 room.opponentId = null;
             } else if (room.opponentId === data.userId) {
                 room.opponentId = null;
             }
             room.status = 'waiting';
             room.xiangqiFen = 'start';
             room.xiangqiTurn = 'w';
             room.readyPlayers?.clear();
             io.to(data.roomId).emit('room_update', { roomId: data.roomId, status: 'waiting' });
             console.log(`[LEAVE_ROOM] Player left finished table ${data.roomId}. Now waiting.`);
         }
         io.emit('room_list_update', getRoomList());
      }
    });
  });
}
