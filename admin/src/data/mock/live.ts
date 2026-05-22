/**
 * Live — mock catalog de eventos ao vivo.
 *
 * Cobre o fluxo descrito pelo produto: o backoffice agenda um
 * evento, define se o chat (Superchat) fica liberado pra
 * audiência e qual TIER de fãs é notificado/permitido entrar.
 * Quando a hora chega, a artista (ou equipe) abre o app de
 * creator e dá start na transmissão.
 *
 * Quando o backend de Live cair basta trocar
 * `loadLiveEvents()` por um fetch — o shape do tipo + os
 * renderers da página são agnósticos. Ordenado por
 * scheduledAt desc (próximas e ao-vivo primeiro, histórico
 * depois).
 */

export type LiveStatus =
  | 'scheduled' // agendada (futura, RSVPs/notificações ativas)
  | 'live'      // transmitindo agora
  | 'ended'     // terminou normalmente
  | 'cancelled'; // cancelada antes ou durante

/**
 * Audiência permitida + notificada. Tiers cumulativos (cada
 * um contém o anterior): top_1 < top_10 < top_50 < top_100 <
 * all. O backoffice escolhe UM tier — o sistema notifica e
 * libera entrada pra todos os fãs dentro daquele bucket.
 */
export type LiveAudienceTier =
  | 'top_1'
  | 'top_10'
  | 'top_50'
  | 'top_100'
  | 'all';

export interface LiveEvent {
  id: string;
  name: string;
  artist: string;
  /** Quando vai (ou foi) ao ar — ISO datetime. */
  scheduledAt: string;
  status: LiveStatus;
  /** Quando true, o Superchat da live aceita mensagens dos fãs.
   *  Quando false, é broadcast one-way. */
  chatEnabled: boolean;
  audience: LiveAudienceTier;
  /** Pico simultâneo (lives in-progress + ended). Zero
   *  enquanto scheduled / cancelled. */
  viewersPeak: number;
  /** Duração em minutos (lives ended). Null se nunca rolou. */
  durationMinutes: number | null;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export const MOCK_LIVE_EVENTS: LiveEvent[] = [
  {
    id: 'live-festa-junina-arraial',
    name: 'Festa Junina · Arraial Boiadeiro',
    artist: 'Ana Castela',
    scheduledAt: '2026-06-24T22:00:00.000Z',
    status: 'scheduled',
    chatEnabled: true,
    audience: 'all',
    viewersPeak: 0,
    durationMinutes: null,
    createdAt: '2026-05-12T11:30:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'live-bastidores-rodeio-texas',
    name: 'Bastidores · Rodeio no Texas',
    artist: 'Ana Castela',
    scheduledAt: '2026-06-08T21:00:00.000Z',
    status: 'scheduled',
    chatEnabled: true,
    audience: 'top_100',
    viewersPeak: 0,
    durationMinutes: null,
    createdAt: '2026-05-20T09:14:00.000Z',
    createdBy: { id: 'admin-2', name: 'Marcelo Demaribaxhix' },
  },
  {
    id: 'live-encontro-superfas-vip',
    name: 'Encontro Superfãs · VIP',
    artist: 'Ana Castela',
    scheduledAt: '2026-06-01T20:00:00.000Z',
    status: 'scheduled',
    chatEnabled: true,
    audience: 'top_10',
    viewersPeak: 0,
    durationMinutes: null,
    createdAt: '2026-05-22T16:48:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'live-ensaio-aberto-tropa',
    name: 'Ensaio Aberto · Tropa do Chapelão',
    artist: 'Ana Castela',
    scheduledAt: '2026-05-21T21:00:00.000Z',
    status: 'live',
    chatEnabled: true,
    audience: 'all',
    viewersPeak: 18742,
    durationMinutes: null,
    createdAt: '2026-05-10T08:00:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'live-aniversario-do-fa-1',
    name: 'Aniversário do Fã #1',
    artist: 'Ana Castela',
    scheduledAt: '2026-05-05T19:30:00.000Z',
    status: 'ended',
    chatEnabled: true,
    audience: 'top_1',
    viewersPeak: 1,
    durationMinutes: 22,
    createdAt: '2026-04-25T13:25:00.000Z',
    createdBy: { id: 'admin-2', name: 'Marcelo Demaribaxhix' },
  },
  {
    id: 'live-q-and-a-rodeio',
    name: 'Q&A · Lançamento Rodeio',
    artist: 'Ana Castela',
    scheduledAt: '2026-04-30T20:00:00.000Z',
    status: 'ended',
    chatEnabled: false,
    audience: 'all',
    viewersPeak: 41208,
    durationMinutes: 48,
    createdAt: '2026-04-18T10:12:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
  {
    id: 'live-superfas-50',
    name: 'Hangout · Top 50 Superfãs',
    artist: 'Ana Castela',
    scheduledAt: '2026-04-12T19:00:00.000Z',
    status: 'ended',
    chatEnabled: true,
    audience: 'top_50',
    viewersPeak: 47,
    durationMinutes: 65,
    createdAt: '2026-03-30T14:30:00.000Z',
    createdBy: { id: 'admin-2', name: 'Marcelo Demaribaxhix' },
  },
  {
    id: 'live-show-cancelado-temporal',
    name: 'Show Surpresa · Lisboa (cancelada)',
    artist: 'Ana Castela',
    scheduledAt: '2026-04-02T21:00:00.000Z',
    status: 'cancelled',
    chatEnabled: true,
    audience: 'all',
    viewersPeak: 0,
    durationMinutes: null,
    createdAt: '2026-03-15T11:00:00.000Z',
    createdBy: { id: 'admin-1', name: 'Equipe Releases' },
  },
];

export function loadLiveEvents(): LiveEvent[] {
  return [...MOCK_LIVE_EVENTS].sort(
    (a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt),
  );
}

export const STATUS_LABEL: Record<LiveStatus, string> = {
  scheduled: 'Agendada',
  live:      'Ao vivo',
  ended:     'Encerrada',
  cancelled: 'Cancelada',
};

/** Rótulo curto pra mostrar nos chips da tabela. */
export const AUDIENCE_LABEL: Record<LiveAudienceTier, string> = {
  top_1:   'Top 1',
  top_10:  'Top 10',
  top_50:  'Top 50',
  top_100: 'Top 100',
  all:     'Todos',
};

/** Descrição longa pra select/tooltips. */
export const AUDIENCE_DESCRIPTION: Record<LiveAudienceTier, string> = {
  top_1:   'Apenas o superfã #1',
  top_10:  'Top 10 do ranking',
  top_50:  'Top 50 do ranking',
  top_100: 'Top 100 do ranking',
  all:     'Audiência aberta (todos os fãs)',
};
