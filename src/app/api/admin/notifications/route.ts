/**
 * GET  → catálogo + estado persistido + valores efetivos (override ?? default)
 * POST → upsert de um kind (campos opcionais; null = clear)
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

  const items = KNOWN_NOTIFICATIONS.map((k) => {
    const s = settingsByKind.get(k.kind);
    /* Effective = override OU catálogo. Frontend usa pra mostrar
     * o valor atual; defaults vêm separados pra "restaurar". */
    return {
      kind: k.kind,
      // Defaults vindos do código (read-only no UI, exceto label/desc/trigger)
      defaultLabel: k.label,
      defaultDescription: k.description,
      defaultTrigger: k.trigger,
      // Estado atual (effective)
      label: s?.labelOverride ?? k.label,
      description: s?.descriptionOverride ?? k.description,
      trigger: s?.triggerOverride ?? k.trigger,
      // Indica se foi editado pelo admin
      hasLabelOverride: !!s?.labelOverride,
      hasDescriptionOverride: !!s?.descriptionOverride,
      hasTriggerOverride: !!s?.triggerOverride,
      // Atributos estruturais (código only)
      category: k.category,
      supportedChannels: k.supportedChannels,
      defaultChannels: k.defaultChannels,
      wired: k.wired,
      system: k.system ?? false,
      // Toggles persistidos
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
  /* `undefined` na rede vira `undefined` no service (não toca);
   * `null` significa restaurar default; string preenche override. */
  labelOverride: z.string().max(200).nullable().optional(),
  descriptionOverride: z.string().max(2000).nullable().optional(),
  triggerOverride: z.string().max(2000).nullable().optional(),
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
      labelOverride: parsed.data.labelOverride,
      descriptionOverride: parsed.data.descriptionOverride,
      triggerOverride: parsed.data.triggerOverride,
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
