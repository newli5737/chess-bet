import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { verifyAuth } from '../middleware/auth.js';

export const walletRoutes: FastifyPluginAsync = async (app) => {
  // Add onRequest hook to protect all routes in this plugin
  app.addHook('onRequest', verifyAuth);

  // 1. Get Wallet Balance and Transactions
  app.get('/', async (request: any, reply) => {
    const userId = request.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, walletTransactions: { orderBy: { createdAt: 'desc' } } }
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  // 2. See Admin's Bank Accounts for Deposit
  app.get('/bank-accounts', async (request, reply) => {
    const accounts = await prisma.bankAccount.findMany({
      where: { status: 'active' }
    });
    return accounts;
  });

  // 3. Initiate a Deposit
  app.post('/deposit', async (request: any, reply) => {
    const userId = request.user.id;
    const { amount, bankAccountId, transferNote } = request.body as any;

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Valid amount is required' });
    }

    const deposit = await prisma.deposit.create({
      data: {
        userId,
        amount,
        bankAccountId,
        transferNote: transferNote || '',
        status: 'pending'
      }
    });

    return deposit;
  });
};
