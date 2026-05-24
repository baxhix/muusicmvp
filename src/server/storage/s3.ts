/**
 * Adapter S3 da interface `Storage` — **stub pronto pra preencher
 * quando a infra migrar pra AWS**.
 *
 * Por que existe agora (e não está ativado): a interface `Storage`
 * já foi desenhada compatível com object stores; deixar este
 * arquivo escrito significa que o dev backend que fizer a migração
 * AWS abre o arquivo, instala 1 dep, preenche 6 métodos e troca 1
 * env var — sem precisar fazer arquitetura nova, decidir interface,
 * ou tocar nos modules de feature.
 *
 * Checklist pra ativar (quando migrar):
 *
 *   1. `npm install @aws-sdk/client-s3 @aws-sdk/lib-storage`
 *      (`lib-storage` traz `Upload` que faz multipart automático
 *       pra arquivos > 5MB — necessário pra materiais grandes).
 *
 *   2. Preencher os `TODO:` abaixo. Cada método é 5–10 linhas
 *      de chamada ao SDK.
 *
 *   3. Adicionar ao `src/server/env.ts`:
 *        S3_BUCKET: z.string().min(1),
 *        S3_REGION: z.string().min(1),
 *        AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
 *        AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
 *      (Em ECS/EKS, deixar credenciais via IAM role da task —
 *       SDK pega automático. Em dev local, usar env vars.)
 *
 *   4. Setar `STORAGE_BACKEND=s3` em produção. Default segue
 *      sendo `filesystem` pra dev local + ambientes legados.
 *
 *   5. Mapear `bucket` lógico → S3 bucket real. Recomendação:
 *      1 bucket S3 só (ex: `muusic-prod-uploads`) com prefixos
 *      por bucket lógico (`feed/`, `avatars/`, etc.). Mais
 *      barato e mais simples que múltiplos buckets.
 *
 *   6. CloudFront na frente (opcional mas recomendado) — usar o
 *      `cacheControl` do `SaveOptions` na key, e configurar
 *      OAI/OAC pra que o bucket fique privado.
 *
 * Migração de dados: copy do Docker volume `/app/uploads` pro
 * bucket pode ser feita com `aws s3 sync /app/uploads s3://...
 * --include "feed/*" --exclude "*"` por bucket, sem downtime
 * (escritas continuam no FS até o cutover do env var).
 */

import type { Readable } from 'node:stream';
import type { SaveOptions, Storage } from './types';

/* TODO(aws-migration): descomentar quando o SDK estiver instalado.
 *
 * import {
 *   S3Client,
 *   GetObjectCommand,
 *   DeleteObjectCommand,
 *   HeadObjectCommand,
 * } from '@aws-sdk/client-s3';
 * import { Upload } from '@aws-sdk/lib-storage';
 */

export interface S3StorageConfig {
  /** Nome do bucket S3 (ex: 'muusic-prod-uploads'). */
  bucket: string;
  /** AWS region (ex: 'us-east-1', 'sa-east-1'). */
  region: string;
  /** Endpoint custom (R2, MinIO, etc.). Vazio = AWS default. */
  endpoint?: string;
  /** Prefixa todas as keys com isto. Útil pra compartilhar
   *  bucket entre envs (`STAGING/`, `PROD/`). Vazio = sem prefix. */
  keyPrefix?: string;
}

export class S3Storage implements Storage {
  // private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    /* TODO(aws-migration):
     * this.client = new S3Client({
     *   region: config.region,
     *   endpoint: config.endpoint,
     *   // forcePathStyle: true se for MinIO/R2 não-AWS
     * });
     */
    throw new Error(
      's3.ts: stub não implementado. Veja header do arquivo pra checklist de ativação.',
    );
  }

  /** Monta a S3 key combinando prefix opcional + bucket lógico + key. */
  private resolveKey(bucket: string, key: string): string {
    const prefix = this.config.keyPrefix ?? '';
    return `${prefix}${bucket}/${key}`;
  }

  async save(
    _bucket: string,
    _key: string,
    _bytes: Buffer | Uint8Array,
    _opts?: SaveOptions,
  ): Promise<void> {
    /* TODO(aws-migration):
     * await new Upload({
     *   client: this.client,
     *   params: {
     *     Bucket: this.config.bucket,
     *     Key: this.resolveKey(bucket, key),
     *     Body: bytes,
     *     ContentType: opts?.contentType,
     *     CacheControl: opts?.cacheControl,
     *   },
     * }).done();
     */
    throw new Error('s3.save: não implementado');
  }

  async read(_bucket: string, _key: string): Promise<Buffer | null> {
    /* TODO(aws-migration):
     * try {
     *   const r = await this.client.send(
     *     new GetObjectCommand({
     *       Bucket: this.config.bucket,
     *       Key: this.resolveKey(bucket, key),
     *     }),
     *   );
     *   const chunks: Buffer[] = [];
     *   for await (const c of r.Body as Readable) chunks.push(c as Buffer);
     *   return Buffer.concat(chunks);
     * } catch (err: any) {
     *   if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
     *     return null;
     *   }
     *   throw err;
     * }
     */
    throw new Error('s3.read: não implementado');
  }

  async readStream(_bucket: string, _key: string): Promise<Readable | null> {
    /* TODO(aws-migration):
     * try {
     *   const r = await this.client.send(
     *     new GetObjectCommand({
     *       Bucket: this.config.bucket,
     *       Key: this.resolveKey(bucket, key),
     *     }),
     *   );
     *   return r.Body as Readable;
     * } catch (err: any) {
     *   if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
     *     return null;
     *   }
     *   throw err;
     * }
     */
    throw new Error('s3.readStream: não implementado');
  }

  async delete(_bucket: string, _key: string): Promise<void> {
    /* TODO(aws-migration): idempotente — DeleteObjectCommand não
     *  falha se a key não existir.
     *
     * await this.client.send(
     *   new DeleteObjectCommand({
     *     Bucket: this.config.bucket,
     *     Key: this.resolveKey(bucket, key),
     *   }),
     * );
     */
    throw new Error('s3.delete: não implementado');
  }

  async exists(_bucket: string, _key: string): Promise<boolean> {
    /* TODO(aws-migration):
     * try {
     *   await this.client.send(
     *     new HeadObjectCommand({
     *       Bucket: this.config.bucket,
     *       Key: this.resolveKey(bucket, key),
     *     }),
     *   );
     *   return true;
     * } catch (err: any) {
     *   if (err.$metadata?.httpStatusCode === 404) return false;
     *   throw err;
     * }
     */
    throw new Error('s3.exists: não implementado');
  }

  async size(_bucket: string, _key: string): Promise<number | null> {
    /* TODO(aws-migration):
     * try {
     *   const r = await this.client.send(
     *     new HeadObjectCommand({
     *       Bucket: this.config.bucket,
     *       Key: this.resolveKey(bucket, key),
     *     }),
     *   );
     *   return r.ContentLength ?? null;
     * } catch (err: any) {
     *   if (err.$metadata?.httpStatusCode === 404) return null;
     *   throw err;
     * }
     */
    throw new Error('s3.size: não implementado');
  }
}
