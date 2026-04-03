import type { PrismaClient } from '@prisma/client';
import type { IRoomHistoryRepository } from '../interfaces/IRoomHistoryRepository.js';

export class PrismaRoomHistoryRepository implements IRoomHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  async createRecord(data: {
    hostId: string;
    opponentId: string | null;
    betAmount: number;
    gameType: string;
    status: string;
    winnerId: string | null;
  }): Promise<void> {
    await this.prisma.room.create({ data });
  }
}
