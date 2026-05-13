import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { reports, users } from '@/server/db/schema';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { alias } from 'drizzle-orm/pg-core';

export const runtime = 'nodejs';

/**
 * Admin moderation list — all user reports, newest first, with
 * reporter + target user metadata joined in.
 *
 * Shape mirrors what admin/src/types/index.ts's `Report` expects so
 * the existing moderation page can consume it without a transform
 * layer once admin/services/reports.ts is pointed here.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  // Two self-joins on users — one for reporter, one for target.
  // Drizzle's `alias` helper lets us disambiguate the columns.
  const reporterTbl = alias(users, 'reporter');
  const targetTbl = alias(users, 'target');

  const rows = await db
    .select({
      id: reports.id,
      source: reports.source,
      description: reports.description,
      imageUrl: reports.imageUrl,
      status: reports.status,
      createdAt: reports.createdAt,
      resolvedAt: reports.resolvedAt,
      reporterId: reporterTbl.id,
      reporterName: reporterTbl.name,
      reporterAvatarUrl: reporterTbl.avatarUrl,
      targetUserId: targetTbl.id,
      targetName: targetTbl.name,
      targetAvatarUrl: targetTbl.avatarUrl,
    })
    .from(reports)
    .leftJoin(reporterTbl, eq(reporterTbl.id, reports.reporterId))
    .leftJoin(targetTbl, eq(targetTbl.id, reports.targetUserId))
    .orderBy(desc(reports.createdAt))
    .limit(500);

  // Reshape into the Admin-friendly nested format the moderation
  // page already consumes (mirrors the mock data shape).
  const payload = rows.map((r) => ({
    id: r.id,
    reporterId: r.reporterId ?? '',
    reporter: {
      id: r.reporterId ?? '',
      name: r.reporterName ?? 'Desconhecido',
      handle: '',
      avatar: r.reporterAvatarUrl ?? '',
    },
    target: {
      kind: 'user' as const,
      userId: r.targetUserId ?? '',
    },
    targetSnapshot: {
      label: r.targetName ?? 'Usuário',
      authorName: r.targetName ?? undefined,
    },
    // Source isn't in the existing reason enum; map to 'other' so
    // the admin UI's badge logic doesn't break. The raw `source`
    // is still available below for richer rendering.
    reason: 'other' as const,
    description: r.description ?? undefined,
    image: r.imageUrl ?? undefined,
    status:
      r.status === 'open'      ? ('open' as const) :
      r.status === 'resolved'  ? ('resolved' as const) :
      r.status === 'dismissed' ? ('dismissed' as const) :
      r.status === 'escalated' ? ('escalated' as const) :
                                  ('open' as const),
    priority: 'medium' as const,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString(),
    source: r.source,
  }));

  // Soften any noisy sql() reference Drizzle's tree-shaker complains
  // about when this file isn't called. (Keeps the import live.)
  void sql;

  return NextResponse.json(payload);
}
