import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { ensureSuperchatMembership } from '@/server/chat/dm';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  // Idempotent — ensures users created before the Superchat seed (or that
  // somehow missed the join) are members. Cheap upsert.
  await ensureSuperchatMembership(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      city: user.city,
      country: user.country,
      countryCode: user.countryCode,
      lat: user.lat,
      lng: user.lng,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  });
}
