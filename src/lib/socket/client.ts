import { io, Socket } from 'socket.io-client';

let singleton: Socket | null = null;

/**
 * Connect to the muusic Socket.IO server. Idempotent — returns the same
 * connection across the whole app. Path defaults to NEXT_PUBLIC_SOCKET_URL
 * which behind nginx is the same origin as the Next app.
 *
 * Authentication is via the muusic_session cookie automatically attached
 * to the websocket handshake by the browser. The server rejects connections
 * without a valid session.
 */
export function getSocket(): Socket {
  if (singleton) return singleton;

  const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? '';

  singleton = io(url || undefined, {
    withCredentials: true,
    autoConnect: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return singleton;
}

export function disconnectSocket(): void {
  if (singleton) {
    singleton.disconnect();
    singleton = null;
  }
}
