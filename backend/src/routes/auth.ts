import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db.js';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { verifyAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-chess-key';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(400).send({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sessionId = uuidv4();
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: email === 'admin@admin.com' ? 'admin' : 'user',
        sessionId
      },
    });

    const token = jwt.sign({ id: user.id, role: user.role, sessionId }, JWT_SECRET, { expiresIn: '7d' });
    reply.setCookie('auth_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });

    return { user: { id: user.id, email: user.email, role: user.role, balance: user.balance } };
  });

  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const sessionId = uuidv4();
    user = await prisma.user.update({
      where: { id: user.id },
      data: { sessionId }
    });

    const token = jwt.sign({ id: user.id, role: user.role, sessionId }, JWT_SECRET, { expiresIn: '7d' });
    reply.setCookie('auth_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });

    return { user: { id: user.id, email: user.email, role: user.role, balance: user.balance } };
  });

  app.post('/logout', async (request, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    // also optionally invalidate sessionId in DB, but parsing token makes it complex here
    // clearing cookie is usually enough client-side
    return { success: true };
  });

  app.get('/me', { preHandler: verifyAuth }, async (request: any) => {
    const user = request.user;
    return { id: user.id, email: user.email, role: user.role, balance: user.balance, avatar: user.avatar };
  });

  app.put('/profile', { preHandler: verifyAuth }, async (request: any, reply) => {
    const { password } = request.body as any;
    if (!password) {
      return reply.status(400).send({ error: 'Password is required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Thay đổi pass thì log out mọi nơi bằng cách cấp sessionId mới
    const sessionId = uuidv4();
    await prisma.user.update({
      where: { id: request.user.id },
      data: { password: hashedPassword, sessionId }
    });
    reply.clearCookie('auth_token', { path: '/' });

    return { success: true, message: 'Profile updated' };
  });

  app.post('/avatar', { preHandler: verifyAuth }, async (request: any, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const filename = `${request.user.id}-${Date.now()}${path.extname(data.filename)}`;
    const uploadPath = path.join(__dirname, '../../../uploads', filename);

    if (!fs.existsSync(path.dirname(uploadPath))) {
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    }
    
    await pipeline(data.file, fs.createWriteStream(uploadPath));

    const avatarUrl = `/uploads/${filename}`;
    
    await prisma.user.update({
      where: { id: request.user.id },
      data: { avatar: avatarUrl }
    });

    return { avatar: avatarUrl };
  });
};
