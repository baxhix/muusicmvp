import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { listAllTracks } from '@/server/tracks/queries';

export const runtime = 'nodejs';

/**
 * Public (authenticated) catalog feed. The in-app player reads from
 * here on mount and replaces its static seed with whatever the DB
 * holds — so anything an admin adds via /api/admin/tracks shows up
 * inside the platform within seconds.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const tracks = await listAllTracks();
  return NextResponse.json({ tracks });
}
