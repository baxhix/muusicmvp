/**
 * GET  → retorna brand settings atuais (singleton id=1).
 * POST → upsert das settings.
 *
 * Aplicado a TODOS os emails disparados pela plataforma: logo no
 * header (quando o template não tem logo próprio) + brand footer
 * (sempre, após o footer do template).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getBrandSettings, upsertBrandSettings } from '@/server/email/brand';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const settings = await getBrandSettings();
  return NextResponse.json({ settings: settings ?? {} });
}

const socialSchema = z.object({
  platform: z.enum([
    'instagram',
    'twitter',
    'youtube',
    'tiktok',
    'facebook',
    'linkedin',
    'website',
  ]),
  url: z.string().url().max(2000),
  label: z.string().max(80).optional(),
});

const linkSchema = z.object({
  label: z.string().min(1).max(80),
  url: z.string().url().max(2000),
});

const settingsSchema = z.object({
  logoUrl: z.string().url().max(2000).optional().or(z.literal('')),
  brandName: z.string().max(120).optional(),
  siteUrl: z.string().url().max(2000).optional().or(z.literal('')),
  addressLine: z.string().max(500).optional(),
  copyrightLine: z.string().max(200).optional(),
  links: z.array(linkSchema).max(10).optional(),
  socials: z.array(socialSchema).max(10).optional(),
  showRecipientNote: z.boolean().optional(),
  bgColor: z.string().max(40).optional(),
  textColor: z.string().max(40).optional(),
  linkColor: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = settingsSchema.safeParse(await req.json());
    if (!parsed.success) throw new ValidationError('invalid_body');

    /* Normaliza string vazias → undefined (zod aceita ambos
     * acima pra UX do form, mas no DB grava limpo). */
    const settings = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== '' && v !== undefined),
    );

    await upsertBrandSettings(settings, auth.id);

    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.emails.brand.upsert',
      ctx: { actorId: auth.id },
    });
  }
}
