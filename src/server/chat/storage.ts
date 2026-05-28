/**
 * Storage helper para imagens anexadas a mensagens de chat.
 *
 * Mesmo padrão de `src/server/feed/storage.ts` e
 * `src/server/avatars/storage.ts`:
 *   - Arquivos vivem em um volume Docker (`CHAT_UPLOADS_DIR=/app/uploads/chat`)
 *     pra sobreviverem a rebuilds do container.
 *   - Filenames são `<conversationId>.<random>.<ext>`; o random
 *     suffix torna a URL imutável por upload → safe pra cache
 *     agressivo. Prefixar com `conversationId` (não com `userId`)
 *     permite limpar uploads de uma conversa específica (ex:
 *     "apagar conversa pra mim" + GC futuro).
 *   - Servido por uma rota pública (`/api/chat/images/[filename]`)
 *     que valida o filename contra regex de path traversal.
 *
 * Capacity:
 *   - 8 MB por imagem — alinhado com o pipeline do feed.
 *   - jpg / png / webp / gif. AVIF intencionalmente omitido até
 *     medirmos suporte de browser na audiência (mesma decisão
 *     do feed).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { logger } from '../log';

export const CHAT_UPLOADS_DIR =
  process.env.CHAT_UPLOADS_DIR ?? path.join(process.cwd(), 'uploads', 'chat');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type ChatUploadError =
  | 'no_file'
  | 'unsupported_type'
  | 'too_large'
  | 'write_failed';

export interface SaveChatImageResult {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Dimensions sniffadas do header da imagem — permite reservar o
   *  slot no renderer e evitar layout shift. Pode ser null se o
   *  sniffer não souber ler o formato (ex: gif truncado). */
  width: number | null;
  height: number | null;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CHAT_UPLOADS_DIR, { recursive: true });
}

/**
 * Lê os primeiros bytes do buffer pra inferir width/height da
 * imagem. Cobre os 4 formatos do allowlist (jpg, png, webp, gif).
 * Retorna `null` quando o header não bate com nenhum dos parsers
 * — caller usa null no banco e o renderer cai num <img> sem
 * reserva de slot (layout shift ok como fallback).
 *
 * Por que parser custom em vez de uma lib (ex: image-size)?
 * Evita adicionar uma dependência só pra dimensions. Os 4
 * formatos têm header simples e bem documentado.
 */
function sniffDimensions(
  buf: Buffer,
  mime: string,
): { width: number; height: number } | null {
  try {
    if (mime === 'image/png' && buf.length >= 24) {
      /* PNG: signature 8 bytes, IHDR chunk começa em offset 8.
       * IHDR layout: 4 bytes len + "IHDR" + 4 bytes width + 4 bytes height. */
      if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      ) {
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        return { width, height };
      }
    }
    if (mime === 'image/gif' && buf.length >= 10) {
      /* GIF87a / GIF89a: bytes 6-7 = width LE, 8-9 = height LE. */
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        const width = buf.readUInt16LE(6);
        const height = buf.readUInt16LE(8);
        return { width, height };
      }
    }
    if (mime === 'image/webp' && buf.length >= 30) {
      /* WebP: RIFF header + VP8/VP8L/VP8X chunks com layouts
       * diferentes. Trato os 3 mais comuns. */
      if (
        buf[0] === 0x52 && // R
        buf[1] === 0x49 && // I
        buf[2] === 0x46 && // F
        buf[3] === 0x46 // F
      ) {
        const fourCC = buf.slice(12, 16).toString('ascii');
        if (fourCC === 'VP8 ') {
          /* Lossy VP8: bitstream começa em offset 30. Dimensions
           * em offsets 26-27 (width) e 28-29 (height) com flag
           * bits removidas. */
          const w = buf.readUInt16LE(26) & 0x3fff;
          const h = buf.readUInt16LE(28) & 0x3fff;
          return { width: w, height: h };
        }
        if (fourCC === 'VP8L') {
          /* Lossless VP8L: dimensions em 5 bytes a partir de offset 21. */
          const b0 = buf[21];
          const b1 = buf[22];
          const b2 = buf[23];
          const b3 = buf[24];
          const width = 1 + ((((b1 & 0x3f) << 8) | b0) & 0x3fff);
          const height =
            1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
          return { width, height };
        }
        if (fourCC === 'VP8X' && buf.length >= 30) {
          /* Extended: canvas size em offsets 24..29, cada um
           * 3 bytes LE — 1. */
          const w =
            1 + ((buf[24] | (buf[25] << 8) | (buf[26] << 16)) & 0xffffff);
          const h =
            1 + ((buf[27] | (buf[28] << 8) | (buf[29] << 16)) & 0xffffff);
          return { width: w, height: h };
        }
      }
    }
    if (mime === 'image/jpeg' && buf.length >= 4) {
      /* JPEG: marker FF D8 no início. SOF0/SOF2 marker (FF C0 ou
       * FF C2) traz width/height nos bytes que seguem o length.
       * Faz scan linear até achar. Bound em 16KB pra defender
       * contra arquivos truncados. */
      if (buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        const max = Math.min(buf.length - 9, 16_384);
        while (i < max) {
          if (buf[i] !== 0xff) break;
          const marker = buf[i + 1];
          /* SOFx markers exceto DHT/DAC/DNL etc. */
          if (
            (marker >= 0xc0 && marker <= 0xcf) &&
            marker !== 0xc4 &&
            marker !== 0xc8 &&
            marker !== 0xcc
          ) {
            const height = buf.readUInt16BE(i + 5);
            const width = buf.readUInt16BE(i + 7);
            return { width, height };
          }
          /* Pula o segment usando o length de 2 bytes BE. */
          const segLen = buf.readUInt16BE(i + 2);
          i += 2 + segLen;
        }
      }
    }
  } catch {
    /* Buffer underflow ou format inválido — retorna null. */
  }
  return null;
}

/**
 * Persiste uma imagem anexada a uma mensagem.
 *
 * Throws `ChatUploadError` (string code) em falhas de validação
 * pro route handler mapear pro HTTP status correto.
 */
export async function saveChatImage(
  conversationId: string,
  file: File,
): Promise<SaveChatImageResult> {
  if (!file || file.size === 0) {
    throw new Error('no_file' satisfies ChatUploadError);
  }
  if (file.size > MAX_BYTES) {
    throw new Error('too_large' satisfies ChatUploadError);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('unsupported_type' satisfies ChatUploadError);
  }

  const ext = EXT_BY_MIME[file.type];
  const filename = `${conversationId}.${randomBytes(8).toString('hex')}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(CHAT_UPLOADS_DIR, filename), buffer);
  } catch (err) {
    logger.error('chat.image.write', err);
    throw new Error('write_failed' satisfies ChatUploadError);
  }

  const dims = sniffDimensions(buffer, file.type);

  return {
    url: `/api/chat/images/${filename}`,
    filename,
    mimeType: file.type,
    size: file.size,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
}

/** Delete a single uploaded chat image by filename (best-effort). */
export async function deleteChatImage(filename: string): Promise<void> {
  const p = resolveChatImagePath(filename);
  if (!p) return;
  try {
    await fs.unlink(p);
  } catch {
    /* arquivo já não existe — ignora */
  }
}

/**
 * Resolve um filename ao path em disco, validado contra path
 * traversal. Retorna null pra qualquer string que não case com o
 * formato esperado `<uuid>.<hex>.<ext>` — defesa em camadas com
 * o `path.join` (que normaliza ../ etc).
 */
export function resolveChatImagePath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(jpg|png|webp|gif)$/i.test(filename)) {
    return null;
  }
  return path.join(CHAT_UPLOADS_DIR, filename);
}

/**
 * Extrai o filename de uma URL `/api/chat/images/<filename>`.
 * Retorna null pra qualquer URL que não case com o pattern — usado
 * pelo storage cleanup ao apagar mensagens, defendendo contra
 * tentativa de unlink de paths externos via attachment forjado.
 */
export function chatImageFilenameFromUrl(url: string): string | null {
  const m = /^\/api\/chat\/images\/([^/?#]+)$/.exec(url);
  if (!m) return null;
  const fname = m[1];
  /* Re-valida com o mesmo regex de resolve, pra que delete via
   * filename extraído de URL externa não consiga escapar. */
  return resolveChatImagePath(fname) ? fname : null;
}
