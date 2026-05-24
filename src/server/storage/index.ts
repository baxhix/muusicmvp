/**
 * Storage factory — ponto único de troca de backend de binários.
 *
 * Escolha do backend via env `STORAGE_BACKEND`:
 *   - `filesystem` (default): grava em `/app/uploads` (Docker volume).
 *   - `s3`: usa AWS S3 (ou R2/MinIO via endpoint custom). Stub em
 *     `./s3.ts` esperando o dev backend preencher na migração AWS.
 *
 * Os 5 modules de feature (`feed`, `avatars`, `materiais`, `reports`,
 * `groups`) usam só a interface `Storage` — trocar o backend NÃO
 * exige tocar em nenhum deles.
 *
 * Padrão singleton via global — Next.js HMR cria múltiplos module
 * instances em dev, e queremos uma única instância da Storage class
 * por processo (caches de conexão S3 ou file handles).
 */

import { FilesystemStorage } from './filesystem';
import { S3Storage, type S3StorageConfig } from './s3';
import type { Storage } from './types';

declare global {

  var __storage: Storage | undefined;
}

/** Root directory pro filesystem storage. Mesmo path usado pelos
 *  modules atuais (env vars FEED_DIR, AVATARS_DIR, etc. apontam
 *  todos pra subdirs deste root). */
const UPLOADS_ROOT = process.env.UPLOADS_ROOT ?? '/app/uploads';

/** Backend selecionado em runtime. Validamos cedo pra falhar
 *  rápido se vier valor inválido. */
function selectedBackend(): 'filesystem' | 's3' {
  const raw = (process.env.STORAGE_BACKEND ?? 'filesystem').toLowerCase();
  if (raw === 'filesystem' || raw === 's3') return raw;
  throw new Error(
    `STORAGE_BACKEND inválido: ${raw}. Esperado 'filesystem' ou 's3'.`,
  );
}

function buildS3Config(): S3StorageConfig {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket || !region) {
    throw new Error(
      'STORAGE_BACKEND=s3 mas S3_BUCKET/S3_REGION não estão setados.',
    );
  }
  return {
    bucket,
    region,
    endpoint: process.env.S3_ENDPOINT,
    keyPrefix: process.env.S3_KEY_PREFIX,
  };
}

export function getStorage(): Storage {
  if (!global.__storage) {
    const backend = selectedBackend();
    global.__storage =
      backend === 's3'
        ? new S3Storage(buildS3Config())
        : new FilesystemStorage(UPLOADS_ROOT);
  }
  return global.__storage;
}

export type { Storage, SaveOptions } from './types';
