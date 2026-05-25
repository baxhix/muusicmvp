/**
 * GET  → catálogo + estado persistido por-kind
 * POST → upsert de um kind
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  listNotifications,
  upsertNotification,
} from '@/server/notifications/settings';
import { KNOWN_NOTIFICATIONS } from '@/server/notifications/catalog';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const settings = await listNotifications();
  const settingsByKind = new Map(settings.map((s) => [s.kind, s]));

  /* Resposta = catálogo + estado (defaults aplicados quando
   * não há registro). Frontend não precisa de lógica de fallback. */
  const items = KNOWN_NOTIFICATIONS.map((k) => {
    const s = settingsByKind.get(k.kind);
    return {
      kind: k.kind,
      label: k.label,
      description: k.description,
      trigger: k.trigger,
      category: k.category,
      supportedChannels: k.supportedChannels,
      defaultChannels: k.defaultChannels,
      wired: k.wired,
      system: k.system ?? false,
      enabled: s?.enabled ?? true,
      channels: s?.channels ?? {},
      updatedAt: s?.updatedAt ?? null,
    };
  });

  return NextResponse.json({ items });
}

const upsertSchema = z.object({
  kind: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
  channels: z.record(z.string(), z.boolean()),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) throw new ValidationError('invalid_body');

    await upsertNotification({
      kind: parsed.data.kind,
      enabled: parsed.data.enabled,
      channels: parsed.data.channels as Partial<Record<'in_app' | 'email', boolean>>,
      updatedBy: auth.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.notifications.upsert',
      ctx: { actorId: auth.id },
    });
  }
}
