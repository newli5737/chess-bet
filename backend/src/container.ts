import { prisma } from './db.js';
import { PrismaUserRepository } from './repositories/prisma/UserRepository.js';
import { RoomService } from './services/RoomService.js';
import { PayoutService } from './services/PayoutService.js';
import { GameService } from './services/GameService.js';

// ─── Repositories ──────────────────────────────────────
export const userRepo = new PrismaUserRepository(prisma);

// ─── Services ──────────────────────────────────────────
export const roomService = new RoomService();
export const payoutService = new PayoutService(prisma);
export const gameService = new GameService(roomService, payoutService);

// ─── Initialize ────────────────────────────────────────
roomService.initFixedTables();
