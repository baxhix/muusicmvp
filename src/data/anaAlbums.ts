/**
 * Ana Castela — discografia organizada por álbum.
 *
 * Cada `trackYoutubeIds` referencia o `youtubeId` de uma faixa no
 * TRACKS_CATALOG. A ordem reflete a sequência oficial do álbum.
 *
 * Quando uma faixa do álbum também existe como single no catálogo
 * com um youtubeId diferente (ex.: "Pipoco" como single
 * `69JAoslGYI8` vs. faixa do álbum `lwymfxisOwE`), referenciamos
 * o id do single — a aba "Recentes" e a aba "Álbuns" compartilham
 * a mesma entrada de track no player. Faixas exclusivas do álbum
 * (que não saíram como single) foram adicionadas ao catálogo com
 * `album:` setado e seu id próprio.
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
      'q2LXSctGna8', // Se Amando nas BR
      'EV0rV4haNFs', // Rodeio No Texas
      '7F22m0yeFs8', // Não Precisa Ser Cowboy
      'z3K6SwjF0-8', // Pra Quem Você Ligou
      '8b_lAykNrnw', // As Cowgirl
      'R5Nb5oW0mYw', // Saudade é Saudade
      'Wwe9tNZwYAI', // Tô Voltando (Classic)
    ],
  },
  {
    id: 'boiadeira-internacional',
    name: 'Boiadeira Internacional',
    cover: '/albuns/boiadeira-internacional.jpg',
    trackYoutubeIds: [
      'DyQ3McP4Two', // Boiadeira
      'N4ocWKVr3QA', // Bonde das Boiadeiras
      'IgG1ekanyFQ', // Alerta de Golpe
      'xg-t6VWnx3s', // As Menina da Pecuária
      'rjdpvfbFvQ8', // Coração Bipolar
      'xk_RO-5KLWQ', // Só Não Deixa Saudade
      'ypiw-p0XaJU', // Não Vai Ver Nunca
      'KNZXJgji1Ww', // Morreu de Ana Castela
      'r9GrcxTGNWg', // Nosso Quadro
      'f58W_FVXBLg', // Solteiro Forçado
      'EEC0ZX0QO4g', // Fronteira
      'kBM-2GHnpq0', // Chicletinho
      'yi3U79UzahQ', // Pra Sempre Sem Ser
      'qlOV6Zo4DYs', // Quem Prova Pede Mais
      '2OutJUdvwGY', // Lua
      'FaU-qocV7uA', // Aqui Tem Alguém
      '5rnGyuLldBM', // Amizade ou o Quê
      '69JAoslGYI8', // Pipoco
      'VaoBgB8gPXU', // Tô Voltando
    ],
  },
  {
    id: 'heranca-boiadeira',
    name: 'Herança Boiadeira',
    cover: '/albuns/heranca-boiadeira.jpg',
    trackYoutubeIds: [
      'aPqYwUPyZN0', // Você Vai Ver
      '4OK23Y-4xsE', // Franguinho na Panela
      'CnY6xryxYDw', // Hoje Eu Lembrei de Você
      'HxsxGqM3Sc0', // Rédeas do Possante
      'Jpv9iR09sjc', // Mamãe, Não Deixe Seu Filho Ser um Cowboy
      'OZSpfBEdz8k', // Vá com Deus
      'Kw6X7Z1Qy4k', // Romaria
      'dNixkzO0jgI', // Saudade é Mato
      'cZHlSHFeq7E', // Se a Casa Cair
      'jGbldS066tA', // Barulho da Camioneta
    ],
  },
  {
    id: 'heranca-boiadeira-ao-vivo',
    name: 'Herança Boiadeira Ao Vivo',
    cover: '/albuns/heranca-boiadeira-ao-vivo.jpg',
    trackYoutubeIds: [
      'OrIlirfhorI', // Minha Herança
      'ZfQKpsgi53g', // Mercedita
      'yY7teFcNtvE', // Cachaceiro
      '83LaVN6K-Sw', // As Andorinhas
      'c_8naHLUO7U', // Tentei Te Esquecer
      'egyW5fY5yx8', // Menino do Laço Comprido
      'nnLWf2Rbeyw', // Veterinário
      'ZHmRvN1XJq0', // Pássaro de Fogo
      '0b37dw0zHhk', // Vitrola Véia
      'xrfrUNmgKi8', // Convite de Casamento
      'fyTCY6f9NIs', // Apaixonado por Você
      'Sphh4jO0bjw', // Mississipi
      'MEvt6OPB_3E', // Peão Apaixonado
    ],
  },
];
