import type { PrismaClient } from '@prisma/client';
import type { ITransactionRepository } from '../interfaces/ITransactionRepository.js';

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    type: string;
    amount: number;
    status: string;
  }): Promise<void> {
    await this.prisma.walletTransaction.create({ data });
  }
}
