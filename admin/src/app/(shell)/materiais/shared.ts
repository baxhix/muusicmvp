/** Helpers compartilhados pelos componentes de Materiais.
 *  Mora aqui (em vez de lib/format.ts) porque ainda não são
 *  reaproveitados pelo resto do admin. */

/* MIMEs aceitos pelo backend — mantemos uma cópia client-side
 * pra rejeitar arquivos inválidos ANTES do upload (UX melhor que
 * receber 415 do servidor depois de subir o arquivo todo). Deve
 * espelhar exatamente o FORMATO_BY_MIME em src/server/materiais/
 * storage.ts. */
const ACCEPTED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/svg+xml',
  'audio/mpeg', 'audio/mp3',
  'video/mp4',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — espelha storage.ts

/** Valida um arquivo client-side antes de tentar upload.
 *  Retorna mensagem de erro PT-BR ou null se válido. Espelha
 *  exatamente as regras do backend (storage.ts). */
export function validateFile(file: File): string | null {
  if (file.size === 0) return 'Arquivo vazio.';
  if (file.size > MAX_BYTES) {
    return `Arquivo grande demais (${formatBytes(file.size)}). Limite: 50 MB.`;
  }
  if (!ACCEPTED_MIMES.has(file.type)) {
    return `Formato não suportado (${file.type || 'desconhecido'}).`;
  }
  return null;
}

/** Formata bytes pra string humana (B / KB / MB / GB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}
