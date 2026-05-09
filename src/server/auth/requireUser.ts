import { NextResponse } from 'next/server';
import { getCurrentUser } from './session';
import type { User } from '../db/schema';

/**
 * Use in route handlers: returns the user or a 401 NextResponse.
 * Pattern at the top of every authed route:
 *
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth;
 */
export async function requireUser(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return user;
}
