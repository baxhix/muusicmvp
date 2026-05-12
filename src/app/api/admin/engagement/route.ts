import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getEngagement } from '@/server/admin/queries';

export const runtime = 'nodejs';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

/**
 * Returns the engagement snapshot consumed by the admin Engajamento
 * page. One round trip carries the headline KPIs (messages,
 * reactions, chats started, superchat participants) plus a daily
 * message-volume series for the trend chart.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    days: url.searchParams.get('days') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const snapshot = await getEngagement(parsed.data.days ?? 30);
  return NextResponse.json(snapshot);
}
