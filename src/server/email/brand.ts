/**
 * Configurações globais de marca aplicadas a TODOS os emails:
 *   - logo do header
 *   - footer institucional (links + redes sociais + endereço)
 *
 * Single row (id=1) na tabela `email_brand_settings`. A migration
 * faz seed do row vazio — esta camada faz upsert idempotente.
 *
 * Cached lazy em memória por 60s — emails são disparados em
 * volume mas as settings mudam raramente. Cache invalida em
 * upsert no admin.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { emailBrandSettings } from '../db/schema';
import type { BrandSettings } from './design';

let cached: { value: BrandSettings | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getBrandSettings(): Promise<BrandSettings | null> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const rows = await db
      .select()
      .from(emailBrandSettings)
      .where(eq(emailBrandSettings.id, 1))
      .limit(1);
    const value = (rows[0]?.settings as BrandSettings | undefined) ?? null;
    cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    // Defensivo: se a migration não rodou ou DB indisponível,
    // retorna null e o renderer pula o brand footer.
    return null;
  }
}

export async function upsertBrandSettings(
  settings: BrandSettings,
  updatedBy: string,
): Promise<void> {
  await db
    .insert(emailBrandSettings)
    .values({
      id: 1,
      settings: settings as unknown as Record<string, unknown>,
      updatedBy,
    })
    .onConflictDoUpdate({
      target: emailBrandSettings.id,
      set: {
        settings: settings as unknown as Record<string, unknown>,
        updatedBy,
        updatedAt: new Date(),
      },
    });
  /* Invalida cache imediatamente — próximo render busca fresco. */
  cached = null;
}

export function invalidateBrandCache(): void {
  cached = null;
}
