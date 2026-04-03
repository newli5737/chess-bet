import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { verifyAuth } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function createAuthController(userRepo: IUserRepository): FastifyPluginAsync {
  return async (app) => {
    // --- Register ---
    app.post('/register', {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            password: { type: 'string', minLength: 6, maxLength: 128 },
          },
        },
      },
    }, async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      const existing = await userRepo.findByEmail(email);
      if (existing) return reply.status(400).send({ error: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const sessionId = uuidv4();
      const user = await userRepo.create({ email, password: hashedPassword, role: 'user', sessionId });

      const token = jwt.sign({ id: user.id, role: user.role, sessionId }, env.JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('auth_token', token, {
        path: '/', httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
      });
      return { user: { id: user.id, email: user.email, role: user.role, balance: user.balance } };
    });

    // --- Login ---
    app.post('/login', {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            password: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
    }, async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      const user = await userRepo.findByEmail(email);
      if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return reply.status(401).send({ error: 'Invalid credentials' });

      const sessionId = uuidv4();
      const updatedUser = await userRepo.updateSessionId(user.id, sessionId);

      const token = jwt.sign({ id: updatedUser.id, role: updatedUser.role, sessionId }, env.JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('auth_token', token, {
        path: '/', httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
      });
      return { user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role, balance: updatedUser.balance } };
    });

    // --- Logout ---
    app.post('/logout', async (request, reply) => {
      reply.clearCookie('auth_token', { path: '/' });
      return { success: true };
    });

    // --- Get Me ---
    app.get('/me', { preHandler: verifyAuth }, async (request: any) => {
      const u = request.user;
      return { id: u.id, email: u.email, role: u.role, balance: u.balance, avatar: u.avatar };
    });

    // --- Update Profile ---
    app.put('/profile', { preHandler: verifyAuth }, async (request: any, reply) => {
      const { password } = request.body as { password?: string };
      if (!password || password.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const sessionId = uuidv4();
      await userRepo.updatePassword(request.user.id, hashedPassword, sessionId);
      reply.clearCookie('auth_token', { path: '/' });
      return { success: true, message: 'Profile updated. Please login again.' };
    });

    // --- Upload Avatar ---
    app.post('/avatar', { preHandler: verifyAuth }, async (request: any, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });
      if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Only image files allowed' });
      }

      const ext = path.extname(data.filename).toLowerCase().replace(/[^.a-z0-9]/g, '');
      const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.png';
      const filename = `${request.user.id}-${Date.now()}${safeExt}`;
      const uploadPath = path.join(__dirname, '../../../../uploads', filename);

      if (!fs.existsSync(path.dirname(uploadPath))) {
        fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
      }
      await pipeline(data.file, fs.createWriteStream(uploadPath));

      const avatarUrl = `/uploads/${filename}`;
      await userRepo.updateAvatar(request.user.id, avatarUrl);
      return { avatar: avatarUrl };
    });
  };
}
