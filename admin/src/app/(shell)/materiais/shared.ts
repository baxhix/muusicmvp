/** Format helpers compartilhados pelos componentes de Materiais.
 *  Mora aqui (em vez de lib/format.ts) porque formatBytes ainda
 *  não é usado em outro lugar do admin — quando for, promove. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}
