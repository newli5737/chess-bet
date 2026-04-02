import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-chess-key';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Register new user
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
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        // First user gets admin, ideally this should be manual but we simulate for easy setup
        role: email === 'admin@admin.com' ? 'admin' : 'user',
      },
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return { token, user: { id: user.id, email: user.email, role: user.role, balance: user.balance } };
  });

  // Login
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return { token, user: { id: user.id, email: user.email, role: user.role, balance: user.balance } };
  });

  // Get current user details
  app.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET as string) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return reply.status(404).send({ error: 'User not found' });
      
      return { id: user.id, email: user.email, role: user.role, balance: user.balance, avatar: user.avatar };
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // Update profile (password)
  app.put('/profile', async (request: any, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as any;
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const { password } = request.body as any;
    if (!password) {
      return reply.status(400).send({ error: 'Password is required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data: { password: hashedPassword }
    });

    return { success: true, message: 'Profile updated' };
  });

  // Upload Avatar
  app.post('/avatar', async (request: any, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(401).send({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string) as any;
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const filename = `${decoded.id}-${Date.now()}${path.extname(data.filename)}`;
    // The uploads dir should ideally be created if it doesn't exist
    const uploadPath = path.join(__dirname, '../../../uploads', filename);
    
    await pipeline(data.file, fs.createWriteStream(uploadPath));

    const avatarUrl = `/uploads/${filename}`;
    
    await prisma.user.update({
      where: { id: decoded.id },
      data: { avatar: avatarUrl }
    });

    return { avatar: avatarUrl };
  });
};
