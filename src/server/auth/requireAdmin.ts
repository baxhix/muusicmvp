import { NextResponse } from 'next/server';
import { getCurrentUser } from './session';
import type { User } from '../db/schema';

/**
 * Use in /api/admin/* route handlers: returns the user if they have role
 * 'admin', else 401 (no session) or 403 (logged in but not admin).
 */
export async function requireAdmin(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return user;
}
