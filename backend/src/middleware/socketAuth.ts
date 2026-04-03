import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { env } from '../config/env.js';

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return next(new Error('Authentication required'));

    const cookies = parseCookies(cookieHeader);
    const token = cookies['auth_token'];
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; sessionId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.sessionId !== decoded.sessionId) return next(new Error('Session expired'));

    socket.data.userId = user.id;
    socket.data.userEmail = user.email;
    socket.data.userRole = user.role;
    next();
  } catch {
    next(new Error('Invalid authentication'));
  }
};

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  header.split(';').forEach(c => {
    const [name, ...rest] = c.trim().split('=');
    if (name && rest.length) cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
  });
  return cookies;
}
