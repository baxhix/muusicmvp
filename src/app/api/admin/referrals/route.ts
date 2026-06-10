import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listReferralsForAdmin } from '@/server/referral/queries';

export const runtime = 'nodejs';

/**
 * GET /api/admin/referrals?limit=&offset=
 *
 * Lista os referrals (loop viral) pro painel admin /convites, com
 * KPIs agregados (total, ativados, conversão, FP concedidos).
 * Substitui o mock `invitesService.list()` quando o admin roda em
 * driver HTTP. Gated por requireAdmin.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? '50');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  const data = await listReferralsForAdmin({
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json(data);
}
