/**
 * Superchat — mock catalog de salas de chat coletivo.
 *
 * Por enquanto stub: o produto pediu o item no sidebar mas
 * ainda vai detalhar o que entra aqui. Modelei um shape
 * mínimo (sala, status, participantes, mensagens recentes)
 * pra que a página tenha conteúdo enquanto a especificação
 * não chega.
 *
 * Plausíveis evoluções: moderação em tempo real, banimento,
 * pinning de mensagens, métricas de engajamento por sala,
 * vinculação com uma live ao vivo (quando chatEnabled=true
 * no LiveEvent, vira uma sala aqui).
 */

export type SuperchatRoomStatus =
  | 'active'   // recebendo mensagens em tempo real
  | 'idle'     // open mas sem atividade recente
  | 'closed';  // fechada (live encerrou, ou moderação)

export type SuperchatRoomKind =
  | 'global'         // Superchat geral do app
  | 'live_event'     // anexado a uma live específica
  | 'community';     // sala de comunidade dedicada

export interface SuperchatRoom {
  id: string;
  name: string;
  kind: SuperchatRoomKind;
  status: SuperchatRoomStatus;
  participants: number;
  /** Mensagens nos últimos 5 min — heuristic pra "atividade". */
  recentMessages: number;
  /** Quando a sala foi aberta. ISO. */
  openedAt: string;
  /** Quando teve a última mensagem. Null se nunca. */
  lastActivityAt: string | null;
  /** Se ligada a um LiveEvent.id (quando kind === 'live_event'). */
  linkedLiveId: string | null;
}

export const MOCK_SUPERCHAT_ROOMS: SuperchatRoom[] = [
  {
    id: 'superchat-global',
    name: 'Superchat Global',
    kind: 'global',
    status: 'active',
    participants: 5128,
    recentMessages: 312,
    openedAt: '2025-09-01T00:00:00.000Z',
    lastActivityAt: '2026-05-22T13:42:00.000Z',
    linkedLiveId: null,
  },
  {
    id: 'superchat-ensaio-tropa',
    name: 'Ensaio Aberto · Tropa do Chapelão',
    kind: 'live_event',
    status: 'active',
    participants: 18742,
    recentMessages: 2104,
    openedAt: '2026-05-21T21:00:00.000Z',
    lastActivityAt: '2026-05-22T13:41:30.000Z',
    linkedLiveId: 'live-ensaio-aberto-tropa',
  },
  {
    id: 'superchat-boiadeiros-vips',
    name: 'Boiadeiros VIP · Top 100',
    kind: 'community',
    status: 'idle',
    participants: 91,
    recentMessages: 0,
    openedAt: '2026-04-02T18:00:00.000Z',
    lastActivityAt: '2026-05-19T22:11:00.000Z',
    linkedLiveId: null,
  },
  {
    id: 'superchat-q-and-a-rodeio',
    name: 'Q&A · Lançamento Rodeio',
    kind: 'live_event',
    status: 'closed',
    participants: 41208,
    recentMessages: 0,
    openedAt: '2026-04-30T20:00:00.000Z',
    lastActivityAt: '2026-04-30T20:48:00.000Z',
    linkedLiveId: 'live-q-and-a-rodeio',
  },
];

export function loadSuperchatRooms(): SuperchatRoom[] {
  return [...MOCK_SUPERCHAT_ROOMS].sort((a, b) => {
    // Active primeiro, depois idle, depois closed.
    const rank = (s: SuperchatRoomStatus) =>
      s === 'active' ? 0 : s === 'idle' ? 1 : 2;
    const ra = rank(a.status);
    const rb = rank(b.status);
    if (ra !== rb) return ra - rb;
    // Dentro do mesmo status, mais participantes em cima.
    return b.participants - a.participants;
  });
}

export const SUPERCHAT_STATUS_LABEL: Record<SuperchatRoomStatus, string> = {
  active: 'Ativa',
  idle:   'Ociosa',
  closed: 'Fechada',
};

export const SUPERCHAT_KIND_LABEL: Record<SuperchatRoomKind, string> = {
  global:     'Global',
  live_event: 'Live',
  community:  'Comunidade',
};
