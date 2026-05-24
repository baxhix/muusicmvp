import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../env';

/**
 * Storage helper para arquivos do acervo "Materiais".
 *
 * Espelha o padrão de feed/storage.ts e avatars/storage.ts:
 *   - Files vivem num Docker volume (`MATERIAIS_DIR=/app/uploads/materiais`)
 *     pra sobreviver rebuilds de container.
 *   - Filenames `<uuid>.<random>.<ext>` — random suffix torna a
 *     URL imutável por upload (safe pra cache agressivo).
 *   - Servidos via rota Next pública que valida o filename contra
 *     regex strict (sem path traversal).
 *
 * Caps:
 *   - 50 MB por arquivo. Cobre wallpapers 4K, álbuns de fotos
 *     individuais e packs ZIP médios. Pacotes maiores devem
 *     virar S3/R2 antes de bater no servidor.
 *   - Whitelisting de MIMEs amplo — materiais incluem imagem,
 *     áudio, vídeo, documento, pacote.
 */
export const MATERIAIS_DIR =
  process.env.MATERIAIS_DIR ?? path.join(process.cwd(), 'uploads', 'materiais');

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Mapping MIME → formato canônico + extensão. Único registry
 * de tipos suportados; adicionar formato novo é só estender
 * este map.
 */
const FORMATO_BY_MIME: Record<
  string,
  { formato: MaterialFormato; ext: string }
> = {
  // Imagens
  'image/jpeg':       { formato: 'jpg', ext: 'jpg' },
  'image/png':        { formato: 'png', ext: 'png' },
  'image/svg+xml':    { formato: 'svg', ext: 'svg' },
  // Áudio
  'audio/mpeg':       { formato: 'mp3', ext: 'mp3' },
  'audio/mp3':        { formato: 'mp3', ext: 'mp3' },
  // Vídeo
  'video/mp4':        { formato: 'mp4', ext: 'mp4' },
  // Docs / pacotes
  'application/pdf':  { formato: 'pdf', ext: 'pdf' },
  'application/zip':  { formato: 'zip', ext: 'zip' },
  'application/x-zip-compressed': { formato: 'zip', ext: 'zip' },
};

export type MaterialFormato =
  | 'jpg' | 'png' | 'svg' | 'mp3' | 'mp4' | 'pdf' | 'zip';

export type MaterialUploadError =
  | 'no_file'
  | 'unsupported_type'
  | 'too_large'
  | 'write_failed';

export interface SaveMaterialResult {
  /** URL absoluta servida pelo backend (relative to APP_URL). */
  url: string;
  /** Nome canônico no disco — guardado no DB pra delete. */
  filename: string;
  /** Formato detectado a partir do MIME. */
  formato: MaterialFormato;
  /** Bytes do arquivo recebido (validado <= MAX_BYTES). */
  tamanhoBytes: number;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(MATERIAIS_DIR, { recursive: true });
}

/**
 * Persiste um arquivo enviado por admin. `ownerId` prefixa o
 * filename — facilita auditoria + limpeza futura por admin.
 *
 * Retorna a URL pública + metadados que vão pro DB. Quem chama
 * (route handler) traduz `error.message` em status HTTP.
 */
export async function saveMaterialFile(
  ownerId: string,
  file: File,
): Promise<SaveMaterialResult> {
  if (!file || file.size === 0) {
    throw new Error('no_file' satisfies MaterialUploadError);
  }
  if (file.size > MAX_BYTES) {
    throw new Error('too_large' satisfies MaterialUploadError);
  }
  const meta = FORMATO_BY_MIME[file.type];
  if (!meta) {
    throw new Error('unsupported_type' satisfies MaterialUploadError);
  }

  const filename = `${ownerId}.${randomBytes(8).toString('hex')}.${meta.ext}`;
  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(MATERIAIS_DIR, filename), buffer);
  } catch (err) {
    console.error('materiais upload write failed:', err);
    throw new Error('write_failed' satisfies MaterialUploadError);
  }

  /* URL ABSOLUTA — env.APP_URL prefixado. Necessário porque o
   * admin app vive em outro origin (admin.muusic.live) e
   * precisa carregar o binário via <img> apontando pro main
   * app (muusic.live). Path relativo resolveria pro origin do
   * admin (404). Cookies compartilhados via COOKIE_DOMAIN. */
  return {
    url: `${env.APP_URL}/api/admin/materiais/files/${filename}`,
    filename,
    formato: meta.formato,
    tamanhoBytes: file.size,
  };
}

/** Best-effort delete — usado quando um arquivo é removido do DB. */
export async function deleteMaterialFile(filename: string): Promise<void> {
  const p = resolveMaterialPath(filename);
  if (!p) return;
  try {
    await fs.unlink(p);
  } catch {
    /* already gone — ignore */
  }
}

/** Resolve filename → path absoluto, validando contra traversal.
 *  Aceita o formato `<owner-uuid>.<8-16 hex>.<ext>` (qualquer ext
 *  whitelistada). Retorna null em qualquer outro caso. */
export function resolveMaterialPath(filename: string): string | null {
  if (
    !/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(jpg|png|svg|mp3|mp4|pdf|zip)$/i.test(
      filename,
    )
  ) {
    return null;
  }
  return path.join(MATERIAIS_DIR, filename);
}

/** Inverso do upload — MIME canônico pra Content-Type ao servir. */
export function contentTypeOf(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'mp3':
      return 'audio/mpeg';
    case 'mp4':
      return 'video/mp4';
    case 'pdf':
      return 'application/pdf';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}
