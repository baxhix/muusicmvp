/**
 * POST /api/admin/emails/campaigns/:id/send
 *
 * Dispara o envio da campanha (background — não bloqueia o
 * response). Marca status='sending' antes de responder, e o
 * dispatcher continua iterando depois que o handler retornou.
 *
 * Resposta 202 (Accepted) + payload com o status atual. O admin
 * faz polling em GET /campaigns pra ver o progresso (sentCount /
 * totalRecipients).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { dispatchCampaign, getCampaign } from '@/server/email/campaigns';
import { handleApiError, NotFoundError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

const idSchema = z.string().uuid();

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) throw new ValidationError('invalid_id');

    const campaign = await getCampaign(parsed.data);
    if (!campaign) throw new NotFoundError('campaign_not_found');
    if (campaign.status !== 'draft') {
      throw new ValidationError('campaign_already_dispatched');
    }

    // Fire-and-forget: dispatcher escreve no DB conforme progride.
    // Erros ficam no logger; client faz polling no GET de campaigns.
    void dispatchCampaign(parsed.data);

    return NextResponse.json(
      { ok: true, status: 'sending', id: parsed.data },
      { status: 202 },
    );
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.emails.campaigns.send',
      ctx: { actorId: auth.id },
    });
  }
}
