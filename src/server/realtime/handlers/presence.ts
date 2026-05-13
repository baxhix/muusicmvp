import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import type { AppServer, AppSocket } from '../types';

const HEARTBEAT_MS = 30_000;

/** Coalescing window for presence broadcasts. Within this window
 *  multiple online/offline transitions for the same user collapse
 *  to a single final state, and ALL changes across all users get
 *  packed into one `presence:batch` emit at the end of the window.
 *
 *  Why this exists: a connection storm of 1k users joining over 30s
 *  used to fire 1k separate `io.emit('presence:online', ...)` calls,
 *  each writing to every connected socket — ~1M socket writes for
 *  one boot wave. Batched, that's ~120 writes (one per window) with
 *  the same UX outcome. */
const PRESENCE_FLUSH_MS = 250;

/**
 * In-memory online user tracker.
 * Keyed by userId, value is the active connection count for that user
 * (a user can have multiple tabs open). User is "online" when count > 0.
 */
const onlineCount = new Map<string, number>();

export function isOnline(userId: string): boolean {
  return (onlineCount.get(userId) ?? 0) > 0;
}

// ── Presence batch coalescer ──────────────────────────────────────
// Pending changes keyed by userId so flap-within-window resolves to
// the LAST observed state for that user (no thrash on the wire).
const pendingChanges = new Map<string, boolean>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let ioRef: AppServer | null = null;

function schedulePresenceFlush(): void {
  if (flushTimer || !ioRef) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.entries()).map(
      ([userId, online]) => ({ userId, online }),
    );
    pendingChanges.clear();
    ioRef?.emit('presence:batch', { changes });
  }, PRESENCE_FLUSH_MS);
}

function queuePresenceChange(userId: string, online: boolean): void {
  pendingChanges.set(userId, online);
  schedulePresenceFlush();
}

async function touchLastSeen(userId: string): Promise<void> {
  try {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  } catch (err) {
    console.error('touchLastSeen failed:', err);
  }
}

export function registerPresenceHandlers(io: AppServer, socket: AppSocket): void {
  // Capture the io reference once so the standalone flush timer can
  // reach it without us threading it through every call site.
  ioRef = io;
  const userId = socket.data.userId;

  // Track this connection.
  const next = (onlineCount.get(userId) ?? 0) + 1;
  onlineCount.set(userId, next);
  if (next === 1) {
    queuePresenceChange(userId, true);
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
      queuePresenceChange(userId, false);
      void touchLastSeen(userId);
    } else {
      onlineCount.set(userId, remaining);
    }
  });
}
