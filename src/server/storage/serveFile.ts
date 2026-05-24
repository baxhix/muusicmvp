/**
 * Helper único de file serving — streaming + ETag + Range.
 *
 * Antes cada route (`/api/feed/images/[filename]`, `/avatars/...`,
 * `/materiais/files/...`, etc.) lia o arquivo inteiro pra RAM via
 * `fs.readFile(buf)` e devolvia. Funcionava, mas:
 *
 *   1. RAM: 50MB upload = 50MB no heap por request enquanto serve
 *   2. Concorrência: 50 users baixando o mesmo álbum exclusivo
 *      = 50 × tamanho do álbum no heap, bloqueando event loop no
 *      `readFile`
 *   3. Sem conditional GET: cliente sempre baixa de novo, mesmo
 *      com Cache-Control immutable (porque o `immutable` não
 *      ajuda quando o cliente bypassa cache, ex: Ctrl+Shift+R)
 *
 * Agora:
 *   - `fs.createReadStream` → streama em chunks, RAM constante (~64KB)
 *   - ETag fraco baseado em (mtime + size) → conditional GET barato
 *   - Suporte a HTTP Range pra vídeo seek (parser simples bytes=N-M)
 *   - `Cache-Control: immutable` mantido (filenames têm hash random,
 *     então conteúdo nunca muda pra uma mesma URL)
 *
 * Uso típico em route handler:
 *
 *   export async function GET(_req, ctx) {
 *     const { filename } = await ctx.params;
 *     const p = resolveFeedImagePath(filename);
 *     return serveFile(_req, p, filename);
 *   }
 */

import { promises as fs, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { getContentType } from './mime';

interface ServeFileOptions {
  /** Override do Content-Type. Default: deduzido da extensão. */
  contentType?: string;
  /** Cache-Control header. Default: `public, max-age=31536000, immutable`
   *  (filenames são imutáveis no nosso modelo de storage). */
  cacheControl?: string;
  /** Forçar download em vez de inline. Adiciona Content-Disposition. */
  downloadAs?: string;
}

/**
 * Serve um arquivo do disco como Response do Next.js. Cuida de:
 *   - 404 quando arquivo não existe ou path é inválido (null)
 *   - 304 quando ETag do cliente bate (If-None-Match)
 *   - 206 + Range quando o cliente pede um pedaço (vídeo seek)
 *   - 200 com stream caso contrário
 */
export async function serveFile(
  req: Request,
  filePath: string | null,
  displayName: string,
  opts: ServeFileOptions = {},
): Promise<Response> {
  if (!filePath) {
    return new NextResponse('not found', { status: 404 });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  /* ETag fraco — (mtime ms + size). Suficiente pra detectar
   * mudança; barato de calcular. Weak (`W/`) porque não é hash
   * cripto do conteúdo. */
  const etag = `W/"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const contentType = opts.contentType ?? getContentType(displayName);
  const cacheControl =
    opts.cacheControl ?? 'public, max-age=31536000, immutable';

  /* Range request — usado por <video> e <audio> pra seek. Parser
   * mínimo: aceita só `bytes=N-M` ou `bytes=N-` (sufix range não
   * é necessário pros nossos use cases). */
  const range = req.headers.get('range');
  if (range && range.startsWith('bytes=')) {
    const [startStr, endStr] = range.slice(6).split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    if (
      !Number.isNaN(start) &&
      !Number.isNaN(end) &&
      start <= end &&
      end < stat.size
    ) {
      const chunkLength = end - start + 1;
      const nodeStream = createReadStream(filePath, { start, end });
      return new Response(
        Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkLength),
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': cacheControl,
            ETag: etag,
            ...(opts.downloadAs && {
              'Content-Disposition': `attachment; filename="${opts.downloadAs}"`,
            }),
          },
        },
      );
    }
    /* Range malformado: cai pro 200 normal — comportamento RFC. */
  }

  /* Resposta 200 padrão com stream. */
  const nodeStream = createReadStream(filePath);
  return new Response(
    Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
    {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': cacheControl,
        'Accept-Ranges': 'bytes',
        ETag: etag,
        ...(opts.downloadAs && {
          'Content-Disposition': `attachment; filename="${opts.downloadAs}"`,
        }),
      },
    },
  );
}
