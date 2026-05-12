/**
 * Catálogo de universos (Fanverses) — versões exclusivas da plataforma
 * por artista. Por enquanto todos os ambientes são idênticos em
 * funcionalidade; o universo escolhido afeta apenas o logo da SideBar
 * e, num próximo ciclo, cor de acento, conteúdo curado, etc.
 *
 * Quando o backend ganhar uma tabela `universes`, este arquivo vira o
 * fallback estático (mesmo padrão do TRACKS_CATALOG vs /api/tracks).
 */

export interface UniverseConfig {
  /** Slug usado em localStorage + futuras URLs por universo. */
  id: string;
  /** Nome exibido — vai no card de seleção e no header. */
  name: string;
  /** Genre/category tag — futuro uso interno (filtros, agrupamento). */
  tag: string;
  /** Frase curta vendendo o universo. */
  description: string;
  /** Hex usado como cor de acento (gradiente, badges, ringer). */
  accentColor: string;
  /** Asset path da capa usada no card de seleção. */
  coverUrl: string;
  /** Asset path do logo que substitui o ícone muusic na SideBar. */
  logoUrl: string;
  /**
   * Opcional: rótulo de uma segunda ação no card de seleção, mostrada
   * abaixo do CTA principal. Universos sem esse campo só mostram
   * "Entrar". Hoje usado pra "Entrar sem ser superfã" no Countrybeat.
   */
  secondaryCtaLabel?: string;
}

export const UNIVERSES: Record<string, UniverseConfig> = {
  'ana-castela': {
    id: 'ana-castela',
    name: 'Ana Castela',
    tag: 'Sertanejo',
    description: 'O Fanverse da Boiadeira — superfãs, shows e descobertas em um só lugar.',
    accentColor: '#D97706',
    coverUrl: '/universes/ana-castela/cover.png',
    logoUrl: '/universes/ana-castela/logo.svg',
  },
  countrybeat: {
    id: 'countrybeat',
    name: 'Countrybeat',
    tag: 'Country',
    description: 'O coletivo Countrybeat encontra sua tribo aqui.',
    accentColor: '#0F766E',
    coverUrl: '/universes/countrybeat/cover.png',
    logoUrl: '/universes/countrybeat/logo.svg',
    secondaryCtaLabel: 'Entrar sem ser superfã',
  },
};

export type UniverseId = keyof typeof UNIVERSES;

export function getUniverse(id: string | null | undefined): UniverseConfig | null {
  if (!id) return null;
  return UNIVERSES[id] ?? null;
}
