import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getAdminKpis } from '@/server/admin/queries';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const kpis = await getAdminKpis();
  return NextResponse.json({ kpis });
}
