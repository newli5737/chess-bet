import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { verifyAdmin } from '../middleware/auth.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', verifyAdmin);

  app.get('/users', async (request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, balance: true, avatar: true },
      orderBy: { email: 'asc' }
    });
    return users;
  });

  app.get('/deposits', async (request, reply) => {
    const deposits = await prisma.deposit.findMany({
      include: { user: { select: { email: true } }, bankAccount: true },
      orderBy: { createdAt: 'desc' }
    });
    return deposits;
  });

  app.post('/deposits/:id/approve', async (request: any, reply) => {
    const { id } = request.params;
    
    // Using transaction to ensure deposit status update and balance update are atomic
    const result = await prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({ where: { id } });
      if (!deposit) throw new Error('Deposit not found');
      if (deposit.status !== 'pending') throw new Error('Deposit is not pending');

      const updatedDeposit = await tx.deposit.update({
        where: { id },
        data: { status: 'approved' }
      });

      const updatedUser = await tx.user.update({
        where: { id: deposit.userId },
        data: { balance: { increment: deposit.amount } }
      });

      await tx.walletTransaction.create({
        data: {
          userId: deposit.userId,
          type: 'deposit',
          amount: deposit.amount,
          status: 'completed'
        }
      });

      return { deposit: updatedDeposit, user: updatedUser };
    });

    return result;
  });

  app.post('/deposits/:id/reject', async (request: any, reply) => {
    const { id } = request.params;
    
    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit) return reply.status(404).send({ error: 'Deposit not found' });
    if (deposit.status !== 'pending') return reply.status(400).send({ error: 'Deposit is not pending' });

    const updatedDeposit = await prisma.deposit.update({
      where: { id },
      data: { status: 'rejected' }
    });

    return updatedDeposit;
  });
};
