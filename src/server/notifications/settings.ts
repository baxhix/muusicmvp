/**
 * Read/write das configurações por-kind + helper de runtime
 * (`isNotificationEnabled`) usado pelos senders pra decidir se
 * mandam ou não.
 *
 * Cache em memória com TTL curto (60s) — admin muda raramente,
 * mas leitura é hot path (cada envio bate aqui). Invalidação no
 * upsert.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { notificationSettings, notifications } from '../db/schema';
import {
  KNOWN_NOTIFICATIONS,
  getKnownNotification,
  type NotificationChannel,
} from './catalog';
import { logger } from '../log';

export interface NotificationSettingsValue {
  kind: string;
  enabled: boolean;
  channels: Partial<Record<NotificationChannel, boolean>>;
  labelOverride: string | null;
  descriptionOverride: string | null;
  triggerOverride: string | null;
  updatedAt: string | null;
}

let cached: { value: Map<string, NotificationSettingsValue>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadFromDb(): Promise<Map<string, NotificationSettingsValue>> {
  const rows = await db.select().from(notificationSettings);
  const map = new Map<string, NotificationSettingsValue>();
  for (const row of rows) {
    map.set(row.kind, {
      kind: row.kind,
      enabled: row.enabled,
      channels: (row.channels ?? {}) as Partial<Record<NotificationChannel, boolean>>,
      labelOverride: row.labelOverride ?? null,
      descriptionOverride: row.descriptionOverride ?? null,
      triggerOverride: row.triggerOverride ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    });
  }
  return map;
}

async function getCachedMap(): Promise<Map<string, NotificationSettingsValue>> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  try {
    const map = await loadFromDb();
    cached = { value: map, expiresAt: now + CACHE_TTL_MS };
    return map;
  } catch (err) {
    logger.error('notifications.settings.load-failed', err);
    return new Map();
  }
}

export function invalidateCache(): void {
  cached = null;
}

/* ──────────────────────────────────────────────────────────────
 * Admin queries: list + upsert.
 * ────────────────────────────────────────────────────────────── */

/** Lista combinando catálogo + overrides do DB. Sempre retorna
 *  TODOS os tipos conhecidos (mesmo os não-persistidos), com os
 *  defaults aplicados. */
export async function listNotifications(): Promise<NotificationSettingsValue[]> {
  const dbMap = await loadFromDb();
  return KNOWN_NOTIFICATIONS.map((known) => {
    const dbRow = dbMap.get(known.kind);
    if (dbRow) return dbRow;
    // Default: enabled=true + canais default ON.
    const channels: Partial<Record<NotificationChannel, boolean>> = {};
    for (const ch of known.supportedChannels) {
      channels[ch] = known.defaultChannels.includes(ch);
    }
    return {
      kind: known.kind,
      enabled: true,
      channels,
      labelOverride: null,
      descriptionOverride: null,
      triggerOverride: null,
      updatedAt: null,
    };
  });
}

export interface UpsertNotificationInput {
  kind: string;
  enabled: boolean;
  channels: Partial<Record<NotificationChannel, boolean>>;
  /** Quando undefined, NÃO toca a coluna. Quando null, limpa
   *  (volta pro catálogo). Quando string, salva como override. */
  labelOverride?: string | null;
  descriptionOverride?: string | null;
  triggerOverride?: string | null;
  updatedBy: string;
}

export async function upsertNotification(
  input: UpsertNotificationInput,
): Promise<void> {
  /* Filtra canais pra só os SUPPORTED pelo tipo — defesa contra
   * client mandar 'sms' num tipo que não suporta. */
  const known = getKnownNotification(input.kind);
  if (!known) {
    throw new Error(`unknown notification kind: ${input.kind}`);
  }
  const cleanChannels: Partial<Record<NotificationChannel, boolean>> = {};
  for (const ch of known.supportedChannels) {
    if (ch in input.channels) {
      cleanChannels[ch] = !!input.channels[ch];
    }
  }

  /* Normaliza overrides: trim + se vier vazio depois do trim,
   * vira null (= volta pro default do catálogo). undefined = mantém
   * o valor atual no DB. */
  const normalize = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim();
  const labelOverride = normalize(input.labelOverride);
  const descriptionOverride = normalize(input.descriptionOverride);
  const triggerOverride = normalize(input.triggerOverride);

  /* Drizzle não aceita Record<string, unknown> aqui — buildamos
   * o objeto tipado com os fields opcionais explícitos. */
  await db
    .insert(notificationSettings)
    .values({
      kind: input.kind,
      enabled: input.enabled,
      channels: cleanChannels as unknown as Record<string, unknown>,
      labelOverride: labelOverride ?? null,
      descriptionOverride: descriptionOverride ?? null,
      triggerOverride: triggerOverride ?? null,
      updatedBy: input.updatedBy,
    })
    .onConflictDoUpdate({
      target: notificationSettings.kind,
      set: {
        enabled: input.enabled,
        channels: cleanChannels as unknown as Record<string, unknown>,
        labelOverride: labelOverride ?? null,
        descriptionOverride: descriptionOverride ?? null,
        triggerOverride: triggerOverride ?? null,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    });

  invalidateCache();
}

/**
 * Apaga uma notificação do banco — remove o override de
 * configuração (notification_settings) E todas as instâncias
 * já entregues aos usuários (notifications).
 *
 * Após esta chamada:
 *   - O sino dos usuários (NotificationBell) para de mostrar
 *     qualquer notificação desse kind imediatamente.
 *   - A configuração no admin volta pros defaults do catálogo
 *     (KNOWN_NOTIFICATIONS) — esses são hardcoded no código,
 *     então o tipo ainda aparece na listagem com valores
 *     padrão. Pra ocultar do catálogo, é preciso editar o
 *     código + redeploy.
 *
 * Retorna a contagem de linhas removidas em cada tabela.
 *
 * NOTA: notifications.kind é um enum no DB, então remove só
 * funciona pros kinds que estão nesse enum. Os 'system' kinds
 * (boas_vindas, magic_link, etc) não têm instâncias na tabela
 * notifications — eles vivem só em emails — então essa
 * função só limpa o settings deles. Comportamento esperado.
 */
export async function deleteNotification(kind: string): Promise<{
  settingsDeleted: number;
  instancesDeleted: number;
}> {
  // Remove override do tipo em notification_settings.
  const settingsResult = await db
    .delete(notificationSettings)
    .where(eq(notificationSettings.kind, kind))
    .returning({ kind: notificationSettings.kind });

  // Remove instâncias já entregues. O cast `as never` é
  // necessário porque notifications.kind é tipado como union
  // dos 10 literais do enum, e `kind: string` é mais largo.
  // Em runtime o postgres simplesmente não encontra rows pra
  // kinds fora do enum — comportamento OK.
  const instancesResult = await db
    .delete(notifications)
    .where(eq(notifications.kind, kind as never))
    .returning({ id: notifications.id });

  invalidateCache();

  return {
    settingsDeleted: settingsResult.length,
    instancesDeleted: instancesResult.length,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Runtime check — usar nos senders antes de disparar.
 * ────────────────────────────────────────────────────────────── */

/**
 * Retorna true SE: tipo conhecido + master enabled + canal ativo.
 *
 *   if (await isNotificationEnabled('boas_vindas', 'email')) {
 *     await sendWelcomeEmail(...);
 *   }
 *
 * Para tipos "system: true" (magic link, etc) sempre retorna true
 * independente do registro no DB — esses não podem ser desativados.
 *
 * Defensive: se algo der ruim na leitura (DB indisponível,
 * cache miss), retorna true também — preferimos enviar a
 * silenciar um sinal crítico.
 */
export async function isNotificationEnabled(
  kind: string,
  channel: NotificationChannel,
): Promise<boolean> {
  const known = getKnownNotification(kind);
  if (!known) return true; // tipo desconhecido — não bloqueia
  if (known.system) return true; // crítico
  if (!known.supportedChannels.includes(channel)) return false;

  try {
    const map = await getCachedMap();
    const row = map.get(kind);
    if (!row) {
      // Sem registro = usa default do catálogo.
      return known.defaultChannels.includes(channel);
    }
    if (!row.enabled) return false;
    if (channel in row.channels) {
      return row.channels[channel] === true;
    }
    return known.defaultChannels.includes(channel);
  } catch (err) {
    logger.error('notifications.runtime-check-failed', err, { kind, channel });
    return true;
  }
}
