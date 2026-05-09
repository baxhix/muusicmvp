import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { tokens, users } from '../db/schema';
import { hashToken } from '../auth/tokens';
import { SESSION_COOKIE } from '../auth/session';
import type { AppSocket } from './types';

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|; )${escaped}=([^;]+)`).exec(header);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Socket.IO middleware: validates the muusic_session cookie on the handshake
 * and attaches user info to socket.data. Connections without a valid session
 * are rejected before any handler runs.
 */
export async function authenticateSocket(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const raw = parseCookie(socket.request.headers.cookie, SESSION_COOKIE);
  if (!raw) return next(new Error('unauthorized'));

  const hash = hashToken(raw);
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(tokens)
    .innerJoin(users, eq(users.id, tokens.userId))
    .where(
      and(
        eq(tokens.tokenHash, hash),
        eq(tokens.kind, 'session'),
        gt(tokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const u = rows[0];
  if (!u) return next(new Error('unauthorized'));

  socket.data.userId = u.id;
  socket.data.userName = u.name;
  next();
}
