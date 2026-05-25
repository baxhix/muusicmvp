/**
 * GET  → lista templates persistidos no DB + os "known" do código
 *        (com flag indicando se já tem versão editada).
 * POST → upsert de um template (kind + subject + html + isActive).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listTemplates, upsertTemplate, KNOWN_TEMPLATES } from '@/server/email/templates';
import { designToHtml, type EmailDesign } from '@/server/email/design';
import { getBrandSettings } from '@/server/email/brand';
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
      // Label do DB tem prioridade (admin renomeou pelo editor);
      // fallback pro KNOWN_TEMPLATES.label hardcoded.
      label: db?.label ?? known.label,
      description: known.description,
      variables: known.variables,
      defaultSubject: known.defaultSubject,
      defaultHtml: known.defaultHtml,
      defaultDesign: known.defaultDesign,
      // Estado atual: editado no DB ou usando fallback?
      isEdited: Boolean(db),
      isActive: db?.isActive ?? false,
      subject: db?.subject ?? known.defaultSubject,
      html: db?.html ?? known.defaultHtml,
      design: db?.design ?? null,
      updatedAt: db?.updatedAt?.toISOString() ?? null,
    };
  });

  // Templates persistidos sem "known" correspondente (legado).
  const orphans = persisted
    .filter((p) => !KNOWN_TEMPLATES.some((k) => k.kind === p.kind))
    .map((p) => ({
      kind: p.kind,
      // Custom: label do DB se existir, senão usa o próprio kind.
      label: p.label ?? p.kind,
      description: p.description ?? '(sem descrição)',
      variables: [],
      defaultSubject: p.subject,
      defaultHtml: p.html,
      defaultDesign: null,
      isEdited: true,
      isActive: p.isActive,
      subject: p.subject,
      html: p.html,
      design: p.design ?? null,
      updatedAt: p.updatedAt.toISOString(),
    }));

  return NextResponse.json({ items: [...items, ...orphans] });
}

/* Design schema — espelha src/server/email/design.ts. Aceito como
 * jsonb cru; validação leve (tipos básicos). Generator regenera
 * o HTML a partir desta estrutura — caller pode mandar `html`
 * vazio que o server preenche. */
const blockSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('heading'),
    text: z.string().max(500),
    level: z.union([z.literal(2), z.literal(3)]).optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('paragraph'),
    text: z.string().max(5000),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('button'),
    text: z.string().max(120),
    href: z.string().max(2000),
    align: z.enum(['center', 'left']).optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('image'),
    src: z.string().max(2000),
    alt: z.string().max(500),
    width: z.number().int().min(50).max(1000).optional(),
  }),
  z.object({ id: z.string(), kind: z.literal('divider') }),
  z.object({
    id: z.string(),
    kind: z.literal('spacer'),
    height: z.number().int().min(4).max(200).optional(),
  }),
]);

const designSchema = z.object({
  version: z.literal(1),
  theme: z.object({
    bgColor: z.string().max(40),
    contentBg: z.string().max(40),
    textColor: z.string().max(40),
    mutedColor: z.string().max(40),
    linkColor: z.string().max(40),
    buttonBg: z.string().max(40),
    buttonText: z.string().max(40),
    buttonRadius: z.number().int().min(0).max(999),
    fontFamily: z.string().max(200),
  }),
  header: z.object({
    enabled: z.boolean(),
    title: z.string().max(200),
    subtitle: z.string().max(500).optional(),
  }),
  blocks: z.array(blockSchema).max(50),
  footer: z.object({
    enabled: z.boolean(),
    text: z.string().max(1000),
  }),
});

const upsertSchema = z.object({
  kind: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  /** Nome amigável editável pelo admin. Quando ausente/vazio,
   *  GET usa fallback do KNOWN_TEMPLATES.label. */
  label: z.string().min(1).max(120).optional(),
  subject: z.string().min(1).max(200),
  /** Quando `design` vem setado, o html é REGENERADO pelo
   *  generator (server-side), ignorando o html submetido — evita
   *  divergência entre design e html persistidos. Quando design
   *  vem null, o html submetido é gravado direto (modo HTML cru). */
  html: z.string().max(50_000),
  design: designSchema.nullable().optional(),
  isActive: z.boolean(),
  description: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = upsertSchema.safeParse(await req.json());
    if (!body.success) throw new ValidationError('invalid_body');

    const data = body.data;
    const design = (data.design ?? null) as EmailDesign | null;

    // Se design veio, regenera HTML deterministicamente —
    // ignora qualquer html que o client tenha mandado. Inclui
    // brand settings pro logo no header + brand footer.
    const brand = design ? await getBrandSettings() : null;
    const html = design ? designToHtml(design, brand) : data.html;
    if (!html) throw new ValidationError('html_empty');

    const saved = await upsertTemplate({
      kind: data.kind,
      label: data.label,
      subject: data.subject,
      html,
      design,
      isActive: data.isActive,
      description: data.description,
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
