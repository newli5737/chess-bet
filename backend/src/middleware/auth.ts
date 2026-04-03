import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { env } from '../config/env.js';

export const verifyAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.cookies.auth_token;
  if (!token) return reply.status(401).send({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; sessionId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.sessionId !== decoded.sessionId) {
      return reply.status(401).send({ error: 'Session invalid' });
    }
    (request as any).user = user;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
};

export const verifyAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  await verifyAuth(request, reply);
  if (reply.sent) return;
  if (!(request as any).user || (request as any).user.role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden. Admins only.' });
  }
};
