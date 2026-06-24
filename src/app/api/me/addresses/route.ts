import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { listAddresses, createAddress } from '@/server/users/addresses';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * Endereços de entrega do usuário logado (Loja Fanverse / Meus dados).
 *
 *   GET  /api/me/addresses           → lista (padrão primeiro)
 *   POST /api/me/addresses { ... }   → cria (o 1º vira padrão)
 */
export const addressSchema = z.object({
  recipient: z.string().trim().min(1).max(120),
  cep: z.string().trim().min(8).max(9),
  street: z.string().trim().min(1).max(200),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(120).nullish(),
  district: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(2).max(40),
  country: z.string().trim().max(60).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const addresses = await listAddresses(auth.id);
    return NextResponse.json({ addresses });
  } catch (err) {
    logger.error('me.addresses.list', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  let parsed;
  try {
    parsed = addressSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const address = await createAddress(auth.id, parsed);
    return NextResponse.json({ address }, { status: 201 });
  } catch (err) {
    logger.error('me.addresses.create', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
