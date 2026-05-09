import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../env';
import { authenticateSocket } from './auth';
import { registerChatHandlers } from './handlers/chat';
import { registerListeningHandlers } from './handlers/listening';
import { registerPresenceHandlers } from './handlers/presence';
import type { AppServer } from './types';

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
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT} (origin=${env.APP_URL})`);
});

// Graceful shutdown — close active sockets so processes don't hang on SIGTERM.
const shutdown = (signal: string) => {
  console.log(`[realtime] received ${signal}, shutting down`);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  // Force-exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
