/**
 * ────────────────────────────────────────────────────────────────────
 *  Redação de PII de usuário — ponto único de política (LGPD).
 * ────────────────────────────────────────────────────────────────────
 *
 * Regras (ver Item 9 — Localização + LGPD):
 *
 *   • EMAIL nunca é exposto pra OUTROS usuários. As queries cross-user
 *     simplesmente pararam de selecionar `users.email`; só os caminhos
 *     "self" (/api/auth/me, profile próprio) e os endpoints admin
 *     retornam email. Não há helper de email aqui de propósito — o
 *     email some na origem (SELECT), não em runtime.
 *
 *   • LOCALIZAÇÃO aproximada (city/country/countryCode/lat/lng) só vai
 *     pra outros usuários quando o dono da row consentiu
 *     (`users.location_consent = true`). As queries que retornam esses
 *     campos passam a SELECT `location_consent` e funilam o resultado
 *     por `redactLocation()`, que zera os campos quando o consentimento
 *     é false. Self-views e admin NÃO passam por aqui — veem a row
 *     completa.
 *
 * Centralizar a política num único helper mantém o critério de redação
 * consistente entre os ~4 formatos que carregam localização (online
 * users, ranking, superchat participants, profile).
 */

/**
 * Nome público de um usuário, com proteção a menores.
 *
 * Requisito (proteção a menores): "oculte Sobrenome completo". Quando a
 * row pertence a um MENOR de idade e está sendo exibida pra OUTRA pessoa,
 * só o primeiro nome aparece — nunca o nome completo. Pra adultos (ou
 * self-view) o nome volta intacto.
 *
 * Mantém o mesmo critério em todos os formatos cross-user que carregam
 * `name` (profile, ranking, comentários, etc.), igual ao redactLocation.
 */
export function publicFirstName(
  name: string | null | undefined,
  isMinor: boolean,
): string | null {
  if (!name) return name ?? null;
  if (!isMinor) return name;
  // Primeiro token não-vazio (lida com espaços extras).
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

/** Subconjunto de localização que pode aparecer num formato público de
 *  usuário. Cada formato carrega só um subconjunto destes campos. */
export interface RedactableLocation {
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Zera os campos de localização presentes em `loc` quando o dono da row
 * NÃO consentiu. Preserva o shape (só mexe nas chaves que existem), então
 * serve tanto pro formato completo (online users: city+country+lat+lng)
 * quanto pros parciais (ranking/superchat: só city/country).
 */
export function redactLocation<T extends RedactableLocation>(
  loc: T,
  consent: boolean,
): T {
  if (consent) return loc;
  const out = { ...loc } as RedactableLocation;
  if ('city' in out) out.city = null;
  if ('country' in out) out.country = null;
  if ('countryCode' in out) out.countryCode = null;
  if ('lat' in out) out.lat = null;
  if ('lng' in out) out.lng = null;
  return out as T;
}
