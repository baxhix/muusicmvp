/**
 * Interface genérica de storage de binários — usada pelos módulos
 * de feature (`feed`, `avatars`, `materiais`, `reports`, `groups`)
 * pra escrever/ler/apagar arquivos sem se acoplar a uma
 * infraestrutura específica.
 *
 * Hoje: 1 implementação (`FilesystemStorage` em `./filesystem.ts`)
 * que usa o disco local do container Docker.
 *
 * Amanhã: quando migrarmos pra S3/R2/Backblaze, criamos
 * `S3Storage` que implementa a MESMA interface, trocamos a
 * factory em `./index.ts` e nenhum módulo de feature precisa
 * mexer. As assinaturas abaixo já foram escolhidas pra serem
 * compatíveis com APIs de object stores (sem `path` cru).
 *
 * Convenções:
 *   - `bucket` é um namespace lógico (ex: 'feed', 'avatars',
 *     'materiais'). No filesystem mapeia pra subdiretório;
 *     em S3 mapeia pra prefixo de key ou bucket diferente.
 *   - `key` é o caminho/nome ÚNICO dentro do bucket. Não inclui
 *     barra inicial.
 *   - Conteúdos são `Buffer | Uint8Array | ReadableStream` na
 *     escrita; sempre `Buffer` na leitura (caller decide se quer
 *     streamar).
 */

import type { Readable } from 'node:stream';

export interface SaveOptions {
  /** MIME do conteúdo. Filesystem ignora; S3 grava como metadata. */
  contentType?: string;
  /** Cache-Control sugerido pra quando o storage tiver CDN nativo
   *  (S3 + CloudFront, R2, etc.). No filesystem fica no metadata
   *  só informativo. */
  cacheControl?: string;
}

export interface Storage {
  /** Persiste `bytes` em `bucket/key`. Sobrescreve se já existir. */
  save(
    bucket: string,
    key: string,
    bytes: Buffer | Uint8Array,
    opts?: SaveOptions,
  ): Promise<void>;

  /** Lê o conteúdo inteiro pra memória. Use só pra binários
   *  pequenos (avatars, thumbs). Pra arquivos grandes, prefira
   *  `readStream`. */
  read(bucket: string, key: string): Promise<Buffer | null>;

  /** Stream de leitura — pra servir arquivos grandes (vídeo, zip)
   *  sem carregar tudo na RAM. Retorna null se não existir. */
  readStream(bucket: string, key: string): Promise<Readable | null>;

  /** Apaga uma key. Idempotente: não-existente também resolve OK. */
  delete(bucket: string, key: string): Promise<void>;

  /** Verifica existência sem ler o conteúdo. Mais barato que
   *  `read` pra checks (ex: rota 404 antes de tentar servir). */
  exists(bucket: string, key: string): Promise<boolean>;

  /** Tamanho em bytes — usado pra `Content-Length` headers e
   *  validação. Retorna null se não existir. */
  size(bucket: string, key: string): Promise<number | null>;
}
