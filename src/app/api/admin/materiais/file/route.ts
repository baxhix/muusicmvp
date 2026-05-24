import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { saveMaterialFile } from '@/server/materiais/storage';
import {
  createFile,
  type MaterialAudience,
} from '@/server/materiais/queries';

export const runtime = 'nodejs';

/** Audience tiers permitidas — runtime guard pra entrada do
 *  multipart (já que o type é só TypeScript). */
const AUDIENCES = new Set<MaterialAudience>([
  'top1', 'top10', 'top50', 'top100', 'all',
]);

/**
 * POST /api/admin/materiais/file
 *   body multipart/form-data:
 *     file:         File (obrigatório)
 *     parentId:     string (uuid de pasta — obrigatório)
 *     name:         string (nome no acervo — default = file.name)
 *     description:  string (obrigatório)
 *     audience:     'top1'|'top10'|'top50'|'top100'|'all'
 *     thumb:        string (data URL ou /public path; opcional)
 *     publishedToFeed: '1' ou '0' (opcional, default 0)
 *
 * Faz duas coisas atômicas (do ponto de vista do usuário):
 *   1. Salva o binário em uploads/materiais/ via storage helper.
 *   2. Insere o registro de metadados no DB.
 *
 * Se a inserção no DB falhar depois do disco, a função não
 * faz rollback do arquivo — best-effort. Risco aceitável pra MVP;
 * cron de cleanup pode varrer órfãos no futuro.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }

  const parentId = form.get('parentId');
  if (typeof parentId !== 'string' || !parentId) {
    return NextResponse.json({ error: 'missing_parent' }, { status: 400 });
  }

  /* Description é opcional. Upload em massa (drop zone) envia
   * arquivos sem descrição — fica em branco e o admin pode
   * editar depois pelo drawer. Validação só rejeita se o
   * payload for inválido (não-string). */
  const descriptionRaw = form.get('description');
  const description =
    typeof descriptionRaw === 'string' ? descriptionRaw.trim() : '';

  const audienceRaw = form.get('audience');
  const audience =
    typeof audienceRaw === 'string' && AUDIENCES.has(audienceRaw as MaterialAudience)
      ? (audienceRaw as MaterialAudience)
      : 'all';

  const nameRaw = form.get('name');
  const displayName =
    typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : file.name;

  const thumbRaw = form.get('thumb');
  const publishedToFeedRaw = form.get('publishedToFeed');
  const publishedToFeed = publishedToFeedRaw === '1' || publishedToFeedRaw === 'true';

  /* 1) Salva o binário no disco. saveMaterialFile valida MIME +
   *    size; throw com erro string-coded mapeado abaixo. */
  let saved;
  try {
    saved = await saveMaterialFile(admin.id, file);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'write_failed';
    const status =
      code === 'too_large'        ? 413 :
      code === 'unsupported_type' ? 415 :
      code === 'no_file'          ? 400 :
      500;
    if (status === 500) console.error('materiais file upload failed:', err);
    return NextResponse.json({ error: code }, { status });
  }

  /* 2) Insere no DB. Se for imagem e o cliente não mandou
   *    thumb, usamos a URL do próprio arquivo (browser scala
   *    no <img>). Pra outros formatos, thumb default genérico. */
  const isImage = ['jpg', 'png', 'svg'].includes(saved.formato);
  const defaultThumb = isImage ? saved.url : '/icon-chapeu-ac.svg';
  const thumb =
    typeof thumbRaw === 'string' && thumbRaw.trim() ? thumbRaw.trim() : defaultThumb;

  try {
    const node = await createFile({
      name: displayName,
      parentId,
      formato: saved.formato,
      fileUrl: saved.url,
      thumbUrl: thumb,
      filename: saved.filename,
      tamanhoBytes: saved.tamanhoBytes,
      description,
      audience,
      publishedToFeed,
      createdById: admin.id,
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (err) {
    console.error('materiais file db insert failed:', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
