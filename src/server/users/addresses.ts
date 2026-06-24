/**
 * Endereços de entrega do usuário (Loja Fanverse / Meus dados).
 *
 * Camada de dados do CRUD de endereços. Tudo é escopado por `userId`
 * (o caller passa o id do dono); as rotas /api/me/addresses garantem
 * que o dono é o usuário logado. Mantém no máximo UM endereço padrão
 * por usuário (is_default) — setar um novo padrão desmarca os demais
 * na mesma transação. O primeiro endereço vira padrão automaticamente.
 */

import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { userAddresses, type UserAddressRow } from '../db/schema';

/** Validação de entrada de endereço — compartilhada pelas rotas POST/PATCH.
 *  Mora aqui (e não no route.ts) porque arquivos route.ts do App Router só
 *  podem exportar handlers + config; um `export const` extra quebra o build. */
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

export interface AddressInput {
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  country?: string;
  isDefault?: boolean;
}

export interface ApiAddress {
  id: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

function serialize(r: UserAddressRow): ApiAddress {
  return {
    id: r.id,
    recipient: r.recipient,
    cep: r.cep,
    street: r.street,
    number: r.number,
    complement: r.complement,
    district: r.district,
    city: r.city,
    state: r.state,
    country: r.country,
    isDefault: r.isDefault,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Lista os endereços do usuário — padrão primeiro, depois mais recentes. */
export async function listAddresses(userId: string): Promise<ApiAddress[]> {
  const rows = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, userId))
    .orderBy(desc(userAddresses.isDefault), asc(userAddresses.createdAt));
  return rows.map(serialize);
}

export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<ApiAddress> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: userAddresses.id })
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId));
    // Primeiro endereço sempre vira padrão; senão, respeita o flag.
    const makeDefault = existing.length === 0 ? true : !!input.isDefault;

    if (makeDefault && existing.length > 0) {
      await tx
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, userId));
    }

    const [row] = await tx
      .insert(userAddresses)
      .values({
        userId,
        recipient: input.recipient,
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        district: input.district,
        city: input.city,
        state: input.state,
        country: input.country ?? 'Brasil',
        isDefault: makeDefault,
      })
      .returning();
    return serialize(row);
  });
}

/** Atualiza um endereço do usuário. Retorna null se não for dele. */
export async function updateAddress(
  userId: string,
  id: string,
  input: AddressInput,
): Promise<ApiAddress | null> {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: userAddresses.id })
      .from(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
      .limit(1);
    if (!owned) return null;

    if (input.isDefault) {
      await tx
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, userId));
    }

    const [row] = await tx
      .update(userAddresses)
      .set({
        recipient: input.recipient,
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        district: input.district,
        city: input.city,
        state: input.state,
        country: input.country ?? 'Brasil',
        isDefault: !!input.isDefault,
        updatedAt: new Date(),
      })
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
      .returning();
    return serialize(row);
  });
}

/** Apaga um endereço do usuário. Se era o padrão, promove o mais antigo
 *  restante a padrão. Retorna true se apagou. */
export async function deleteAddress(
  userId: string,
  id: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: userAddresses.id, isDefault: userAddresses.isDefault })
      .from(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
      .limit(1);
    if (!target) return false;

    await tx
      .delete(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)));

    if (target.isDefault) {
      const [next] = await tx
        .select({ id: userAddresses.id })
        .from(userAddresses)
        .where(eq(userAddresses.userId, userId))
        .orderBy(asc(userAddresses.createdAt))
        .limit(1);
      if (next) {
        await tx
          .update(userAddresses)
          .set({ isDefault: true })
          .where(eq(userAddresses.id, next.id));
      }
    }
    return true;
  });
}

/** Read-only para o admin: endereços de qualquer usuário. */
export async function listAddressesForAdmin(
  userId: string,
): Promise<ApiAddress[]> {
  return listAddresses(userId);
}
