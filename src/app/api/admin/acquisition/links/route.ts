/**
 * GET    /api/admin/acquisition/links  → lista de links + signupCount
 * POST   /api/admin/acquisition/links  → cria link novo
 *
 * Autenticado como admin. Single-route porque o detail (GET por
 * id + DELETE + GET users) vive em /links/[id]/route.ts.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  createArtistLink,
  listArtistLinks,
} from '@/server/acquisition/links';
import { handleApiError, ValidationError } from '@/server/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await listArtistLinks();
    return NextResponse.json({ items });
  } catch (err) {
    return handleApiError(err, {
      scope: 'admin.acquisition.links.list',
      ctx: { actorId: auth.id },
    });
  }
}

const createSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_-]+$/, 'slug_invalid'),
  artistName: z.string().min(1).max(120),
  label: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new ValidationError('invalid_body');

    const link = await createArtistLink({
      slug: parsed.data.slug,
      artistName: parsed.data.artistName,
      label: parsed.data.label ?? null,
      createdBy: auth.id,
    });

    return NextResponse.json({ link });
  } catch (err) {
    /* slug duplicado vira erro 23505 do postgres — handleApiError
     * trata como ValidationError pra retornar 400 limpo. */
    return handleApiError(err, {
      scope: 'admin.acquisition.links.create',
      ctx: { actorId: auth.id },
    });
  }
}
