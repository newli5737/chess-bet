import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({ logger: true });

// ─── Plugins ───────────────────────────────────────────

app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
app.register(cors, {
  origin: env.CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
});
app.register(cookie, { secret: env.COOKIE_SECRET });
app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
app.register(fastifyStatic, {
  root: path.join(__dirname, '../../uploads'),
  prefix: '/uploads/',
});

// ─── Composition Root ──────────────────────────────────

import { userRepo, roomService, gameService } from './container.js';

// ─── HTTP Controllers ──────────────────────────────────

import { createAuthController } from './controllers/http/AuthController.js';
import { createWalletController } from './controllers/http/WalletController.js';
import { createAdminController } from './controllers/http/AdminController.js';

app.get('/', async () => ({ status: 'ok', service: 'chess-bet-api' }));
app.register(createAuthController(userRepo), { prefix: '/api/v1/auth' });
app.register(createWalletController(), { prefix: '/api/v1/wallet' });
app.register(createAdminController(), { prefix: '/api/v1/admin' });

// ─── Socket.io ─────────────────────────────────────────

import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { setupSocketHandlers } from './controllers/socket/index.js';

const start = async () => {
  try {
    const io = new Server(app.server, {
      path: '/game',
      cors: {
        origin: env.CORS_ORIGIN.split(',').map(s => s.trim()),
        credentials: true,
        methods: ['GET', 'POST'],
      },
    });

    io.use(socketAuthMiddleware);
    setupSocketHandlers(io, roomService, gameService);

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
