/**
 * Implementação filesystem da interface `Storage`. Cada bucket
 * mapeia pra um subdiretório dentro de `rootDir` (que é o Docker
 * volume `/app/uploads`).
 *
 * Este arquivo NÃO substitui as `src/server/X/storage.ts` ainda —
 * elas continuam usando `fs.promises` direto com seus paths
 * próprios. Esta abstração existe pra que migrações futuras possam
 * trocar `FilesystemStorage` por `S3Storage` em UM ponto (a factory
 * em `./index.ts`) sem alterar as 5 storage modules de feature.
 *
 * Para migrar um módulo: trocar `fs.writeFile(path.join(DIR, name),
 * buf)` por `getStorage().save(bucket, name, buf)`. Padrão de PR
 * incremental: 1 módulo por vez (feed → avatars → ...).
 */

import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { SaveOptions, Storage } from './types';

export class FilesystemStorage implements Storage {
  constructor(private readonly rootDir: string) {}

  private resolveBucketDir(bucket: string): string {
    /* Bucket name é input controlado pelo dev (ex: 'feed'), não
     * por usuário — mas defense-in-depth: rejeitamos path traversal. */
    if (!/^[a-z0-9-_]+$/i.test(bucket)) {
      throw new Error(`invalid bucket name: ${bucket}`);
    }
    return path.join(this.rootDir, bucket);
  }

  private resolveKey(bucket: string, key: string): string {
    /* Filenames são gerados internamente pelos modules (uuid +
     * random + ext). Mesma defesa via regex no resolveX dos
     * módulos atuais — duplicar aqui pra segurança em camadas. */
    if (key.includes('/') || key.includes('\\') || key.startsWith('.')) {
      throw new Error(`invalid key: ${key}`);
    }
    return path.join(this.resolveBucketDir(bucket), key);
  }

  async save(
    bucket: string,
    key: string,
    bytes: Buffer | Uint8Array,
    _opts?: SaveOptions,
  ): Promise<void> {
    const dir = this.resolveBucketDir(bucket);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.resolveKey(bucket, key), bytes);
  }

  async read(bucket: string, key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveKey(bucket, key));
    } catch {
      return null;
    }
  }

  async readStream(bucket: string, key: string): Promise<Readable | null> {
    const file = this.resolveKey(bucket, key);
    try {
      /* statSync via fs.stat pra confirmar existência ANTES de
       * abrir o stream — evita criar listener com erro async
       * difícil de tratar pelo caller. */
      await fs.stat(file);
    } catch {
      return null;
    }
    return createReadStream(file);
  }

  async delete(bucket: string, key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(bucket, key));
    } catch {
      /* idempotente: não-existente é sucesso */
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(bucket, key));
      return true;
    } catch {
      return false;
    }
  }

  async size(bucket: string, key: string): Promise<number | null> {
    try {
      const s = await fs.stat(this.resolveKey(bucket, key));
      return s.size;
    } catch {
      return null;
    }
  }
}
