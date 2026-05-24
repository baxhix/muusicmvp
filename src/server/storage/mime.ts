/**
 * MIME mapping central — fonte única de extensão → Content-Type pra
 * TODOS os módulos de storage do backend (feed, avatars, materiais,
 * reports, groups). Antes cada storage.ts tinha sua própria função
 * `contentTypeOf` — 5 cópias quase idênticas que iam divergindo.
 *
 * Inclui todos os MIMEs aceitos pelos uploaders + alguns extras
 * comuns (jpeg, ogv, mov) pra robustez. Modules ainda podem
 * restringir o que aceitam no momento da escrita; ler/servir
 * tolera o conjunto inteiro.
 *
 * Adicionar novo formato: incluir aqui + nos validators de upload
 * do módulo que vai aceitar.
 */

const MIME_BY_EXT: Record<string, string> = {
  // Imagens
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
  svg:  'image/svg+xml',

  // Áudio
  mp3:  'audio/mpeg',
  m4a:  'audio/mp4',
  wav:  'audio/wav',
  ogg:  'audio/ogg',

  // Vídeo
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  ogv:  'video/ogg',

  // Documentos / pacotes
  pdf:  'application/pdf',
  zip:  'application/zip',
};

/**
 * Retorna o Content-Type baseado na extensão do filename. Default
 * `application/octet-stream` (o browser baixa em vez de tentar
 * renderizar — comportamento seguro pra binários desconhecidos).
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}
