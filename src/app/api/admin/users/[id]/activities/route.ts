import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getUserActivities } from '@/server/activities/queries';
import type { MyActivityRow } from '@/server/activities/queries';

export const runtime = 'nodejs';

/**
 * Admin-only feed of a single user's activity ledger.
 *
 *   GET /api/admin/users/:id/activities
 *
 * Per product feedback "No perfil de cada usuário, inclua o
 * registro de músicas que ele reproduziu na plataforma e salve
 * no admin junto das atividades do usuário." Replaces the
 * `generateUserActivities()` mock generator in
 * `admin/src/app/(shell)/users/[id]/activities/page.tsx`.
 *
 * Returns events shaped for the admin's `UserActivityEvent`
 * type — same envelope the compliance/audit table already
 * renders. Music plays (`stream` rows) show up as
 * `category: 'streaming', action: 'track_played'` items with
 * the track title + artist in the description, so the audit
 * view doubles as a per-user listening log.
 */

type AdminActivityCategory =
  | 'auth'
  | 'session'
  | 'profile'
  | 'content'
  | 'streaming'
  | 'moderation'
  | 'settings'
  | 'compliance';

interface AdminActivityEvent {
  id: string;
  userId: string;
  category: AdminActivityCategory;
  action: string;
  description: string;
  timestamp: string;
  result: 'success' | 'failure' | 'pending';
  relatedEntity?: {
    type: 'track' | 'conversation' | 'post';
    id: string;
    label?: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** Map a single ledger row's kind into the admin event shape. */
function mapToAdminEvent(
  userId: string,
  row: MyActivityRow,
): AdminActivityEvent {
  const base: Omit<AdminActivityEvent, 'category' | 'action' | 'description'> = {
    id: row.id,
    userId,
    timestamp: row.createdAt,
    result: 'success',
    metadata: row.points > 0 ? { fanpoints: row.points } : undefined,
  };

  switch (row.kind) {
    case 'stream': {
      const trackLabel =
        row.trackTitle && row.trackArtist
          ? `${row.trackTitle} — ${row.trackArtist}`
          : row.trackTitle ?? 'Faixa desconhecida';
      return {
        ...base,
        category: 'streaming',
        action: 'track_played',
        description: `Reproduziu ${trackLabel}`,
        relatedEntity: row.trackTitle
          ? { type: 'track', id: row.id, label: trackLabel }
          : undefined,
      };
    }
    case 'three_streams':
      return {
        ...base,
        category: 'streaming',
        action: 'three_streams_milestone',
        description: 'Completou um bloco de 3 streams seguidos (+10 FP)',
      };
    case 'login':
      return {
        ...base,
        category: 'auth',
        action: 'login_success',
        description: 'Sessão iniciada via magic-link',
      };
    case 'chat_started':
      return {
        ...base,
        category: 'content',
        action: 'chat_started',
        description: 'Iniciou uma conversa direta',
        relatedEntity: row.conversationSlug
          ? { type: 'conversation', id: row.conversationSlug }
          : undefined,
      };
    case 'post_liked':
      return {
        ...base,
        category: 'content',
        action: 'post_liked',
        description: 'Reagiu a um post do feed',
      };
    case 'comment_posted':
      return {
        ...base,
        category: 'content',
        action: 'comment_posted',
        description: 'Comentou em um post do feed',
      };
    case 'post_shared':
      return {
        ...base,
        category: 'content',
        action: 'post_shared',
        description: 'Compartilhou um post do feed',
      };
    default: {
      // Exhaustive catch — falls through to a generic ledger entry
      // so an unknown kind doesn't drop the row from the audit feed.
      const _exhaustive: never = row.kind;
      void _exhaustive;
      return {
        ...base,
        category: 'content',
        action: 'ledger_event',
        description: 'Evento registrado no ledger de atividades',
      };
    }
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  // The ledger query already merges in track + conversation
  // labels via JOINs, so we can map straight from MyActivityRow
  // to the admin event shape without further fan-out.
  const { items } = await getUserActivities(id, {
    limit: parsed.data.limit ?? 100,
  });

  const events = items.map((row) => mapToAdminEvent(id, row));

  return NextResponse.json({ events });
}
