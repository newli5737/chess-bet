import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-chess-key';

export const verifyAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.cookies.auth_token;
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Đảm bảo cùng 1 lúc chỉ có 1 account (sessionId check)
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.sessionId !== decoded.sessionId) {
      return reply.status(401).send({ error: 'Session invalid or logged in from another device' });
    }
    
    (request as any).user = user;
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
};

export const verifyAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  await verifyAuth(request, reply);
  if ((request as any).user && (request as any).user.role !== 'admin') {
     return reply.status(403).send({ error: 'Forbidden. Admins only.' });
  }
};
