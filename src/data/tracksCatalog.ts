/**
 * Canonical track catalog. Mirror of what's seeded into the `tracks` table.
 * Imported by both the player (NowPlaying.tsx) and the DB seed script
 * (src/server/db/seed.ts) so the two never drift.
 */
export type CatalogTrack = {
  title: string;
  artist: string;
  album?: string;
  year: number;
  youtubeId: string;
};

export const TRACKS_CATALOG: CatalogTrack[] = [
  { title: 'Pipoco',                   artist: 'Ana Castela, Melody & DJ Chris no Beat',           year: 2022, youtubeId: '69JAoslGYI8' },
  { title: 'Boiadeira',                artist: 'Ana Castela',                                      year: 2021, youtubeId: 'DyQ3McP4Two' },
  { title: 'Boiadeira (Funk Remix)',   artist: 'DJ Lucas Beat & Ana Castela',                      year: 2021, youtubeId: 'FE-JYKflvJI' },
  { title: 'Neon',                     artist: 'Ana Castela',                                      year: 2021, youtubeId: 'wqh8Z59rMI4' },
  { title: 'Nosso Quadro',             artist: 'Ana Castela',                                      year: 2023, youtubeId: 'r9GrcxTGNWg' },
  { title: 'Solteiro Forçado',         artist: 'Ana Castela',                                      year: 2023, youtubeId: 'f58W_FVXBLg' },
  { title: 'Bombonzinho',              artist: 'Israel & Rodolffo, Ana Castela',                   year: 2022, youtubeId: '_F6v6_Xgj_E' },
  { title: 'Lua',                      artist: 'Ana Castela, Alok & Hungria Hip Hop',              year: 2024, youtubeId: '2OutJUdvwGY' },
  { title: 'Fronteira',                artist: 'Ana Castela & Gustavo Mioto',                      year: 2023, youtubeId: 'EEC0ZX0QO4g' },
  { title: 'Dia de Fluxo',             artist: 'AgroPlay, Ana Castela & Ludmilla',                 year: 2023, youtubeId: 'iEb5u_YcAzY' },
  { title: 'Deja Vu',                  artist: 'Luan Santana & Ana Castela',                       year: 2023, youtubeId: 'wvwxUYbPmIk' },
  { title: 'Carinha de Bebê',          artist: 'Ana Castela & Pedro Sampaio',                      year: 2023, youtubeId: 'cTjrTb4XaR0' },
  { title: 'Roça Em Mim',              artist: 'Zé Felipe, Ana Castela & Luan Pereira',            year: 2022, youtubeId: 'C_tfe3FCM2A' },
  { title: 'Eu Só Quero Você',         artist: 'AgroPlay, Ana Castela & Zé Felipe',                year: 2025, youtubeId: 'LmH0AHzbnoQ' },
  { title: 'Canudinho',                artist: 'Gusttavo Lima & Ana Castela',                      year: 2023, youtubeId: 'h09p0IGiKaE' },
  { title: 'Saudade',                  artist: 'AgroPlay, Ana Castela & Gabito Ballesteros',       year: 2024, youtubeId: 'RvFtvcHD_Sc' },
  { title: 'Despedida',                artist: 'Xamã, Ana Castela & Salve Malak',                  year: 2025, youtubeId: 'UlAEdHDjoJw' },
  { title: 'Tropa do Chapelão',        artist: 'Ana Castela & Diplo',                              year: 2025, youtubeId: 'R_BeWWDLAsg' },
  { title: 'Covardia',                 artist: 'Wesley Safadão & Ana Castela',                     year: 2023, youtubeId: '-Tv-HCvX1fQ' },
  { title: 'Peça Íntima',              artist: 'Murilo Huff & Ana Castela',                        year: 2024, youtubeId: 'bw8AKEyIq1I' },
  { title: 'RAM TCHUM',                artist: 'Dennis, Ana Castela & MC GW',                      year: 2024, youtubeId: 'JHJwdnibNoY' },
  { title: 'Tô Voltando',              artist: 'Ana Castela',                                      year: 2023, youtubeId: 'VaoBgB8gPXU' },
  { title: 'Foi Intenso',              artist: 'Zé Neto e Cristiano & Ana Castela',                year: 2024, youtubeId: 'FeD9wvOq1yY' },
  { title: 'Princesa',                 artist: 'Gustavo Mioto & Ana Castela',                      year: 2025, youtubeId: '0NXVh4OIxfM' },
  { title: 'Dona de Mim',              artist: 'Ana Castela',                                      year: 2022, youtubeId: 'rUW7ev79fTA' },
  { title: 'Olha Onde Eu Tô',          artist: 'Ana Castela',                                      year: 2025, youtubeId: 'h_aRZwzjYxs' },
  { title: 'Rodeio No Texas',          artist: 'Ana Castela',                                      year: 2025, youtubeId: 'EV0rV4haNFs' },
  { title: 'Hoje Eu Lembrei de Você',  artist: 'Ana Castela',                                      year: 2026, youtubeId: 'CnY6xryxYDw' },
  { title: 'Casalzão',                 artist: 'Hugo & Heitor & Ana Castela',                      year: 2023, youtubeId: 'vrNn4xCw7cY' },
  { title: 'Hino Agro',                artist: 'Ana Castela, Léo & Raphael, Luan Pereira & +',     year: 2023, youtubeId: 'qqu9UarfxmI' },

  // ── Álbum: Let's Go Rodeo (faixas não presentes acima) ──
  { title: 'Se Amando nas BR',         artist: 'Ana Castela',                                      year: 2025, youtubeId: 'q2LXSctGna8', album: "Let's Go Rodeo" },
  { title: 'Não Precisa Ser Cowboy',   artist: 'Ana Castela',                                      year: 2025, youtubeId: '7F22m0yeFs8', album: "Let's Go Rodeo" },
  { title: 'Pra Quem Você Ligou',      artist: 'Ana Castela',                                      year: 2025, youtubeId: 'z3K6SwjF0-8', album: "Let's Go Rodeo" },
  { title: 'As Cowgirl',               artist: 'Ana Castela',                                      year: 2025, youtubeId: '8b_lAykNrnw', album: "Let's Go Rodeo" },
  { title: 'Saudade é Saudade',        artist: 'Ana Castela',                                      year: 2025, youtubeId: 'R5Nb5oW0mYw', album: "Let's Go Rodeo" },
  { title: 'Tô Voltando (Classic)',    artist: 'Ana Castela',                                      year: 2025, youtubeId: 'Wwe9tNZwYAI', album: "Let's Go Rodeo" },

  // ── Álbum: Boiadeira Internacional (faixas não presentes acima) ──
  { title: 'Bonde das Boiadeiras',     artist: 'Ana Castela',                                      year: 2023, youtubeId: 'N4ocWKVr3QA', album: 'Boiadeira Internacional' },
  { title: 'Alerta de Golpe',          artist: 'Ana Castela',                                      year: 2023, youtubeId: 'IgG1ekanyFQ', album: 'Boiadeira Internacional' },
  { title: 'As Menina da Pecuária',    artist: 'Ana Castela',                                      year: 2023, youtubeId: 'xg-t6VWnx3s', album: 'Boiadeira Internacional' },
  { title: 'Coração Bipolar',          artist: 'Ana Castela',                                      year: 2023, youtubeId: 'rjdpvfbFvQ8', album: 'Boiadeira Internacional' },
  { title: 'Só Não Deixa Saudade',     artist: 'Ana Castela',                                      year: 2023, youtubeId: 'xk_RO-5KLWQ', album: 'Boiadeira Internacional' },
  { title: 'Não Vai Ver Nunca',        artist: 'Ana Castela',                                      year: 2023, youtubeId: 'ypiw-p0XaJU', album: 'Boiadeira Internacional' },
  { title: 'Morreu de Ana Castela',    artist: 'Ana Castela',                                      year: 2023, youtubeId: 'KNZXJgji1Ww', album: 'Boiadeira Internacional' },
  { title: 'Chicletinho',              artist: 'Ana Castela',                                      year: 2023, youtubeId: 'kBM-2GHnpq0', album: 'Boiadeira Internacional' },
  { title: 'Pra Sempre Sem Ser',       artist: 'Ana Castela',                                      year: 2023, youtubeId: 'yi3U79UzahQ', album: 'Boiadeira Internacional' },
  { title: 'Quem Prova Pede Mais',     artist: 'Ana Castela',                                      year: 2023, youtubeId: 'qlOV6Zo4DYs', album: 'Boiadeira Internacional' },
  { title: 'Aqui Tem Alguém',          artist: 'Ana Castela',                                      year: 2023, youtubeId: 'FaU-qocV7uA', album: 'Boiadeira Internacional' },
  { title: 'Amizade ou o Quê',         artist: 'Ana Castela',                                      year: 2023, youtubeId: '5rnGyuLldBM', album: 'Boiadeira Internacional' },

  // ── Álbum: Herança Boiadeira (faixas não presentes acima) ──
  { title: 'Você Vai Ver',                                  artist: 'Ana Castela', year: 2026, youtubeId: 'aPqYwUPyZN0', album: 'Herança Boiadeira' },
  { title: 'Franguinho na Panela',                          artist: 'Ana Castela', year: 2026, youtubeId: '4OK23Y-4xsE', album: 'Herança Boiadeira' },
  { title: 'Rédeas do Possante',                            artist: 'Ana Castela', year: 2026, youtubeId: 'HxsxGqM3Sc0', album: 'Herança Boiadeira' },
  { title: 'Mamãe, Não Deixe Seu Filho Ser um Cowboy',      artist: 'Ana Castela', year: 2026, youtubeId: 'Jpv9iR09sjc', album: 'Herança Boiadeira' },
  { title: 'Vá com Deus',                                   artist: 'Ana Castela', year: 2026, youtubeId: 'OZSpfBEdz8k', album: 'Herança Boiadeira' },
  { title: 'Romaria',                                       artist: 'Ana Castela', year: 2026, youtubeId: 'Kw6X7Z1Qy4k', album: 'Herança Boiadeira' },
  { title: 'Saudade é Mato',                                artist: 'Ana Castela', year: 2026, youtubeId: 'dNixkzO0jgI', album: 'Herança Boiadeira' },
  { title: 'Se a Casa Cair',                                artist: 'Ana Castela', year: 2026, youtubeId: 'cZHlSHFeq7E', album: 'Herança Boiadeira' },
  { title: 'Barulho da Camioneta',                          artist: 'Ana Castela', year: 2026, youtubeId: 'jGbldS066tA', album: 'Herança Boiadeira' },

  // ── Álbum: Herança Boiadeira Ao Vivo ──
  { title: 'Minha Herança',                                 artist: 'Ana Castela', year: 2026, youtubeId: 'OrIlirfhorI', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Mercedita',                                     artist: 'Ana Castela', year: 2026, youtubeId: 'ZfQKpsgi53g', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Cachaceiro',                                    artist: 'Ana Castela', year: 2026, youtubeId: 'yY7teFcNtvE', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'As Andorinhas',                                 artist: 'Ana Castela', year: 2026, youtubeId: '83LaVN6K-Sw', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Tentei Te Esquecer',                            artist: 'Ana Castela', year: 2026, youtubeId: 'c_8naHLUO7U', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Menino do Laço Comprido',                       artist: 'Ana Castela', year: 2026, youtubeId: 'egyW5fY5yx8', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Veterinário',                                   artist: 'Ana Castela', year: 2026, youtubeId: 'nnLWf2Rbeyw', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Pássaro de Fogo',                               artist: 'Ana Castela', year: 2026, youtubeId: 'ZHmRvN1XJq0', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Vitrola Véia',                                  artist: 'Ana Castela', year: 2026, youtubeId: '0b37dw0zHhk', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Convite de Casamento',                          artist: 'Ana Castela', year: 2026, youtubeId: 'xrfrUNmgKi8', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Apaixonado por Você',                           artist: 'Ana Castela', year: 2026, youtubeId: 'fyTCY6f9NIs', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Mississipi',                                    artist: 'Ana Castela', year: 2026, youtubeId: 'Sphh4jO0bjw', album: 'Herança Boiadeira Ao Vivo' },
  { title: 'Peão Apaixonado',                               artist: 'Ana Castela', year: 2026, youtubeId: 'MEvt6OPB_3E', album: 'Herança Boiadeira Ao Vivo' },

  // ── Test additions (extreme metal / hardcore — diferentes do catálogo
  //     principal pra exercitar a detecção de "mesma música" entre
  //     usuários com gostos muito distintos)
  { title: 'Babykiller',               artist: 'Devourment',                                       year: 2000, youtubeId: 'ES_RXRuFNVw' },
  { title: 'Ballbuster',               artist: "Lilith's Demise",                                  year: 2024, youtubeId: 'IPBwBSDYLNU' },
  { title: 'Treacherous',              artist: 'Beneath the Massacre',                             year: 2020, youtubeId: 'l7BTiFYtaho' },
  { title: 'Ultraviolência',           artist: 'Surra',                                            year: 2023, youtubeId: 'NpcLwltd_bw' },
  { title: 'Futurephobia',             artist: 'VIOLATOR',                                         year: 2017, youtubeId: 'DmU3e84nVC0' },
];
