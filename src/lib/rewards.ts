/**
 * Client-side companion to the server-side rewards ledger
 * (src/server/activities/queries.ts).
 *
 * Os valores de pontos NÃO ficam mais hardcoded aqui — eles vêm
 * do cache em memória de `lib/displayPoints.ts`, que sincroniza
 * com o endpoint público /api/fanpoints/display-rules (que por
 * sua vez lê a tabela `fanpoint_rules` editável pelo admin).
 *
 * Assim, quando o admin muda um valor no /admin/config/fanpoints,
 * o toast e o optimistic update do ArtistBox passam a refletir o
 * valor novo em até 60s (TTL do cache cliente, ~mesmo do cache
 * servidor) — sem mais divergência cliente ↔ servidor.
 */

import { api, ApiError } from './api/client';
import { track } from './analytics';
import { getDisplayPoints } from './displayPoints';

export type RewardRule =
  | 'like'
  | 'comment'
  | 'send'
  | 'chat_started'
  | 'three_streams';

const FRIENDLY_LABELS: Record<RewardRule, string> = {
  like: 'curtida',
  comment: 'comentário',
  send: 'compartilhamento',
  chat_started: 'conversa iniciada',
  three_streams: '3 músicas seguidas',
};

/**
 * Fire-and-forget client-side hook for an engagement reward.
 *
 *  • Tracks the action via the platform analytics layer so
 *    PostHog / GA4 funnel reports include the award.
 *  • Optionally POSTs to a server-side reward endpoint (the
 *    caller decides which by passing `apiPath`). The POST is
 *    fire-and-forget — UI feedback fires immediately, the FP
 *    ledger updates whenever the server roundtrip lands.
 *  • Dispatches the `app:points-awarded` CustomEvent so the
 *    PointsToast component (rendered globally in /app) can show
 *    a "+N Fanpoints" pill.
 *
 * `chat_started` is recorded server-side automatically by
 * `recordActivity('chat_started')` inside the DM creation flow —
 * the frontend just fires the toast + analytics. Same for
 * `three_streams`: the listening endpoint inserts the activity
 * row on every 3rd stream, so this helper just decorates the
 * UX.
 */
export interface AwardPointsOptions {
  /**
   * Optional API path to fire as a fire-and-forget POST. Used by
   * the `like` and `send` rules (which need a server hit since
   * the actions don't otherwise touch the backend). `comment`,
   * `chat_started`, and `three_streams` skip the POST because
   * their existing endpoints already record the activity.
   */
  apiPath?: string;
  /** Extra context for the analytics event (post_id, etc.). */
  analyticsContext?: Record<string, unknown>;
}

export async function awardPoints(
  rule: RewardRule,
  options: AwardPointsOptions = {},
): Promise<void> {
  // Lê do cache cliente (sincronizado com /api/fanpoints/display-rules).
  // Se o cache ainda estiver cold, displayPoints devolve um fallback
  // razoável + dispara um refresh em background — toast nunca pisca
  // "+undefined".
  const amount = getDisplayPoints(rule);

  // 1. Analytics — single funnel-friendly event with the rule + amount.
  track('points_awarded', {
    rule,
    amount,
    ...options.analyticsContext,
  });

  // 2. UI feedback — fire-and-forget CustomEvent the toast picks up.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{
        rule: RewardRule;
        amount: number;
        label: string;
      }>('app:points-awarded', {
        detail: { rule, amount, label: FRIENDLY_LABELS[rule] },
      }),
    );
  }

  // 3. Server roundtrip (only when the caller asked for one).
  if (!options.apiPath) return;
  try {
    await api.post(options.apiPath);
  } catch (err) {
    // 401 = signed-out viewer (anonymous demo / expired session).
    // Anything else is unexpected — log so the bug shows up in
    // Sentry / server logs without blocking the optimistic UI.
    if (!(err instanceof ApiError) || err.status !== 401) {
      console.error(`awardPoints(${rule}) → ${options.apiPath} failed:`, err);
    }
  }
}
