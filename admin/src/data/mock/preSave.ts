/**
 * Pre Save — mock catalog de campanhas.
 *
 * Modela campanhas de pre-save (usuário salva a faixa antes do
 * release; quando o single sai, o player adiciona automaticamente
 * à biblioteca dele). Cada entrada carrega o que o admin precisa
 * pra acompanhar: nome, faixa, release date, status do ciclo,
 * contagem de pre-saves e as plataformas integradas.
 *
 * Quando o backend de pre-save subir basta trocar
 * `loadPreSaveCampaigns()` por um `fetch('/api/admin/pre-save')`
 * — o shape do tipo + os renderers da página não dependem da
 * fonte. Ordenado por releaseDate desc (mais próximo do hoje
 * primeiro, depois passado).
 */

export type PreSaveStatus =
  | 'scheduled' // ainda não estreou, aceitando pre-saves
  | 'live'      // já lançou, ainda aceitando saves (cauda promocional)
  | 'released'  // já lançou e a campanha foi encerrada
  | 'archived'; // arquivada manualmente pelo time

export type PreSavePlatform =
  | 'spotify'
  | 'apple_music'
  | 'deezer'
  | 'youtube_music'
  | 'amazon_music';

export interface PreSaveCampaign {
  id: string;
  name: string;
  trackTitle: string;
  artist: string;
  releaseDate: string; // ISO
  status: PreSaveStatus;
  preSavesCount: number;
  platforms: PreSavePlatform[];
  createdAt: string; // ISO
  createdBy: { id: string; name: string };
}

/** Deterministic dataset — não embaralha entre renders. */
export const MOCK_PRE_SAVE_CAMPAIGNS: PreSaveCampaign[] = [
  {
    id: 'ps-let-rodeo-deluxe',
    name: 'Lets Go Rodeo · Deluxe Edition',
    trackTitle: 'Lets Go Rodeo (Deluxe)',
    artist: 'Ana Castela',
    releaseDate: '2026-08-15T00:00:00.000Z',
    status: 'scheduled',
    preSavesCount: 18432,
    platforms: ['spotify', 'apple_music', 'youtube_music', 'deezer', 'amazon_music'],
    createdAt: '2026-04-02T13:18:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'ps-as-cowgirl-single',
    name: 'As Cowgirl (Single)',
    trackTitle: 'As Cowgirl',
    artist: 'Ana Castela',
    releaseDate: '2026-06-20T00:00:00.000Z',
    status: 'scheduled',
    preSavesCount: 9871,
    platforms: ['spotify', 'apple_music', 'deezer'],
    createdAt: '2026-04-22T09:42:00.000Z',
    createdBy: { id: 'admin-2', name: 'Marcelo Demaribaxhix' },
  },
  {
    id: 'ps-rodeio-no-texas-feat',
    name: 'Rodeio no Texas · feat. Diplo',
    trackTitle: 'Rodeio No Texas (feat. Diplo)',
    artist: 'Ana Castela',
    releaseDate: '2026-05-30T00:00:00.000Z',
    status: 'live',
    preSavesCount: 27640,
    platforms: ['spotify', 'apple_music', 'youtube_music', 'amazon_music'],
    createdAt: '2026-03-11T16:05:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'ps-saudade-eh-saudade',
    name: 'Saudade é Saudade',
    trackTitle: 'Saudade é Saudade',
    artist: 'Ana Castela',
    releaseDate: '2026-05-09T00:00:00.000Z',
    status: 'live',
    preSavesCount: 13245,
    platforms: ['spotify', 'apple_music'],
    createdAt: '2026-03-20T11:30:00.000Z',
    createdBy: { id: 'admin-2', name: 'Marcelo Demaribaxhix' },
  },
  {
    id: 'ps-tropa-do-chapelao-launch',
    name: 'Tropa do Chapelão · Launch',
    trackTitle: 'Tropa do Chapelão',
    artist: 'Ana Castela & Diplo',
    releaseDate: '2026-02-28T00:00:00.000Z',
    status: 'released',
    preSavesCount: 42813,
    platforms: ['spotify', 'apple_music', 'youtube_music', 'deezer', 'amazon_music'],
    createdAt: '2025-12-15T10:12:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'ps-olha-onde-eu-to',
    name: 'Olha Onde Eu Tô',
    trackTitle: 'Olha Onde Eu Tô',
    artist: 'Ana Castela',
    releaseDate: '2026-01-18T00:00:00.000Z',
    status: 'released',
    preSavesCount: 31204,
    platforms: ['spotify', 'apple_music', 'deezer'],
    createdAt: '2025-11-02T14:55:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'ps-heranca-boiadeira-vol2',
    name: 'Herança Boiadeira · Vol. II (cancelada)',
    trackTitle: 'Herança Boiadeira (Vol. II)',
    artist: 'Ana Castela',
    releaseDate: '2026-04-01T00:00:00.000Z',
    status: 'archived',
    preSavesCount: 412,
    platforms: ['spotify'],
    createdAt: '2026-01-30T08:00:00.000Z',
    createdBy: { id: 'admin-2', name: 'Marcelo Demaribaxhix' },
  },
];

export function loadPreSaveCampaigns(): PreSaveCampaign[] {
  return [...MOCK_PRE_SAVE_CAMPAIGNS].sort(
    (a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate),
  );
}

export const PLATFORM_LABEL: Record<PreSavePlatform, string> = {
  spotify:       'Spotify',
  apple_music:   'Apple Music',
  deezer:        'Deezer',
  youtube_music: 'YouTube Music',
  amazon_music:  'Amazon Music',
};

export const STATUS_LABEL: Record<PreSaveStatus, string> = {
  scheduled: 'Agendada',
  live:      'Ativa',
  released:  'Encerrada',
  archived:  'Arquivada',
};
