import { api } from './api';

/**
 * Legal documents — Termos de Uso + Política de Privacidade,
 * por surface (site público, app, plataforma web).
 *
 * Cada combinação `(kind, surface)` é uma row independente da
 * tabela. Total: 6 rows fixas seeded nas migrations 0043 + 0044
 * — admin edita e publica cada uma individualmente.
 *
 * `publishedAt` null = nunca publicado (rascunho only). Após
 * publish o consumer daquela surface (página /termos pra site;
 * modal in-app pra app; etc) passa a renderizar o conteúdo novo.
 */

export type LegalDocumentKind = 'terms_of_use' | 'privacy_policy';
export type LegalDocumentSurface = 'site' | 'app' | 'platform';

export interface LegalDocument {
  kind: LegalDocumentKind;
  surface: LegalDocumentSurface;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface SaveLegalInput {
  body: string;
  title?: string;
}

export const legalService = {
  list: () => api.get<{ items: LegalDocument[] }>('/api/admin/legal'),

  get: (surface: LegalDocumentSurface, kind: LegalDocumentKind) =>
    api.get<{ document: LegalDocument }>(`/api/admin/legal/${surface}/${kind}`),

  /** Salva (rascunho) — não altera o consumer daquela surface. */
  save: (
    surface: LegalDocumentSurface,
    kind: LegalDocumentKind,
    input: SaveLegalInput,
  ) =>
    api.patch<{ document: LegalDocument }>(
      `/api/admin/legal/${surface}/${kind}`,
      input,
    ),

  /** Publica — bumpa version + grava publishedAt; consumer pega. */
  publish: (
    surface: LegalDocumentSurface,
    kind: LegalDocumentKind,
    input: SaveLegalInput,
  ) =>
    api.post<{ document: LegalDocument }>(
      `/api/admin/legal/${surface}/${kind}/publish`,
      input,
    ),
};

export const LEGAL_KIND_LABELS: Record<LegalDocumentKind, string> = {
  terms_of_use: 'Termos de Uso',
  privacy_policy: 'Política de Privacidade',
};

export const LEGAL_SURFACE_LABELS: Record<LegalDocumentSurface, string> = {
  site: 'Site',
  app: 'App',
  platform: 'Plataforma web',
};

export const LEGAL_SURFACE_DESCRIPTIONS: Record<LegalDocumentSurface, string> =
  {
    site: 'Visitantes do site público (linkado em /termos e /privacidade).',
    app: 'Usuários dentro do app (modal in-app no drawer do TopBar).',
    platform: 'Artistas e criadores na plataforma web.',
  };

export const LEGAL_SURFACES_ORDER: readonly LegalDocumentSurface[] = [
  'site',
  'app',
  'platform',
];

export const LEGAL_KINDS_ORDER: readonly LegalDocumentKind[] = [
  'terms_of_use',
  'privacy_policy',
];
