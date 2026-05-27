/**
 * Admin helpers para `faq_entries` — CRUD da seção FAQ do site
 * público. Cobre listagem, criação, edição, publicação/despublicação,
 * remoção e reordenação.
 *
 * Convenção de ordenação:
 *   - `sort_order` int — menor = aparece primeiro.
 *   - Na criação, novo registro recebe `max(sort_order) + 1` pra ir
 *     pro fim da lista. UI pode chamar `reorderFaqEntries` depois pra
 *     posicionar exatamente onde o usuário soltou.
 *   - Tie-break por `createdAt` (assegurado pelo index composto).
 *
 * Convenção de publicação:
 *   - `publishedAt` null = rascunho (não aparece no /faq público).
 *   - `publishedAt` non-null = publicado, com a data exata da
 *     primeira publicação. Despublicar zera o timestamp; republicar
 *     grava `now()`.
 *
 * Toda mutação grava `updatedBy` no caller (passa o `actorId` que
 * vem do `requireAdmin()`).
 */

import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { faqEntries } from '../db/schema';

export interface FaqEntryRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRow(r: typeof faqEntries.$inferSelect): FaqEntryRow {
  return {
    id: r.id,
    question: r.question,
    answer: r.answer,
    category: r.category,
    sortOrder: r.sortOrder,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Lista tudo — admin vê rascunhos + publicados. */
export async function listFaqEntries(): Promise<FaqEntryRow[]> {
  const rows = await db
    .select()
    .from(faqEntries)
    .orderBy(asc(faqEntries.sortOrder), asc(faqEntries.createdAt));
  return rows.map(toRow);
}

export async function getFaqEntry(id: string): Promise<FaqEntryRow | null> {
  const [row] = await db
    .select()
    .from(faqEntries)
    .where(eq(faqEntries.id, id))
    .limit(1);
  return row ? toRow(row) : null;
}

export interface CreateFaqInput {
  question: string;
  answer: string;
  category?: string | null;
  publish?: boolean;
}

export async function createFaqEntry(
  input: CreateFaqInput,
  actorId: string,
): Promise<FaqEntryRow> {
  /* Pega o max(sort_order) pra empurrar o novo registro pro fim
   * da lista. Sem isso, todo novo FAQ apareceria no topo com
   * sortOrder=0, embaralhando a ordem dos itens já posicionados.
   * COALESCE pra primeira criação (tabela vazia → null → 0). */
  const [{ max: maxOrder }] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${faqEntries.sortOrder}), -1)`,
    })
    .from(faqEntries);

  const [row] = await db
    .insert(faqEntries)
    .values({
      question: input.question.trim(),
      answer: input.answer.trim(),
      category: input.category?.trim() || null,
      sortOrder: maxOrder + 1,
      publishedAt: input.publish ? new Date() : null,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return toRow(row);
}

export interface UpdateFaqInput {
  question?: string;
  answer?: string;
  category?: string | null;
  publish?: boolean;
}

export async function updateFaqEntry(
  id: string,
  input: UpdateFaqInput,
  actorId: string,
): Promise<FaqEntryRow | null> {
  /* Update parcial — só os campos enviados são tocados. Pra
   * `publish`, ler o estado atual primeiro evita sobrescrever
   * `publishedAt` quando o publish flag não veio. */
  const patch: Partial<typeof faqEntries.$inferInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId,
  };
  if (input.question !== undefined) patch.question = input.question.trim();
  if (input.answer !== undefined) patch.answer = input.answer.trim();
  if (input.category !== undefined) {
    patch.category = input.category?.trim() || null;
  }
  if (input.publish !== undefined) {
    if (input.publish) {
      /* Só grava `publishedAt` se ainda não estava publicado, pra
       * preservar a data de PRIMEIRA publicação em edições de quem
       * só salvou o texto. */
      const [existing] = await db
        .select({ publishedAt: faqEntries.publishedAt })
        .from(faqEntries)
        .where(eq(faqEntries.id, id))
        .limit(1);
      if (existing && existing.publishedAt === null) {
        patch.publishedAt = new Date();
      }
    } else {
      patch.publishedAt = null;
    }
  }

  const [row] = await db
    .update(faqEntries)
    .set(patch)
    .where(eq(faqEntries.id, id))
    .returning();
  return row ? toRow(row) : null;
}

export async function deleteFaqEntry(id: string): Promise<boolean> {
  const rows = await db
    .delete(faqEntries)
    .where(eq(faqEntries.id, id))
    .returning({ id: faqEntries.id });
  return rows.length > 0;
}

/**
 * Reordena em massa — recebe a lista completa de ids na ordem
 * desejada e grava `sortOrder` 0,1,2… num único transactional UPDATE.
 *
 * Por que receber a lista inteira em vez de deltas? Move de "passar
 * o ID 3 da posição 5 pra 2" exigia descobrir quais outros itens
 * deslizar pra cima — caro de fazer corretamente client-side. Lista
 * inteira = 1 update por row, sem race condition entre reorders
 * concorrentes.
 */
export async function reorderFaqEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(faqEntries)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(faqEntries.id, ids[i]));
    }
  });
}

/**
 * Lista FAQs publicados na ordem de exibição — usada pelo site
 * público (`/faq` ou componente equivalente). Filtra rascunhos
 * (publishedAt IS NULL).
 *
 * Não atende ao admin — o admin sempre usa `listFaqEntries()` pra
 * ver rascunhos + publicados.
 */
export async function listPublishedFaqEntries(): Promise<FaqEntryRow[]> {
  const rows = await db
    .select()
    .from(faqEntries)
    .where(sql`${faqEntries.publishedAt} IS NOT NULL`)
    .orderBy(asc(faqEntries.sortOrder), desc(faqEntries.publishedAt));
  return rows.map(toRow);
}
