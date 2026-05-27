import { api } from './api';

/**
 * Legal documents — Termos de Uso + Política de Privacidade.
 *
 * Diferente de outros recursos do admin, NÃO é uma lista
 * dinâmica — sempre são exatamente 2 rows (uma por `kind`)
 * seeded na migration 0043. O admin edita e publica.
 *
 * `publishedAt` null = nunca publicado (rascunho-only). Após o
 * primeiro publish, o site público (/termos ou /privacidade)
 * passa a renderizar o conteúdo.
 */

export type LegalDocumentKind = 'terms_of_use' | 'privacy_policy';

export interface LegalDocument {
  kind: LegalDocumentKind;
  title: string;
  body: string;
  version: number;
  /** ISO timestamp da última publicação; null = nunca publicado. */
  publishedAt: string | null;
  updatedAt: string;
}

export interface SaveLegalInput {
  body: string;
  title?: string;
}

export const legalService = {
  list: () =>
    api.get<{ items: LegalDocument[] }>('/api/admin/legal'),

  get: (kind: LegalDocumentKind) =>
    api.get<{ document: LegalDocument }>(`/api/admin/legal/${kind}`),

  /** Salva (rascunho) — não altera o site público. */
  save: (kind: LegalDocumentKind, input: SaveLegalInput) =>
    api.patch<{ document: LegalDocument }>(`/api/admin/legal/${kind}`, input),

  /** Publica — bumpa version + grava publishedAt; site público pega. */
  publish: (kind: LegalDocumentKind, input: SaveLegalInput) =>
    api.post<{ document: LegalDocument }>(
      `/api/admin/legal/${kind}/publish`,
      input,
    ),
};

export const LEGAL_LABELS: Record<LegalDocumentKind, string> = {
  terms_of_use: 'Termos de Uso',
  privacy_policy: 'Política de Privacidade',
};
