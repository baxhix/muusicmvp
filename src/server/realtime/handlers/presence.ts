import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import type { AppServer, AppSocket } from '../types';

const HEARTBEAT_MS = 30_000;

/**
 * In-memory online user tracker.
 * Keyed by userId, value is the active connection count for that user
 * (a user can have multiple tabs open). User is "online" when count > 0.
 */
const onlineCount = new Map<string, number>();

export function isOnline(userId: string): boolean {
  return (onlineCount.get(userId) ?? 0) > 0;
}

async function touchLastSeen(userId: string): Promise<void> {
  try {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  } catch (err) {
    console.error('touchLastSeen failed:', err);
  }
}

export function registerPresenceHandlers(io: AppServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  // Track this connection.
  const next = (onlineCount.get(userId) ?? 0) + 1;
  onlineCount.set(userId, next);
  if (next === 1) {
    io.emit('presence:online', { userId });
    void touchLastSeen(userId);
  }

  // Periodic heartbeat to keep last_seen_at fresh while idle but connected.
  const heartbeat = setInterval(() => {
    void touchLastSeen(userId);
  }, HEARTBEAT_MS);

  socket.on('disconnect', () => {
    clearInterval(heartbeat);
    const remaining = (onlineCount.get(userId) ?? 1) - 1;
    if (remaining <= 0) {
      onlineCount.delete(userId);
      io.emit('presence:offline', { userId });
      void touchLastSeen(userId);
    } else {
      onlineCount.set(userId, remaining);
    }
  });
}
