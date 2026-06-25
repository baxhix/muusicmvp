/**
 * Categorias de produtos da Loja Fanverse — camada de dados (admin CRUD).
 *
 * Agrupamento simples (nome + descrição). Um produto referencia no
 * máximo uma categoria via products.category_id (SET NULL ao apagar).
 */

import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { productCategories, type ProductCategoryRow } from '../db/schema';

/** Validação de entrada — compartilhada pelas rotas POST/PATCH.
 *  Mora aqui (não no route.ts): route.ts do App Router só pode
 *  exportar handlers + config; um `export const` extra quebra o build. */
export const productCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export interface ProductCategoryInput {
  name: string;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface ApiProductCategory {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function serialize(r: ProductCategoryRow): ApiProductCategory {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    active: r.active,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listProductCategories(): Promise<ApiProductCategory[]> {
  const rows = await db
    .select()
    .from(productCategories)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
  return rows.map(serialize);
}

export async function createProductCategory(
  input: ProductCategoryInput,
): Promise<ApiProductCategory> {
  const [row] = await db
    .insert(productCategories)
    .values({
      name: input.name,
      description: input.description ?? null,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return serialize(row);
}

export async function updateProductCategory(
  id: string,
  input: Partial<ProductCategoryInput>,
): Promise<ApiProductCategory | null> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  const [row] = await db
    .update(productCategories)
    .set(patch)
    .where(eq(productCategories.id, id))
    .returning();
  return row ? serialize(row) : null;
}

export async function deleteProductCategory(id: string): Promise<boolean> {
  // products.category_id é SET NULL (FK), então apagar a categoria
  // só desvincula os produtos — não os apaga.
  const res = await db
    .delete(productCategories)
    .where(eq(productCategories.id, id))
    .returning({ id: productCategories.id });
  return res.length > 0;
}
