/**
 * Admin helpers para `onboarding_tour_cards` — CRUD dos cards do
 * tour de orientação in-app. Cobre listagem, criação, edição,
 * publicação/despublicação, remoção e reordenação. Espelha o
 * padrão do FAQ (`src/server/admin/faq.ts`).
 *
 * Ordenação: `sort_order` int, menor = primeiro passo. Novo card
 * vai pro fim (max + 1); UI reordena com `reorderOnboardingCards`.
 *
 * Publicação: `publishedAt` null = rascunho (não aparece pro
 * usuário no /app). O app consome `listPublishedOnboardingCards()`.
 *
 * `decor` aceita 'globe' (decoração de bolhas no passo do globo) ou
 * null. `anchor` é reservado pro spotlight ancorado (Fase futura).
 */

import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { onboardingTourCards } from '../db/schema';

export interface OnboardingCardRow {
  id: string;
  emoji: string | null;
  title: string;
  body: string;
  cta: string;
  decor: string | null;
  anchor: string | null;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRow(r: typeof onboardingTourCards.$inferSelect): OnboardingCardRow {
  return {
    id: r.id,
    emoji: r.emoji,
    title: r.title,
    body: r.body,
    cta: r.cta,
    decor: r.decor,
    anchor: r.anchor,
    sortOrder: r.sortOrder,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Normaliza decor: só 'globe' é válido; qualquer outra coisa → null. */
function normalizeDecor(decor?: string | null): string | null {
  return decor === 'globe' ? 'globe' : null;
}

/** Lista tudo — admin vê rascunhos + publicados, na ordem de exibição. */
export async function listOnboardingCards(): Promise<OnboardingCardRow[]> {
  const rows = await db
    .select()
    .from(onboardingTourCards)
    .orderBy(asc(onboardingTourCards.sortOrder), asc(onboardingTourCards.createdAt));
  return rows.map(toRow);
}

export async function getOnboardingCard(
  id: string,
): Promise<OnboardingCardRow | null> {
  const [row] = await db
    .select()
    .from(onboardingTourCards)
    .where(eq(onboardingTourCards.id, id))
    .limit(1);
  return row ? toRow(row) : null;
}

export interface CreateOnboardingCardInput {
  emoji?: string | null;
  title: string;
  body: string;
  cta: string;
  decor?: string | null;
  anchor?: string | null;
  publish?: boolean;
}

export async function createOnboardingCard(
  input: CreateOnboardingCardInput,
  actorId: string,
): Promise<OnboardingCardRow> {
  const [{ max: maxOrder }] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${onboardingTourCards.sortOrder}), -1)`,
    })
    .from(onboardingTourCards);

  const [row] = await db
    .insert(onboardingTourCards)
    .values({
      emoji: input.emoji?.trim() || null,
      title: input.title.trim(),
      body: input.body.trim(),
      cta: input.cta.trim(),
      decor: normalizeDecor(input.decor),
      anchor: input.anchor?.trim() || null,
      sortOrder: maxOrder + 1,
      publishedAt: input.publish ? new Date() : null,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return toRow(row);
}

export interface UpdateOnboardingCardInput {
  emoji?: string | null;
  title?: string;
  body?: string;
  cta?: string;
  decor?: string | null;
  anchor?: string | null;
  publish?: boolean;
}

export async function updateOnboardingCard(
  id: string,
  input: UpdateOnboardingCardInput,
  actorId: string,
): Promise<OnboardingCardRow | null> {
  const patch: Partial<typeof onboardingTourCards.$inferInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId,
  };
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.body !== undefined) patch.body = input.body.trim();
  if (input.cta !== undefined) patch.cta = input.cta.trim();
  if (input.decor !== undefined) patch.decor = normalizeDecor(input.decor);
  if (input.anchor !== undefined) patch.anchor = input.anchor?.trim() || null;
  if (input.publish !== undefined) {
    if (input.publish) {
      /* Preserva a data da PRIMEIRA publicação em edições de texto. */
      const [existing] = await db
        .select({ publishedAt: onboardingTourCards.publishedAt })
        .from(onboardingTourCards)
        .where(eq(onboardingTourCards.id, id))
        .limit(1);
      if (existing && existing.publishedAt === null) {
        patch.publishedAt = new Date();
      }
    } else {
      patch.publishedAt = null;
    }
  }

  const [row] = await db
    .update(onboardingTourCards)
    .set(patch)
    .where(eq(onboardingTourCards.id, id))
    .returning();
  return row ? toRow(row) : null;
}

export async function deleteOnboardingCard(id: string): Promise<boolean> {
  const rows = await db
    .delete(onboardingTourCards)
    .where(eq(onboardingTourCards.id, id))
    .returning({ id: onboardingTourCards.id });
  return rows.length > 0;
}

/**
 * Reordena em massa — recebe a lista completa de ids na ordem
 * desejada e grava `sortOrder` 0,1,2… num único UPDATE transacional.
 */
export async function reorderOnboardingCards(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(onboardingTourCards)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(onboardingTourCards.id, ids[i]));
    }
  });
}

/**
 * Lista os cards publicados na ordem de exibição — consumido pelo
 * app via `GET /api/onboarding-tour`. Filtra rascunhos.
 */
export async function listPublishedOnboardingCards(): Promise<OnboardingCardRow[]> {
  const rows = await db
    .select()
    .from(onboardingTourCards)
    .where(sql`${onboardingTourCards.publishedAt} IS NOT NULL`)
    .orderBy(asc(onboardingTourCards.sortOrder), desc(onboardingTourCards.publishedAt));
  return rows.map(toRow);
}
