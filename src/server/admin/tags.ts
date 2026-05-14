import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { siteTags, users } from '../db/schema';

/**
 * Site tags server module.
 *
 *   - listAllSiteTags()    — admin reads every kind, including the
 *                            ones the team hasn't filled in yet
 *                            (returned with empty value + enabled
 *                            false). One row per known KIND so the
 *                            UI can render the full grid.
 *   - getActiveSiteTags()  — hot path called by the root layout on
 *                            every page render. Cached in-process
 *                            for 60s to avoid hammering the DB.
 *   - upsertSiteTag()      — admin write. Invalidates the cache.
 *
 * Cache strategy: a module-level Map + timestamp. Per-process, so
 * each Next.js node instance has its own copy; with a 60s TTL,
 * propagation across instances is fine — analytics tags rarely
 * change and a one-minute delay after toggling a pixel is
 * acceptable.
 */

export const KNOWN_TAG_KINDS = [
  'analytics',
  'gtm',
  'facebook',
  'clarity',
  'tiktok',
  'hotjar',
  'posthog',
] as const;
export type SiteTagKind = (typeof KNOWN_TAG_KINDS)[number];

export interface SiteTagRow {
  kind: SiteTagKind;
  value: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

/** Returns every known kind, filling in defaults for kinds the
 *  team hasn't touched. Used by the admin UI so the grid is
 *  fully-populated on first load. */
export async function listAllSiteTags(): Promise<SiteTagRow[]> {
  const rows = await db
    .select({
      kind: siteTags.kind,
      value: siteTags.value,
      enabled: siteTags.enabled,
      updatedAt: siteTags.updatedAt,
      updatedById: siteTags.updatedById,
      updatedByName: users.name,
      updatedByEmail: users.email,
      updatedByAvatar: users.avatarUrl,
    })
    .from(siteTags)
    .leftJoin(users, eq(users.id, siteTags.updatedById));

  const byKind = new Map<string, (typeof rows)[number]>();
  for (const r of rows) byKind.set(r.kind, r);

  return KNOWN_TAG_KINDS.map((kind) => {
    const r = byKind.get(kind);
    return {
      kind,
      value: r?.value ?? '',
      enabled: r?.enabled ?? false,
      updatedAt: (r?.updatedAt ?? new Date(0)).toISOString(),
      updatedBy: r?.updatedById
        ? {
            id: r.updatedById,
            name: r.updatedByName,
            email: r.updatedByEmail ?? '',
            avatarUrl: r.updatedByAvatar,
          }
        : null,
    };
  });
}

// ── Public read path ─────────────────────────────────────────────

interface ActiveTag {
  kind: SiteTagKind;
  value: string;
}

let cache: { at: number; tags: ActiveTag[] } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Enabled + non-empty tags only. Cached for 60s in-process. Called
 * by the root layout server component to inject the right `<Script>`
 * snippets on every page render.
 */
export async function getActiveSiteTags(): Promise<ActiveTag[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.tags;
  }
  try {
    const rows = await db
      .select({
        kind: siteTags.kind,
        value: siteTags.value,
        enabled: siteTags.enabled,
      })
      .from(siteTags)
      .where(eq(siteTags.enabled, true));
    const tags = rows
      .filter((r) => r.value.trim().length > 0)
      .map((r) => ({ kind: r.kind as SiteTagKind, value: r.value.trim() }));
    cache = { at: Date.now(), tags };
    return tags;
  } catch (err) {
    // DB hiccup → don't break the layout. Return whatever we have
    // cached (even if stale) or empty.
    console.warn('getActiveSiteTags failed, falling back:', err);
    return cache?.tags ?? [];
  }
}

/** Invalidate the cache. Called from upsertSiteTag so admin saves
 *  reach the public layout on the next request. */
export function invalidateSiteTagsCache(): void {
  cache = null;
}

// ── Write path ───────────────────────────────────────────────────

export async function upsertSiteTag(
  args: { kind: SiteTagKind; value: string; enabled: boolean },
  actorId: string,
): Promise<void> {
  // Treat empty/whitespace value as "clear" — keeps the value
  // alongside enabled=false so it's easy to unhide later.
  const value = args.value.trim();
  if (value.length > 200) throw new Error('value_too_long');
  if (!KNOWN_TAG_KINDS.includes(args.kind)) throw new Error('invalid_kind');

  await db
    .insert(siteTags)
    .values({
      kind: args.kind,
      value,
      enabled: args.enabled && value.length > 0,
      updatedById: actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteTags.kind,
      set: {
        value,
        enabled: args.enabled && value.length > 0,
        updatedById: actorId,
        updatedAt: new Date(),
      },
    });

  invalidateSiteTagsCache();
}

/** Used by routes to coerce + validate a path/body param. */
export function isSiteTagKind(v: unknown): v is SiteTagKind {
  return typeof v === 'string' && (KNOWN_TAG_KINDS as readonly string[]).includes(v);
}

// Avoid an unused-import error when only used as a type elsewhere.
export type { SiteTagKind as SiteTagKindType };

// Re-export the where helper so other modules can opt into
// "only this kind" filtering without re-importing drizzle.
export const _internal = { and };
