import fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({ logger: true });

app.register(cors, {
  origin: '*',
});

import { authRoutes } from './routes/auth.js';
import { walletRoutes } from './routes/wallet.js';

app.get('/', async (request, reply) => {
  return { status: 'ok', service: 'chess-bet-api' };
});

app.register(multipart);
app.register(fastifyStatic, {
  root: path.join(__dirname, '../../uploads'), // Relative to dist/src or src (in tsx watch)
  prefix: '/uploads/',
});

app.register(authRoutes, { prefix: '/api/auth' });
app.register(walletRoutes, { prefix: '/api/wallet' });

import { adminRoutes } from './routes/admin.js';
app.register(adminRoutes, { prefix: '/api/admin' });

import setupSocketHandlers from './sockets.js';

const start = async () => {
  try {
    const io = new Server(app.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    setupSocketHandlers(io);

    await app.listen({ port: 4000, host: '0.0.0.0' });
    console.log('Server is running at http://localhost:4000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
