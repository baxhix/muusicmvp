import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { reports, users } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';
import { saveReportImage } from '@/server/reports/storage';
import { limitByIp, writeLimiter } from '@/server/rateLimit';

export const runtime = 'nodejs';

/**
 * Submit a new user report.
 *
 * Body: multipart/form-data with:
 *   - targetUserId (uuid, required) — the user being reported
 *   - source       (string, optional) — defaults to 'chat_user'.
 *   - description  (string, optional) — fan's free-text context
 *   - file         (image,  optional) — evidence screenshot
 *
 * Returns: { id, createdAt } of the newly-created report row.
 *
 * Security notes:
 *   - Requires the reporter to be authenticated (requireUser).
 *   - Rejects self-reports (UI shouldn't offer it; defense in depth).
 *   - Verifies the target exists as a real user — fake/marketing
 *     contacts (e.g. the Ana Castela fixture) wouldn't survive the
 *     FK constraint anyway, but we 422 with a clearer reason.
 *   - Image is saved to a dedicated reports directory.
 */
export async function POST(req: Request) {
  // Rate limit anti-flood. Reports são vetor clássico de abuso
  // (atacante denuncia usuário em massa pra forçar shadowban).
  const rl = limitByIp(req, writeLimiter, 'reports-create');
  if (!rl.ok) return rl.response;

  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const reporter = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const targetUserId = (form.get('targetUserId') as string | null)?.trim();
  const source = (form.get('source') as string | null)?.trim() || 'chat_user';
  const description =
    (form.get('description') as string | null)?.trim() || null;
  const file = form.get('file');

  if (!targetUserId) {
    return NextResponse.json({ error: 'missing_target' }, { status: 400 });
  }
  if (targetUserId === reporter.id) {
    return NextResponse.json({ error: 'self_report' }, { status: 400 });
  }

  // Reject reports against non-real users (e.g. the fake Ana fixture
  // whose id is 'fake-ana-castela', not a UUID). The DB FK would
  // explode otherwise; this gives the client a clean reason.
  const [targetRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!targetRow) {
    return NextResponse.json({ error: 'unknown_target' }, { status: 422 });
  }

  // Description guard — keep storage costs bounded. The UI also
  // limits input length, this is defense in depth.
  if (description && description.length > 2000) {
    return NextResponse.json({ error: 'description_too_long' }, { status: 400 });
  }

  // Create the report row first (we need its id to namespace the
  // image filename). If image upload then fails, we still keep the
  // text report — admins can review without the screenshot.
  const [created] = await db
    .insert(reports)
    .values({
      reporterId: reporter.id,
      targetUserId,
      source,
      description,
      imageUrl: null,
    })
    .returning({ id: reports.id, createdAt: reports.createdAt });

  if (file instanceof File && file.size > 0) {
    try {
      const result = await saveReportImage(created.id, file);
      await db
        .update(reports)
        .set({ imageUrl: result.url })
        .where(eq(reports.id, created.id));
    } catch (err) {
      console.warn('report image save failed (report kept w/o image):', err);
      // Swallow — text-only report is still valuable to admins.
    }
  }

  return NextResponse.json({
    id: created.id,
    createdAt: created.createdAt,
  });
}
