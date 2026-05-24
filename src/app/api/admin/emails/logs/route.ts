/**
 * GET /api/admin/emails/logs?limit=&offset=&kind=&status=&toContains=&sinceDays=
 *
 * Lista paginada com filtros pro histórico de envios. Total fica
 * no header `X-Total-Count` pra paginação client-side.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listEmailLogs } from '@/server/email/log';
import { handleApiError } from '@/server/api/errors';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  kind: z.string().min(1).max(80).optional(),
  status: z.enum(['sent', 'failed']).optional(),
  toContains: z.string().min(1).max(200).optional(),
  sinceDays: z.coerce.number().int().min(1).max(365).optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
      kind: url.searchParams.get('kind') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      toContains: url.searchParams.get('toContains') ?? undefined,
      sinceDays: url.searchParams.get('sinceDays') ?? undefined,
    });

    const { items, total } = await listEmailLogs(parsed);

    return NextResponse.json(
      {
        items: items.map((r) => ({
          id: r.id,
          to: r.to,
          kind: r.kind,
          subject: r.subject,
          status: r.status,
          errorMessage: r.errorMessage,
          campaignId: r.campaignId,
          sentAt: r.sentAt.toISOString(),
          durationMs: r.durationMs,
        })),
      },
      { headers: { 'X-Total-Count': String(total) } },
    );
  } catch (err) {
    return handleApiError(err, { scope: 'admin.emails.logs' });
  }
}
