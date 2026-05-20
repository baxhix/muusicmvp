/**
 * Ana Castela — discografia organizada por álbum.
 *
 * Cada álbum aponta para faixas que JÁ existem no TRACKS_CATALOG
 * (resolvidas por youtubeId). Quando o tracklist original do álbum
 * contém faixas que não estão no catálogo, elas foram filtradas —
 * decisão do produto: "só listar os do catálogo". Para incluir as
 * faixas faltantes basta adicioná-las em `src/data/tracksCatalog.ts`
 * (mesmo youtubeId) e referenciá-las aqui.
 *
 * A ordem do `trackYoutubeIds` reflete a sequência do álbum.
 */

export type AnaAlbum = {
  id: string;
  name: string;
  /** Caminho relativo a /public (servido em runtime no mesmo path). */
  cover: string;
  trackYoutubeIds: string[];
};

export const ANA_ALBUMS: AnaAlbum[] = [
  {
    id: 'lets-go-rodeo',
    name: "Let's Go Rodeo",
    cover: '/albuns/lets-go-rodeo.jpg',
    trackYoutubeIds: [
      'h_aRZwzjYxs', // Olha Onde Eu Tô
      'R_BeWWDLAsg', // Tropa do Chapelão
      'EV0rV4haNFs', // Rodeio No Texas
    ],
  },
  {
    id: 'boiadeira-internacional',
    name: 'Boiadeira Internacional',
    cover: '/albuns/boiadeira-internacional.jpg',
    trackYoutubeIds: [
      'DyQ3McP4Two', // Boiadeira
      'r9GrcxTGNWg', // Nosso Quadro
      'f58W_FVXBLg', // Solteiro Forçado
      'EEC0ZX0QO4g', // Fronteira
      '2OutJUdvwGY', // Lua
      '69JAoslGYI8', // Pipoco
      'VaoBgB8gPXU', // Tô Voltando
    ],
  },
  {
    id: 'heranca-boiadeira',
    name: 'Herança Boiadeira',
    cover: '/albuns/heranca-boiadeira.jpg',
    trackYoutubeIds: [
      'CnY6xryxYDw', // Hoje Eu Lembrei de Você
    ],
  },
  {
    id: 'heranca-boiadeira-ao-vivo',
    name: 'Herança Boiadeira Ao Vivo',
    cover: '/albuns/heranca-boiadeira-ao-vivo.jpg',
    trackYoutubeIds: [],
  },
];
