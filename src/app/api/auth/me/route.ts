import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { ensureSuperchatMembership } from '@/server/chat/dm';
import { env } from '@/server/env';

export const runtime = 'nodejs';

/**
 * Relative `/uploads/...` paths 404 from cross-subdomain clients
 * (admin.muusic.live). Prepend the muusic origin so the admin's
 * sidebar avatar — and any future browser-side consumer — can load
 * uploaded avatars regardless of which subdomain it's hosted on.
 */
function absoluteAvatar(raw: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
  if (raw.startsWith('/')) return env.APP_URL ? `${env.APP_URL}${raw}` : raw;
  return raw;
}

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
      avatarUrl: absoluteAvatar(user.avatarUrl),
      role: user.role,
      // Flag pra que o frontend (verify page) decida entre
      // /app e /auth/onboarding/birth-date.
      isOnboarded: user.isOnboarded,
      // Estado de consentimento de localização + flag de menor —
      // dirigem o toggle nas Configurações, o guard do auto-sync e o
      // CTA do LocateButton.
      locationConsent: user.locationConsent,
      isMinor: user.isMinor,
    },
  });
}
