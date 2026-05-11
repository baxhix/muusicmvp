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

  // ── Test additions (extreme metal / hardcore — diferentes do catálogo
  //     principal pra exercitar a detecção de "mesma música" entre
  //     usuários com gostos muito distintos)
  { title: 'Babykiller',               artist: 'Devourment',                                       year: 2000, youtubeId: 'ES_RXRuFNVw' },
  { title: 'Ballbuster',               artist: "Lilith's Demise",                                  year: 2024, youtubeId: 'IPBwBSDYLNU' },
  { title: 'Treacherous',              artist: 'Beneath the Massacre',                             year: 2020, youtubeId: 'l7BTiFYtaho' },
  { title: 'Ultraviolência',           artist: 'Surra',                                            year: 2023, youtubeId: 'NpcLwltd_bw' },
  { title: 'Futurephobia',             artist: 'VIOLATOR',                                         year: 2017, youtubeId: 'DmU3e84nVC0' },
];
