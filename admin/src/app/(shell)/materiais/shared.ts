/** Helpers compartilhados pelos componentes de Materiais.
 *  Mora aqui (em vez de lib/format.ts) porque ainda não são
 *  reaproveitados pelo resto do admin — quando forem, promove. */

import type { MaterialNode } from '@/data/mock/materiais';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

/** Gera um ID único pra um novo nó. Usa crypto.randomUUID quando
 *  disponível; fallback no Date.now+random pra ambientes que
 *  não exponham (legado / SSR). */
export function generateId(prefix: 'folder' | 'file'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix === 'folder' ? 'fld' : 'fil'}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix === 'folder' ? 'fld' : 'fil'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** localStorage key — versionado pra que se o shape mudar a gente
 *  possa bump e ignorar dados velhos sem crashar. */
export const MATERIAIS_LS_KEY = 'materiais:tree:v1';

/** Carrega árvore persistida no localStorage. Retorna null se
 *  não houver, se estiver corrompida, ou se rodando no servidor. */
export function loadFromStorage(): MaterialNode[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MATERIAIS_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as MaterialNode[];
  } catch {
    return null;
  }
}

/** Salva a árvore. Falhas (quota cheia / modo privado) são
 *  silenciosas — UI mantém o estado in-memory. */
export function saveToStorage(nodes: MaterialNode[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MATERIAIS_LS_KEY, JSON.stringify(nodes));
  } catch {
    /* quota / modo privado — silencioso */
  }
}

/** Limpa o storage — usado pelo botão "Restaurar acervo". */
export function clearStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MATERIAIS_LS_KEY);
  } catch {
    /* idem */
  }
}

/** Coleta o id da pasta + todos os descendentes (recursivo).
 *  Usado pelo handler de excluir pasta (delete cascateado). */
export function collectDescendantIds(
  nodes: MaterialNode[],
  folderId: string,
): Set<string> {
  const ids = new Set<string>([folderId]);
  const stack: string[] = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of nodes) {
      if (n.parentId === id) {
        ids.add(n.id);
        if (n.type === 'folder') stack.push(n.id);
      }
    }
  }
  return ids;
}
