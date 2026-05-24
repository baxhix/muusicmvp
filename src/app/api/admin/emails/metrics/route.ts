/**
 * GET /api/admin/emails/metrics?days=30
 *
 * KPIs agregados dos últimos N dias: total, sent, failed,
 * failureRate, avgDurationMs + breakdown por kind + buckets
 * diários pro gráfico.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getEmailMetrics } from '@/server/email/log';
import { handleApiError } from '@/server/api/errors';

export const runtime = 'nodejs';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      days: url.searchParams.get('days') ?? '30',
    });

    const metrics = await getEmailMetrics(parsed.days);
    return NextResponse.json(metrics);
  } catch (err) {
    return handleApiError(err, { scope: 'admin.emails.metrics' });
  }
}
