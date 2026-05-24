import { resolveReportImagePath } from '@/server/reports/storage';
import { serveFile } from '@/server/storage/serveFile';

export const runtime = 'nodejs';

/**
 * Public route — serves uploaded report-evidence images. Admins
 * carregam essas imagens no dashboard de moderação; o URL fica em
 * `reports.image_url`. Path traversal blocked pelo regex whitelist
 * em `resolveReportImagePath`. `serveFile` streama + ETags.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  return serveFile(req, resolveReportImagePath(filename), filename);
}
