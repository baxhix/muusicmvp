/**
 * Client-side companion to the server-side rewards ledger
 * (src/server/activities/queries.ts). The point values here MUST
 * mirror the `POINTS` map on the server — they're duplicated so
 * the frontend can show an instant "+N Fanpoints" toast without a
 * server roundtrip. Source of truth still lives server-side; this
 * is just a viewer-side optimistic cache.
 *
 * If you change a value here, update `POINTS` in
 * `src/server/activities/queries.ts` too (and run a migration if
 * the change adds a new `kind`).
 */

import { api, ApiError } from './api/client';
import { track } from './analytics';

export type RewardRule =
  | 'like'
  | 'comment'
  | 'send'
  | 'chat_started'
  | 'three_streams';

/**
 * Display amount per rule. Matches the server-side `POINTS` map
 * 1:1 for the same kinds (post_liked → like, post_shared → send,
 * comment_posted → comment, etc.). `three_streams` is awarded
 * server-side automatically when a viewer hits a multiple-of-3
 * stream count — clients should NOT fire awardPoints('three_streams')
 * manually; it's listed here purely so a toast can label the +10
 * cleanly when the listening response surfaces it.
 */
export const REWARD_POINTS: Record<RewardRule, number> = {
  like: 5,
  comment: 10,
  send: 15,
  chat_started: 3,
  three_streams: 10,
};

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
  const amount = REWARD_POINTS[rule];

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
