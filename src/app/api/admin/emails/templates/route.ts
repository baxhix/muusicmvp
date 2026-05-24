/**
 * GET  → lista templates persistidos no DB + os "known" do código
 *        (com flag indicando se já tem versão editada).
 * POST → upsert de um template (kind + subject + html + isActive).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listTemplates, upsertTemplate, KNOWN_TEMPLATES } from '@/server/email/templates';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const persisted = await listTemplates();
  const persistedByKind = new Map(persisted.map((t) => [t.kind, t]));

  // Combina o catálogo "known" com o que foi editado no DB.
  // Templates desconhecidos (legado) também aparecem — admin pode
  // inspecionar, mas sem catálogo de variáveis.
  const items = KNOWN_TEMPLATES.map((known) => {
    const db = persistedByKind.get(known.kind);
    return {
      kind: known.kind,
      label: known.label,
      description: known.description,
      variables: known.variables,
      defaultSubject: known.defaultSubject,
      defaultHtml: known.defaultHtml,
      // Estado atual: editado no DB ou usando fallback?
      isEdited: Boolean(db),
      isActive: db?.isActive ?? false,
      subject: db?.subject ?? known.defaultSubject,
      html: db?.html ?? known.defaultHtml,
      updatedAt: db?.updatedAt?.toISOString() ?? null,
    };
  });

  // Templates persistidos sem "known" correspondente (legado).
  const orphans = persisted
    .filter((p) => !KNOWN_TEMPLATES.some((k) => k.kind === p.kind))
    .map((p) => ({
      kind: p.kind,
      label: p.kind,
      description: p.description ?? '(sem descrição)',
      variables: [],
      defaultSubject: p.subject,
      defaultHtml: p.html,
      isEdited: true,
      isActive: p.isActive,
      subject: p.subject,
      html: p.html,
      updatedAt: p.updatedAt.toISOString(),
    }));

  return NextResponse.json({ items: [...items, ...orphans] });
}

const upsertSchema = z.object({
  kind: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(50_000),
  isActive: z.boolean(),
  description: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = upsertSchema.safeParse(await req.json());
    if (!body.success) throw new ValidationError('invalid_body');

    const saved = await upsertTemplate({
      ...body.data,
      updatedBy: auth.id,
    });

    return NextResponse.json({ ok: true, template: saved });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.emails.templates.upsert',
      ctx: { actorId: auth.id },
    });
  }
}
