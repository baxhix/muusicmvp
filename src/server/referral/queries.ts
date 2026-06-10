/**
 * Service layer do loop viral / referral usuário→usuário.
 *
 * Modelo (migration 0049):
 *   • Cada usuário tem um `referral_code` único e estável.
 *   • O link `/i/{code}` seta o cookie `fanverse_invite` (espelha o
 *     /r/[slug] de aquisição de artista). No signup, o backend lê o
 *     cookie e cria uma row em `referrals` (status='pending') +
 *     grava `users.referred_by_user_id`.
 *   • Quando o convidado ATIVA (completa onboarding), creditamos:
 *       - referrer  → `referral_bonus` Fanpoints
 *       - convidado → `referral_welcome` Fanpoints
 *     A transição pending→rewarded é atômica (UPDATE ... WHERE
 *     status='pending') pra garantir crédito único.
 *
 * Anti-fraude: reward só na ativação (não no signup puro), 1 referral
 * por convidado (referred_id UNIQUE), self-referral bloqueado.
 *
 * Tudo aqui é best-effort no caminho de auth: qualquer exceção é
 * logada e engolida — referral NUNCA pode derrubar signup/onboarding.
 */

import { randomInt } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db';
import { fanpointRules, referrals, users } from '../db/schema';
import { recordActivity, POINTS, type ActivityKind } from '../activities/queries';
import { env } from '../env';
import { logger } from '../log';

export const REFERRAL_BONUS_KIND: ActivityKind = 'referral_bonus';
export const REFERRAL_WELCOME_KIND: ActivityKind = 'referral_welcome';

/* Alfabeto sem caracteres ambíguos (0/O, 1/I/L) pra códigos fáceis
 *  de ditar/digitar. 8 chars = 32^8 ≈ 1.1e12 combinações. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** Monta a URL pública de convite a partir do code. */
export function buildReferralUrl(code: string): string {
  return `${env.APP_URL.replace(/\/+$/, '')}/i/${code}`;
}

/**
 * Lê o `points` atual de uma regra de Fanpoints, com fallback pro
 * mapa hardcoded (resiliente a tabela ainda não-seedada). Usado pra
 * denormalizar `reward_points` no momento da concessão e pra exibir
 * "ganhe X FP por amigo" na UI.
 */
async function getRulePoints(kind: ActivityKind): Promise<number> {
  try {
    const row = await db
      .select({ points: fanpointRules.points })
      .from(fanpointRules)
      .where(eq(fanpointRules.kind, kind))
      .limit(1);
    return row[0]?.points ?? POINTS[kind];
  } catch {
    return POINTS[kind];
  }
}

/**
 * Retorna o referral_code do usuário, gerando-o lazy (com retry em
 * colisão de UNIQUE) na primeira vez. Contas existentes já foram
 * backfilladas na migration 0049, então na prática só dispara
 * geração pra contas criadas entre o deploy e o backfill — ou nunca.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await db
    .select({ code: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const current = existing[0]?.code;
  if (current) return current;

  // Gera com retry — em colisão de UNIQUE, tenta outro code.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    try {
      const updated = await db
        .update(users)
        .set({ referralCode: code })
        .where(and(eq(users.id, userId), isNull(users.referralCode)))
        .returning({ code: users.referralCode });
      if (updated[0]?.code) return updated[0].code;
      // Outro request setou primeiro — relê e retorna.
      const reread = await db
        .select({ code: users.referralCode })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (reread[0]?.code) return reread[0].code;
    } catch {
      // Colisão de UNIQUE (code já usado por outro user) — tenta de novo.
    }
  }
  throw new Error('referral_code_generation_failed');
}

/**
 * Resolve um referral_code (vindo do cookie `fanverse_invite`) pro id
 * do referrer. Normaliza pra uppercase. Retorna null pra code
 * inexistente ou referrer soft-deleted.
 */
export async function resolveReferralCode(
  code: string | null | undefined,
): Promise<string | null> {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(normalized)) return null;
  try {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.referralCode, normalized), isNull(users.deletedAt)))
      .limit(1);
    return row[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Registra a atribuição de um convite no signup de um usuário NOVO.
 * Best-effort — NUNCA lança (não pode derrubar o signup).
 *
 * - Resolve o code → referrerId.
 * - Bloqueia self-referral (referrerId === referredId).
 * - Grava users.referred_by_user_id (só se ainda null).
 * - Insere referrals (status='pending') de forma idempotente
 *   (referred_id UNIQUE → ON CONFLICT DO NOTHING).
 */
export async function recordReferralAttribution(args: {
  referredId: string;
  code: string | null | undefined;
}): Promise<void> {
  try {
    const referrerId = await resolveReferralCode(args.code);
    if (!referrerId || referrerId === args.referredId) return;

    const normalized = (args.code as string).trim().toUpperCase();

    await db
      .update(users)
      .set({ referredByUserId: referrerId })
      .where(
        and(eq(users.id, args.referredId), isNull(users.referredByUserId)),
      );

    await db
      .insert(referrals)
      .values({
        referrerId,
        referredId: args.referredId,
        code: normalized,
        status: 'pending',
      })
      .onConflictDoNothing({ target: referrals.referredId });
  } catch (err) {
    logger.warn('referral.attribution-failed', {
      referredId: args.referredId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Dispara o reward na ATIVAÇÃO do convidado (chamado quando o user
 * completa onboarding). Best-effort — NUNCA lança.
 *
 * Transição atômica pending→rewarded: só o request que vencer o
 * UPDATE WHERE status='pending' credita os pontos. Idempotente —
 * chamadas repetidas no onboarding não duplicam crédito.
 */
export async function maybeRewardReferral(referredId: string): Promise<void> {
  try {
    const bonusPoints = await getRulePoints(REFERRAL_BONUS_KIND);

    const claimed = await db
      .update(referrals)
      .set({
        status: 'rewarded',
        activatedAt: new Date(),
        rewardedAt: new Date(),
        rewardPoints: bonusPoints,
      })
      .where(
        and(eq(referrals.referredId, referredId), eq(referrals.status, 'pending')),
      )
      .returning({ referrerId: referrals.referrerId });

    if (claimed.length === 0) return; // sem referral pendente / já creditado

    const { referrerId } = claimed[0];
    // Crédito de Fanpoints — recordActivity é fire-and-forget seguro.
    await recordActivity(referrerId, REFERRAL_BONUS_KIND);
    await recordActivity(referredId, REFERRAL_WELCOME_KIND);

    logger.info('referral.rewarded', { referrerId, referredId, bonusPoints });
  } catch (err) {
    logger.warn('referral.reward-failed', {
      referredId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface ReferralStats {
  code: string;
  url: string;
  /** Convidados que criaram conta via este link (qualquer status). */
  invited: number;
  /** Convidados que ativaram (status='rewarded'). */
  activated: number;
  /** Total de Fanpoints já creditados ao usuário por referrals. */
  pointsEarned: number;
  /** FP que o usuário ganha por cada amigo que ativar (regra atual). */
  rewardPerFriend: number;
}

/**
 * Estatísticas de referral pro painel "Convide amigos" no app.
 * Garante que o code exista (lazy create).
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCode(userId);

  const [counts, rewardPerFriend] = await Promise.all([
    db
      .select({
        invited: sql<number>`COUNT(*)::int`,
        activated: sql<number>`COUNT(*) FILTER (WHERE ${referrals.status} = 'rewarded')::int`,
        pointsEarned: sql<number>`COALESCE(SUM(${referrals.rewardPoints}) FILTER (WHERE ${referrals.status} = 'rewarded'), 0)::int`,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId)),
    getRulePoints(REFERRAL_BONUS_KIND),
  ]);

  return {
    code,
    url: buildReferralUrl(code),
    invited: counts[0]?.invited ?? 0,
    activated: counts[0]?.activated ?? 0,
    pointsEarned: counts[0]?.pointsEarned ?? 0,
    rewardPerFriend,
  };
}

/* ── Admin reporting ─────────────────────────────────────────── */

export interface AdminReferralRow {
  id: string;
  code: string;
  status: 'pending' | 'activated' | 'rewarded';
  rewardPoints: number | null;
  createdAt: string;
  activatedAt: string | null;
  referrer: { id: string; name: string | null; email: string; avatarUrl: string | null };
  referred: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

export interface AdminReferralList {
  items: AdminReferralRow[];
  total: number;
  summary: {
    total: number;
    activated: number;
    pending: number;
    /** % de convites que ativaram (activated / total). */
    conversionPct: number;
    pointsAwarded: number;
  };
}

/**
 * Lista referrals pro painel admin (/convites). Junta referrer +
 * referred (alias na mesma tabela users) e devolve KPIs agregados.
 * Substitui o mock `invitesService.list()` quando o admin roda em
 * driver HTTP.
 */
export async function listReferralsForAdmin(
  opts: { limit?: number; offset?: number } = {},
): Promise<AdminReferralList> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const referrer = alias(users, 'referrer');
  const referred = alias(users, 'referred');

  const [items, totalRow, summaryRow] = await Promise.all([
    db
      .select({
        id: referrals.id,
        code: referrals.code,
        status: referrals.status,
        rewardPoints: referrals.rewardPoints,
        createdAt: referrals.createdAt,
        activatedAt: referrals.activatedAt,
        referrerId: referrer.id,
        referrerName: referrer.name,
        referrerEmail: referrer.email,
        referrerAvatar: referrer.avatarUrl,
        referredId: referred.id,
        referredName: referred.name,
        referredEmail: referred.email,
        referredAvatar: referred.avatarUrl,
      })
      .from(referrals)
      .innerJoin(referrer, eq(referrals.referrerId, referrer.id))
      .innerJoin(referred, eq(referrals.referredId, referred.id))
      .orderBy(desc(referrals.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: sql<number>`COUNT(*)::int` }).from(referrals),
    db
      .select({
        total: sql<number>`COUNT(*)::int`,
        activated: sql<number>`COUNT(*) FILTER (WHERE ${referrals.status} = 'rewarded')::int`,
        pointsAwarded: sql<number>`COALESCE(SUM(${referrals.rewardPoints}) FILTER (WHERE ${referrals.status} = 'rewarded'), 0)::int`,
      })
      .from(referrals),
  ]);

  const total = totalRow[0]?.value ?? 0;
  const sTotal = summaryRow[0]?.total ?? 0;
  const sActivated = summaryRow[0]?.activated ?? 0;

  return {
    total,
    items: items.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status as AdminReferralRow['status'],
      rewardPoints: r.rewardPoints,
      createdAt: r.createdAt.toISOString(),
      activatedAt: r.activatedAt?.toISOString() ?? null,
      referrer: {
        id: r.referrerId,
        name: r.referrerName,
        email: r.referrerEmail,
        avatarUrl: r.referrerAvatar,
      },
      referred: {
        id: r.referredId,
        name: r.referredName,
        email: r.referredEmail,
        avatarUrl: r.referredAvatar,
      },
    })),
    summary: {
      total: sTotal,
      activated: sActivated,
      pending: Math.max(0, sTotal - sActivated),
      conversionPct: sTotal > 0 ? Math.round((sActivated / sTotal) * 100) : 0,
      pointsAwarded: summaryRow[0]?.pointsAwarded ?? 0,
    },
  };
}
