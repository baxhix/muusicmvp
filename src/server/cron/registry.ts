/**
 * Registry central dos cron jobs disparáveis remotamente.
 *
 * Cada entrada mapeia um `kind` (mesmo identificador da
 * notification no catálogo) → handler async que faz o trabalho.
 *
 * Usado por dois caminhos:
 *
 *   1. `/api/cron/<slug>` (HTTP gated por CRON_SECRET) — pra
 *      scheduler externo (Hostinger cron, GitHub Actions).
 *   2. `/api/admin/cron/trigger` (HTTP gated por sessão admin) —
 *      pro botão "Enviar teste agora" do admin /notificacoes.
 *
 * Ter o mapa explícito aqui (em vez de derivar do nome do arquivo)
 * deixa óbvio quais kinds são "cron-disparáveis" e impede que o
 * endpoint admin execute qualquer função arbitrária do server.
 */

import { runManagerDailyReport } from './managerDailyReport';
import { runDailyDigest } from './dailyDigest';
import { runCommunityInteractions } from './communityInteractions';

/** Handler shape — todos os crons retornam algum stats object
 *  serializável que o endpoint manda de volta como resposta JSON. */
type CronHandler = () => Promise<unknown>;

export const CRON_REGISTRY: Record<string, CronHandler> = {
  manager_daily_report: runManagerDailyReport,
  daily_digest: runDailyDigest,
  community_interactions: runCommunityInteractions,
};

export type CronKind = keyof typeof CRON_REGISTRY;

export function isCronKind(s: string): s is CronKind {
  return Object.prototype.hasOwnProperty.call(CRON_REGISTRY, s);
}

/** Lista os kinds disponíveis — útil pro admin saber quais
 *  notificações têm botão "disparar agora". */
export function listTriggerableKinds(): string[] {
  return Object.keys(CRON_REGISTRY);
}
