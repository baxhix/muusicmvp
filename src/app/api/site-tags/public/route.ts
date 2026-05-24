import { NextResponse } from 'next/server';
import { getActiveSiteTags } from '@/server/admin/tags';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * Public read of currently-active tracking tags. Used by the
 * client-side TrackingTags + AnalyticsProvider to know which
 * pixels / SDK keys to load. No auth — the values these snippets
 * use (GA4 measurement ID, Clarity tag ID, PostHog project token)
 * are explicitly public-safe identifiers; the same ones would be
 * inlined into a static HTML page anyway.
 *
 * Cached for 60s in-process (see getActiveSiteTags). On a per-Node
 * cold call this is one indexed query against site_tags + a
 * small JSON serialization.
 */
export async function GET() {
  try {
    const tags = await getActiveSiteTags();
    return NextResponse.json({
      tags,
    }, {
      headers: {
        // Edge cache friendly — value rotates rarely.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (err) {
    logger.warn('site-tags.public.fetch-failed');
    return NextResponse.json({ tags: [] });
  }
}
