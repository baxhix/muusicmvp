/**
 * Bus simples (CustomEvent no window) pra abrir o LegalDrawer de
 * QUALQUER lugar sem precisar de context/prop-drilling. O
 * `<LegalDrawer />` é montado UMA vez no root layout e escuta o
 * evento; os links (`<LegalLink />` ou onClick direto) só
 * disparam `openLegalDrawer(kind)`.
 *
 * Surfaces: 'site' (público — auth, landing, footers), 'app'
 * (dentro do /app, que já tem o LegalDocumentModal próprio) e
 * 'platform'. Default 'site' porque é o consumidor público.
 */

export type LegalKind = 'terms_of_use' | 'privacy_policy';
export type LegalSurface = 'app' | 'site' | 'platform';

export const LEGAL_DRAWER_EVENT = 'fanverse:open-legal';

export interface OpenLegalDetail {
  kind: LegalKind;
  surface: LegalSurface;
}

export function openLegalDrawer(
  kind: LegalKind,
  surface: LegalSurface = 'site',
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenLegalDetail>(LEGAL_DRAWER_EVENT, {
      detail: { kind, surface },
    }),
  );
}
