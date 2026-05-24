import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../env';
import { authenticateSocket } from './auth';
import { registerChatHandlers } from './handlers/chat';
import { registerListeningHandlers } from './handlers/listening';
import { registerPresenceHandlers } from './handlers/presence';
import { registerWaveHandlers } from './handlers/waves';
import type { AppServer } from './types';
import { logger } from '@/server/log';

const PORT = parseInt(process.env.SOCKET_PORT ?? '3002', 10);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const io: AppServer = new Server(httpServer, {
  cors: {
    origin: env.APP_URL,
    credentials: true,
  },
  // Behind nginx, the path stays the default `/socket.io/`.
});

io.use(authenticateSocket);

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  // Personal room for direct push (notify:new, etc.)
  socket.join(`user:${userId}`);

  registerChatHandlers(io, socket);
  registerListeningHandlers(io, socket);
  registerPresenceHandlers(io, socket);
  registerWaveHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  logger.info('realtime.server.realtime-listening-on-port-originenvapp_')
});

// Top-level safety net — log instead of crash. A single bad query inside
// a socket handler shouldn't take down the entire realtime process and
// drop every connected client.
process.on('unhandledRejection', (reason) => {
  logger.error('realtime.server.realtime-unhandledrejection', reason)
});
process.on('uncaughtException', (err) => {
  logger.error('realtime.server.realtime-uncaughtexception', err)
});

// Graceful shutdown — close active sockets so processes don't hang on SIGTERM.
const shutdown = (signal: string) => {
  logger.info('realtime.server.realtime-received-signal-shutting-down')
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  // Force-exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
