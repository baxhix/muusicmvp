/**
 * Produtos da Loja Fanverse — camada de dados (admin CRUD).
 *
 * Catálogo de produtos resgatáveis. Preços em Fanpoints. `audience`
 * define quais usuários podem comprar (tiers de Materiais).
 */

import { z } from 'zod';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { products, type ProductRow } from '../db/schema';

export type ProductAudience = 'top1' | 'top10' | 'top50' | 'top100' | 'all';

export type ProductMediaType = 'image' | 'video';
export interface ProductMedia {
  type: ProductMediaType;
  url: string;
}

/** Validação de entrada de produto — compartilhada pelas rotas POST/PATCH.
 *  Mora aqui (não no route.ts) porque route.ts do App Router só pode
 *  exportar handlers + config; um `export const` extra quebra o build. */
export const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullish(),
  priceFrom: z.number().int().min(0).max(100_000_000).nullish(),
  priceTo: z.number().int().min(0).max(100_000_000),
  /** @deprecated — aceito p/ back-compat; prefira `media`. */
  imageUrls: z.array(z.string().max(2000)).max(20).optional(),
  /** Galeria ordenada (imagens + vídeos). A ordem é a sequência exibida. */
  media: z
    .array(
      z.object({
        type: z.enum(['image', 'video']),
        url: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
  audience: z.enum(['top1', 'top10', 'top50', 'top100', 'all']).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  /** Categoria (UUID) ou null p/ "sem categoria". */
  categoryId: z.string().uuid().nullish(),
});

export interface ProductInput {
  name: string;
  description?: string | null;
  priceFrom?: number | null;
  priceTo: number;
  imageUrls?: string[];
  media?: ProductMedia[];
  audience?: ProductAudience;
  active?: boolean;
  sortOrder?: number;
  categoryId?: string | null;
}

export interface ApiProduct {
  id: string;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number;
  imageUrls: string[];
  media: ProductMedia[];
  audience: ProductAudience;
  active: boolean;
  sortOrder: number;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Normaliza a galeria de mídia de uma row, com fallback p/ rows antigas
 *  que só tinham `image_urls` (cada URL vira uma mídia tipo 'image'). */
function readMedia(r: ProductRow): ProductMedia[] {
  const raw = Array.isArray(r.media) ? (r.media as unknown[]) : [];
  const media = raw
    .filter(
      (m): m is ProductMedia =>
        !!m &&
        typeof m === 'object' &&
        (((m as ProductMedia).type === 'image') ||
          ((m as ProductMedia).type === 'video')) &&
        typeof (m as ProductMedia).url === 'string',
    )
    .map((m) => ({ type: m.type, url: m.url }));
  if (media.length > 0) return media;
  // Fallback: deriva de image_urls (produto pré-migração de mídia).
  const urls = Array.isArray(r.imageUrls) ? (r.imageUrls as string[]) : [];
  return urls.map((url) => ({ type: 'image' as const, url }));
}

function serialize(r: ProductRow): ApiProduct {
  const media = readMedia(r);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    priceFrom: r.priceFrom,
    priceTo: r.priceTo,
    // imageUrls = subconjunto de imagens da galeria (back-compat).
    imageUrls: media.filter((m) => m.type === 'image').map((m) => m.url),
    media,
    audience: r.audience as ProductAudience,
    active: r.active,
    sortOrder: r.sortOrder,
    categoryId: r.categoryId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Resolve a galeria final a partir do input: prefere `media`; se só veio
 *  `imageUrls` (cliente antigo), converte. Também devolve o subconjunto de
 *  imagens p/ manter a coluna legada `image_urls` em sincronia. */
function resolveMedia(input: {
  media?: ProductMedia[];
  imageUrls?: string[];
}): { media: ProductMedia[]; imageUrls: string[] } {
  const media =
    input.media ??
    (input.imageUrls
      ? input.imageUrls.map((url) => ({ type: 'image' as const, url }))
      : []);
  return { media, imageUrls: media.filter((m) => m.type === 'image').map((m) => m.url) };
}

export async function listProducts(): Promise<ApiProduct[]> {
  const rows = await db
    .select()
    .from(products)
    .orderBy(asc(products.sortOrder), desc(products.createdAt));
  return rows.map(serialize);
}

export async function createProduct(
  input: ProductInput,
  createdById: string,
): Promise<ApiProduct> {
  const { media, imageUrls } = resolveMedia(input);
  const [row] = await db
    .insert(products)
    .values({
      name: input.name,
      description: input.description ?? null,
      priceFrom: input.priceFrom ?? null,
      priceTo: input.priceTo,
      imageUrls,
      media,
      audience: input.audience ?? 'all',
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      categoryId: input.categoryId ?? null,
      createdById,
    })
    .returning();
  return serialize(row);
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<ApiProduct | null> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priceFrom !== undefined) patch.priceFrom = input.priceFrom;
  if (input.priceTo !== undefined) patch.priceTo = input.priceTo;
  // `media` é canônica; quando vem (ou quando vem só imageUrls legado),
  // resolve as duas colunas juntas pra não ficarem dessincronizadas.
  if (input.media !== undefined || input.imageUrls !== undefined) {
    const { media, imageUrls } = resolveMedia(input);
    patch.media = media;
    patch.imageUrls = imageUrls;
  }
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;

  const [row] = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, id))
    .returning();
  return row ? serialize(row) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const res = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return res.length > 0;
}
