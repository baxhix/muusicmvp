import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getDailyMissions } from '@/server/missions/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily missions for the logged-in user, computed from real platform
 * activity (listening_history, track_likes, user_activities).
 *
 * Returns { missions: DailyMission[] }. The client (ArtistBox)
 * stitches each id to its display metadata (icon, label, FP reward)
 * locally so the server doesn't need to ship presentation strings.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const missions = await getDailyMissions(user.id);
  return NextResponse.json({ missions });
}
