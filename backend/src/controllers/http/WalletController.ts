import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db.js';
import { verifyAuth } from '../../middleware/auth.js';

export function createWalletController(): FastifyPluginAsync {
  return async (app) => {
    app.addHook('onRequest', verifyAuth);

    app.get('/', async (request: any, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { balance: true, walletTransactions: { orderBy: { createdAt: 'desc' } } },
      });
      if (!user) return reply.status(404).send({ error: 'User not found' });
      return user;
    });

    app.get('/bank-accounts', async () => {
      return prisma.bankAccount.findMany({ where: { status: 'active' } });
    });

    app.post('/deposit', {
      schema: {
        body: {
          type: 'object',
          required: ['amount', 'bankAccountId'],
          properties: {
            amount: { type: 'integer', minimum: 10000 },
            bankAccountId: { type: 'string', minLength: 1 },
            transferNote: { type: 'string', maxLength: 500 },
          },
        },
      },
    }, async (request: any) => {
      const { amount, bankAccountId, transferNote } = request.body as {
        amount: number; bankAccountId: string; transferNote?: string;
      };
      return prisma.deposit.create({
        data: { userId: request.user.id, amount, bankAccountId, transferNote: transferNote || '', status: 'pending' },
      });
    });

    // ─── Rút tiền ──────────────────────────────────────────
    app.post('/withdraw', {
      schema: {
        body: {
          type: 'object',
          required: ['amount', 'bankName', 'accountNumber', 'accountHolder'],
          properties: {
            amount:        { type: 'integer', minimum: 50000 },
            bankName:      { type: 'string', minLength: 1 },
            accountNumber: { type: 'string', minLength: 1 },
            accountHolder: { type: 'string', minLength: 1 },
            note:          { type: 'string', maxLength: 500 },
          },
        },
      },
    }, async (request: any, reply) => {
      const { amount, bankName, accountNumber, accountHolder, note } = request.body as {
        amount: number; bankName: string; accountNumber: string; accountHolder: string; note?: string;
      };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock row để tránh race condition
          const rows = await tx.$queryRaw<{ id: string; balance: number }[]>`
            SELECT id, balance FROM "User" WHERE id = ${request.user.id} FOR UPDATE
          `;
          const user = rows[0];
          if (!user || user.balance < amount) {
            throw new Error('Số dư không đủ');
          }

          await tx.user.update({
            where: { id: request.user.id },
            data: { balance: { decrement: amount } },
          });

          const withdrawal = await tx.withdrawal.create({
            data: { userId: request.user.id, amount, bankName, accountNumber, accountHolder, note: note || '', status: 'pending' },
          });

          await tx.walletTransaction.create({
            data: { userId: request.user.id, type: 'withdraw', amount, status: 'pending' },
          });

          return withdrawal;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || 'Lỗi khi tạo yêu cầu rút tiền' });
      }
    });
  };
}

