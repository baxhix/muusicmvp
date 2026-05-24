/**
 * POST /api/admin/emails/templates/test
 *
 * Dispara um envio de TESTE do template informado pra o email do
 * admin logado. Útil pra previsualizar o resultado final no
 * inbox sem precisar acionar o fluxo real (magic link, etc).
 *
 * Body: { kind, subject, html } — o admin pode mandar uma versão
 * customizada (preview no editor) sem precisar salvar antes.
 *
 * Variáveis fictícias: { magicUrl: '#test', code: '123456' } pra
 * ver como fica o render. Cada template documenta suas vars em
 * KNOWN_TEMPLATES.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { sendEmail } from '@/server/email/resend';
import { interpolate } from '@/server/email/templates';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  kind: z.string().min(1).max(80),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(50_000),
});

const FAKE_VARS: Record<string, string> = {
  magicUrl: 'https://example.com/auth/verify?token=preview',
  code: '123456',
  email: 'admin@example.com',
};

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) throw new ValidationError('invalid_body');

    if (!auth.email) {
      throw new ValidationError('admin_has_no_email');
    }

    await sendEmail({
      to: auth.email,
      subject: `[TESTE] ${interpolate(body.data.subject, FAKE_VARS)}`,
      html: interpolate(body.data.html, FAKE_VARS),
      kind: 'manual_test',
    });

    return NextResponse.json({ ok: true, sentTo: auth.email });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.emails.templates.test',
      ctx: { actorId: auth.id },
    });
  }
}
