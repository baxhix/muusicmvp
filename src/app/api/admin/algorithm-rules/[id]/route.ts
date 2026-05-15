import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  ACTION_KINDS,
  TRIGGER_EVENTS,
  deleteAlgorithmRule,
  getAlgorithmRule,
  updateAlgorithmRule,
} from '@/server/algorithm/rules';

export const runtime = 'nodejs';

/**
 * GET    /api/admin/algorithm-rules/:id — fetch single rule
 * PATCH  /api/admin/algorithm-rules/:id — partial update
 * DELETE /api/admin/algorithm-rules/:id — drop rule
 */

const patchSchema = z.object({
  name:             z.string().min(1).max(200).optional(),
  description:      z.string().min(1).max(2000).optional(),
  triggerEvent:     z.enum(TRIGGER_EVENTS).optional(),
  triggerConfig:    z.record(z.string(), z.unknown()).optional(),
  actionKind:       z.enum(ACTION_KINDS).optional(),
  actionConfig:     z.record(z.string(), z.unknown()).optional(),
  serviceName:      z.string().max(80).nullish(),
  targetObject:     z.string().max(80).nullish(),
  tags:             z.array(z.string().min(1).max(40)).max(20).optional(),
  documentationUrl: z.string().max(500).nullish(),
  enabled:          z.boolean().optional(),
  priority:         z.number().int().min(0).max(1000).optional(),
  cooldownSeconds:  z.number().int().min(0).max(86400).optional(),
  maxPerSession:    z.number().int().min(0).max(100).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const rule = await getAlgorithmRule(id);
  if (!rule) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const rule = await updateAlgorithmRule(id, parsed.data);
    return NextResponse.json(rule);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'update_failed';
    const status =
      code === 'rule_not_found' ? 404 :
      code.startsWith('invalid_') || code.endsWith('_too_long') ? 400 :
      500;
    if (status === 500) console.error('updateAlgorithmRule failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const ok = await deleteAlgorithmRule(id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
