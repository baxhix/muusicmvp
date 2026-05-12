import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  createTrack,
  extractYouTubeId,
  listAllTracksForAdmin,
} from '@/server/tracks/queries';

export const runtime = 'nodejs';

const createSchema = z.object({
  url: z.string().min(1).max(2048),
  title: z.string().min(1).max(200).transform((s) => s.trim()),
  artist: z.string().min(1).max(200).transform((s) => s.trim()),
  album: z.string().max(200).optional().transform((s) => s?.trim() || undefined),
});

/**
 * Admin track management. GET lists every track in the catalog
 * (newest first) for the admin table; POST appends a new one
 * after parsing the YouTube URL into a stable video id.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const tracks = await listAllTracksForAdmin();
  return NextResponse.json(tracks);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const youtubeId = extractYouTubeId(parsed.url);
  if (!youtubeId) {
    return NextResponse.json(
      { error: 'invalid_youtube_url' },
      { status: 400 },
    );
  }

  const { row, created } = await createTrack({
    title: parsed.title,
    artist: parsed.artist,
    album: parsed.album ?? null,
    youtubeId,
  });

  // Distinct status codes so the admin form can tell "newly added"
  // from "already in catalog" — both are success paths, just with
  // different toast messages.
  return NextResponse.json(
    { track: row, created },
    { status: created ? 201 : 200 },
  );
}
