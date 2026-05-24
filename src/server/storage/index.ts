/**
 * Storage factory — ponto único de troca de backend de binários.
 *
 * Hoje retorna `FilesystemStorage` apontando pro Docker volume
 * `/app/uploads`. Quando migrarmos pra S3/R2, esta factory muda
 * pra retornar `S3Storage(env.S3_BUCKET, env.S3_REGION, ...)` e
 * os 5 modules de feature (que já usam a interface `Storage`)
 * não mudam uma linha.
 *
 * Padrão singleton via global — Next.js HMR cria múltiplos module
 * instances em dev, e queremos uma única instância da Storage class
 * por processo (caches de conexão S3 ou file handles).
 */

import { FilesystemStorage } from './filesystem';
import type { Storage } from './types';

declare global {

  var __storage: Storage | undefined;
}

/** Root directory pro filesystem storage. Mesmo path usado pelos
 *  modules atuais (env vars FEED_DIR, AVATARS_DIR, etc. apontam
 *  todos pra subdirs deste root). */
const UPLOADS_ROOT =
  process.env.UPLOADS_ROOT ?? '/app/uploads';

export function getStorage(): Storage {
  if (!global.__storage) {
    global.__storage = new FilesystemStorage(UPLOADS_ROOT);
  }
  return global.__storage;
}

export type { Storage, SaveOptions } from './types';
