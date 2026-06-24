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

/** Validação de entrada de produto — compartilhada pelas rotas POST/PATCH.
 *  Mora aqui (não no route.ts) porque route.ts do App Router só pode
 *  exportar handlers + config; um `export const` extra quebra o build. */
export const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullish(),
  priceFrom: z.number().int().min(0).max(100_000_000).nullish(),
  priceTo: z.number().int().min(0).max(100_000_000),
  imageUrls: z.array(z.string().max(2000)).max(10).optional(),
  audience: z.enum(['top1', 'top10', 'top50', 'top100', 'all']).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export interface ProductInput {
  name: string;
  description?: string | null;
  priceFrom?: number | null;
  priceTo: number;
  imageUrls?: string[];
  audience?: ProductAudience;
  active?: boolean;
  sortOrder?: number;
}

export interface ApiProduct {
  id: string;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number;
  imageUrls: string[];
  audience: ProductAudience;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function serialize(r: ProductRow): ApiProduct {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    priceFrom: r.priceFrom,
    priceTo: r.priceTo,
    imageUrls: Array.isArray(r.imageUrls) ? (r.imageUrls as string[]) : [],
    audience: r.audience as ProductAudience,
    active: r.active,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
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
  const [row] = await db
    .insert(products)
    .values({
      name: input.name,
      description: input.description ?? null,
      priceFrom: input.priceFrom ?? null,
      priceTo: input.priceTo,
      imageUrls: input.imageUrls ?? [],
      audience: input.audience ?? 'all',
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
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
  if (input.imageUrls !== undefined) patch.imageUrls = input.imageUrls;
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

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
