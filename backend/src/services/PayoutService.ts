import type { PrismaClient } from '@prisma/client';
import type { Room } from '../domain/entities/Room.js';

/**
 * PayoutService — handles all money operations atomically.
 * Uses raw Prisma $transaction for atomicity (repositories alone can't do cross-table txns).
 *
 * Concurrency strategy:
 *  - deductBets: dùng raw `SELECT ... FOR UPDATE` (pessimistic lock) để lock cả 2 row
 *    trước khi đọc balance, đảm bảo không có race condition âm tiền.
 *  - DB constraint CHECK (balance >= 0) là lớp bảo vệ thứ 2 (xem migration).
 */
export class PayoutService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Atomically deduct bet amounts from both players.
   * Dùng SELECT FOR UPDATE để lock row — ngăn 2 transaction đồng thời lọt qua check balance.
   * Throws nếu bất kỳ player nào không đủ số dư.
   */
  async deductBets(hostId: string, opponentId: string, betAmount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Lock cả 2 row đồng thời để tránh deadlock (sort by id để đảm bảo thứ tự nhất quán)
      const [id1, id2] = [hostId, opponentId].sort();
      const rows = await tx.$queryRaw<{ id: string; balance: number }[]>`
        SELECT id, balance FROM "User"
        WHERE id IN (${id1}, ${id2})
        ORDER BY id
        FOR UPDATE
      `;

      const hostRow = rows.find(r => r.id === hostId);
      const oppRow  = rows.find(r => r.id === opponentId);

      if (!hostRow || hostRow.balance < betAmount) {
        throw new Error(`Host ${hostId} không đủ số dư (cần ${betAmount}, có ${hostRow?.balance ?? 0})`);
      }
      if (!oppRow || oppRow.balance < betAmount) {
        throw new Error(`Opponent ${opponentId} không đủ số dư (cần ${betAmount}, có ${oppRow?.balance ?? 0})`);
      }

      await tx.user.update({ where: { id: hostId }, data: { balance: { decrement: betAmount } } });
      await tx.walletTransaction.create({
        data: { userId: hostId, type: 'bet', amount: betAmount, status: 'completed' },
      });

      await tx.user.update({ where: { id: opponentId }, data: { balance: { decrement: betAmount } } });
      await tx.walletTransaction.create({
        data: { userId: opponentId, type: 'bet', amount: betAmount, status: 'completed' },
      });
    });
  }

  /**
   * Atomically pay out after a game ends.
   * Winner gets 2× bet. Draw refunds both.
   */
  async handlePayout(room: Room, winnerId: string | null): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.room.create({
          data: {
            hostId: room.hostId!,
            opponentId: room.opponentId,
            betAmount: room.betAmount,
            gameType: room.gameType,
            status: 'finished',
            winnerId,
          },
        });

        if (winnerId) {
          await tx.user.update({
            where: { id: winnerId },
            data: { balance: { increment: room.betAmount * 2 } },
          });
          await tx.walletTransaction.create({
            data: { userId: winnerId, type: 'win', amount: room.betAmount * 2, status: 'completed' },
          });
          console.log(`[PAYOUT] Winner ${winnerId} received ${room.betAmount * 2}`);
        } else {
          if (room.hostId) {
            await tx.user.update({ where: { id: room.hostId }, data: { balance: { increment: room.betAmount } } });
            await tx.walletTransaction.create({
              data: { userId: room.hostId, type: 'refund', amount: room.betAmount, status: 'completed' },
            });
          }
          if (room.opponentId) {
            await tx.user.update({ where: { id: room.opponentId }, data: { balance: { increment: room.betAmount } } });
            await tx.walletTransaction.create({
              data: { userId: room.opponentId, type: 'refund', amount: room.betAmount, status: 'completed' },
            });
          }
          console.log(`[PAYOUT] Draw — both refunded ${room.betAmount}`);
        }
      });
    } catch (err) {
      console.error(`[PAYOUT_ERROR] Room ${room.id}:`, err);
    }
  }
}
