import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  ACTION_KINDS,
  TRIGGER_EVENTS,
  createAlgorithmRule,
  listAlgorithmRules,
  type ListAlgorithmRulesArgs,
} from '@/server/algorithm/rules';

export const runtime = 'nodejs';

/**
 * GET  /api/admin/algorithm-rules — list with filters + pagination
 * POST /api/admin/algorithm-rules — create a new rule
 *
 * Auth: admin only. The CMS at /admin/algoritmo consumes this.
 *
 * The trigger + action enums are validated twice: zod here (so the
 * 400 carries a useful message before the row hits Postgres) and
 * the CHECK constraint inside the migration (so a malicious or
 * misconfigured client can't sneak a bad value past us).
 */

const listSchema = z.object({
  search:       z.string().max(200).optional(),
  triggerEvent: z.enum([...TRIGGER_EVENTS, 'all'] as [string, ...string[]]).optional(),
  actionKind:   z.enum([...ACTION_KINDS, 'all'] as [string, ...string[]]).optional(),
  enabled:      z.enum(['true', 'false', 'all']).optional(),
  limit:        z.coerce.number().int().min(1).max(200).optional(),
  offset:       z.coerce.number().int().min(0).optional(),
});

const createSchema = z.object({
  name:             z.string().min(1).max(200),
  description:      z.string().min(1).max(2000),
  triggerEvent:     z.enum(TRIGGER_EVENTS),
  triggerConfig:    z.record(z.string(), z.unknown()).optional(),
  actionKind:       z.enum(ACTION_KINDS),
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

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = listSchema.safeParse({
    search:       url.searchParams.get('search')       ?? undefined,
    triggerEvent: url.searchParams.get('triggerEvent') ?? undefined,
    actionKind:   url.searchParams.get('actionKind')   ?? undefined,
    enabled:      url.searchParams.get('enabled')      ?? undefined,
    limit:        url.searchParams.get('limit')        ?? undefined,
    offset:       url.searchParams.get('offset')       ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const enabledArg =
    parsed.data.enabled === 'true' ? true :
    parsed.data.enabled === 'false' ? false :
    parsed.data.enabled === 'all' ? 'all' :
    undefined;

  const { items, total } = await listAlgorithmRules({
    search:       parsed.data.search,
    triggerEvent: parsed.data.triggerEvent as ListAlgorithmRulesArgs['triggerEvent'],
    actionKind:   parsed.data.actionKind as ListAlgorithmRulesArgs['actionKind'],
    enabled:      enabledArg,
    limit:        parsed.data.limit,
    offset:       parsed.data.offset,
  });

  return NextResponse.json({ items, total });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const rule = await createAlgorithmRule(admin.id, {
      name:             parsed.data.name,
      description:      parsed.data.description,
      triggerEvent:     parsed.data.triggerEvent,
      triggerConfig:    parsed.data.triggerConfig ?? {},
      actionKind:       parsed.data.actionKind,
      actionConfig:     parsed.data.actionConfig ?? {},
      serviceName:      parsed.data.serviceName ?? null,
      targetObject:     parsed.data.targetObject ?? null,
      tags:             parsed.data.tags ?? [],
      documentationUrl: parsed.data.documentationUrl ?? null,
      enabled:          parsed.data.enabled,
      priority:         parsed.data.priority,
      cooldownSeconds:  parsed.data.cooldownSeconds,
      maxPerSession:    parsed.data.maxPerSession,
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status = code.startsWith('invalid_') || code.endsWith('_required') || code.endsWith('_too_long') ? 400 : 500;
    if (status === 500) console.error('createAlgorithmRule failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
