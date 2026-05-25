/**
 * POST /api/admin/cron/trigger
 *
 * Dispara manualmente um cron job a partir do admin — usado pelo
 * botão "Enviar teste agora" nas páginas de notificação. Gated por
 * sessão admin (cookie), NÃO por CRON_SECRET — esse endpoint
 * complementa `/api/cron/*` (que é pro scheduler externo).
 *
 * Body: { kind: string }   onde `kind` é uma chave do CRON_REGISTRY.
 * Resp: { ok: true, kind, result }   `result` é o stats que o
 *        handler do cron normalmente retorna (e.g. `to`, `dateLabel`,
 *        `totalUsers` pro manager_daily_report).
 *
 * Por que não reutilizar `/api/cron/*`?
 *   - Aqueles são gated por CRON_SECRET (Bearer), que pode não estar
 *     configurado em prod (caso atual). Aqui usamos a mesma sessão
 *     admin que abriu o /admin — UX direta.
 *   - Mantém um único ponto de auditoria de execuções manuais (log
 *     marca quem disparou).
 *
 * Cuidado: cron real é DESTRUTIVO (manda email, atualiza tabelas
 * tipo community_notification_log). Não há "dry run" — disparar
 * aqui = mesmo efeito que o cron rodando às 06h00. Botão no UI
 * deixa isso claro.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { CRON_REGISTRY, isCronKind } from '@/server/cron/registry';
import { logger } from '@/server/log';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* Crons podem demorar (queries pesadas + envio de email via Resend).
 * Default do Vercel é 10s; subimos pra 60s pra acomodar. Hostinger
 * ignora esta export, sem efeito colateral. */
export const maxDuration = 60;

const triggerSchema = z.object({
  kind: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let kind = '';
  try {
    const parsed = triggerSchema.safeParse(await req.json());
    if (!parsed.success) throw new ValidationError('invalid_body');
    kind = parsed.data.kind;
    if (!isCronKind(kind)) {
      throw new ValidationError('unknown_kind');
    }

    logger.info('admin.cron.trigger.start', {
      kind,
      actor_id: auth.id,
    });

    const handler = CRON_REGISTRY[kind];
    const startedAt = Date.now();
    const result = await handler();
    const durationMs = Date.now() - startedAt;

    logger.info('admin.cron.trigger.done', {
      kind,
      actor_id: auth.id,
      duration_ms: durationMs,
    });

    return NextResponse.json({ ok: true, kind, durationMs, result });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.cron.trigger',
      ctx: { actorId: auth.id, kind },
    });
  }
}
