import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAllFanpointRules } from '@/server/admin/fanpointRules';

export const runtime = 'nodejs';

/**
 * GET /api/admin/fanpoints/rules
 *
 * Retorna as 7 regras conhecidas (uma por ActivityKind), cada uma
 * com o `points` atualmente persistido + metadados de quem editou
 * por último. Linhas faltantes (caso raríssimo — seed pulou
 * alguma) caem no fallback do POINTS const com `updatedBy: null`.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const items = await listAllFanpointRules();
  return NextResponse.json({ items });
}
