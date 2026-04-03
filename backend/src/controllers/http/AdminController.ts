import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db.js';
import { verifyAdmin } from '../../middleware/auth.js';
import { roomService } from '../../container.js';

export function createAdminController(): FastifyPluginAsync {
  return async (app) => {
    app.addHook('onRequest', verifyAdmin);

    // ─── Users ─────────────────────────────────────────────
    app.get('/users', async () => {
      return prisma.user.findMany({
        select: { id: true, email: true, balance: true, role: true, avatar: true },
        orderBy: { email: 'asc' },
      });
    });

    // ─── Rooms realtime ────────────────────────────────────
    app.get('/rooms', async () => {
      return roomService.getAllRooms().map(r => r.toStateDTO());
    });

    // ─── Deposits ──────────────────────────────────────────
    app.get('/deposits', async () => {
      return prisma.deposit.findMany({
        include: { user: { select: { email: true } }, bankAccount: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    app.post('/deposits/:id/approve', async (request: any, reply) => {
      const deposit = await prisma.deposit.findUnique({ where: { id: request.params.id } });
      if (!deposit) return reply.status(404).send({ error: 'Deposit not found' });
      if (deposit.status !== 'pending') return reply.status(400).send({ error: 'Already processed' });

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.deposit.update({
          where: { id: deposit.id },
          data: { status: 'approved' },
        });
        await tx.user.update({
          where: { id: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        });
        await tx.walletTransaction.create({
          data: { userId: deposit.userId, type: 'deposit', amount: deposit.amount, status: 'completed' },
        });
        return updated;
      });
      return result;
    });

    app.post('/deposits/:id/reject', async (request: any, reply) => {
      const deposit = await prisma.deposit.findUnique({ where: { id: request.params.id } });
      if (!deposit) return reply.status(404).send({ error: 'Deposit not found' });
      if (deposit.status !== 'pending') return reply.status(400).send({ error: 'Already processed' });

      return prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'rejected' } });
    });

    // ─── Withdrawals ───────────────────────────────────────
    app.get('/withdrawals', async () => {
      return prisma.withdrawal.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    app.post('/withdrawals/:id/approve', async (request: any, reply) => {
      const w = await prisma.withdrawal.findUnique({ where: { id: request.params.id } });
      if (!w) return reply.status(404).send({ error: 'Withdrawal not found' });
      if (w.status !== 'pending') return reply.status(400).send({ error: 'Already processed' });

      // Tiền đã bị trừ lúc user yêu cầu — chỉ cần cập nhật status
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.withdrawal.update({
          where: { id: w.id },
          data: { status: 'approved' },
        });
        await tx.walletTransaction.updateMany({
          where: { userId: w.userId, type: 'withdraw', amount: w.amount, status: 'pending' },
          data: { status: 'completed' },
        });
        return updated;
      });
      return result;
    });

    app.post('/withdrawals/:id/reject', async (request: any, reply) => {
      const w = await prisma.withdrawal.findUnique({ where: { id: request.params.id } });
      if (!w) return reply.status(404).send({ error: 'Withdrawal not found' });
      if (w.status !== 'pending') return reply.status(400).send({ error: 'Already processed' });

      // Hoàn tiền lại cho user
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.withdrawal.update({
          where: { id: w.id },
          data: { status: 'rejected' },
        });
        await tx.user.update({
          where: { id: w.userId },
          data: { balance: { increment: w.amount } },
        });
        await tx.walletTransaction.create({
          data: { userId: w.userId, type: 'refund', amount: w.amount, status: 'completed' },
        });
        return updated;
      });
      return result;
    });
  };
}
