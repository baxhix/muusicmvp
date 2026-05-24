/**
 * GET  → lista campanhas (até 100, ordem decrescente por created_at)
 * POST → cria draft (calcula total_recipients via queryRecipients)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  createCampaign,
  listCampaigns,
  queryRecipients,
} from '@/server/email/campaigns';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const items = await listCampaigns();
  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      segment: c.segment,
      segmentParams: c.segmentParams,
      status: c.status,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      totalRecipients: c.totalRecipients,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      completedAt: c.completedAt?.toISOString() ?? null,
    })),
  });
}

const segmentParamsSchema = z
  .object({
    topPct: z.number().int().min(1).max(100).optional(),
    days: z.number().int().min(1).max(365).optional(),
    city: z.string().min(1).max(120).optional(),
    emails: z.array(z.string().email()).max(10_000).optional(),
  })
  .optional();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(50_000),
  segment: z.enum(['all', 'superfans', 'inactive', 'city', 'custom_emails']),
  segmentParams: segmentParamsSchema,
  scheduledAt: z.string().datetime().optional(),
  /** Quando true, só retorna a contagem (preview). Não cria nada. */
  preview: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ValidationError('invalid_body');
    const body = parsed.data;

    if (body.preview) {
      // Dry-run pro composer mostrar "vai enviar pra X pessoas".
      const recipients = await queryRecipients(
        body.segment,
        body.segmentParams ?? {},
      );
      return NextResponse.json({ count: recipients.length });
    }

    const campaign = await createCampaign({
      name: body.name,
      subject: body.subject,
      html: body.html,
      segment: body.segment,
      segmentParams: body.segmentParams,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      createdBy: auth.id,
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.emails.campaigns.create',
      ctx: { actorId: auth.id },
    });
  }
}
