/* ============================================================
 * HOJE TEM SHOW — núcleo puro da simulação de dia de show.
 *
 * Contrato compartilhado entre a camada visual do mapa
 * (ShowDayLayer) e o painel (ShowDayPanel): fixture do venue,
 * máquina de fases derivada do RELÓGIO LOCAL (a simulação trata
 * todo dia como dia de show — demo sempre funcional) e
 * formatadores pt-BR.
 *
 * Fases:
 *   announced  00:00–19:59  "HOJE TEM SHOW" + countdown pras 20h
 *   live       20:00–22:59  "AO VIVO" — holofotes, chat acelerado,
 *                            fotos da Central
 *   ended      23:00–23:59  "SHOW ENCERRADO" — coda esmaecida;
 *                            à meia-noite volta a announced
 *
 * Sem React e sem imports de mapa — qualquer superfície pode
 * consumir. Quando existir um backend de eventos reais, o
 * SHOW_DAY vira fetch e getShowDayPhase passa a comparar contra
 * startsAt/endsAt do evento, sem mudar consumidores.
 * ============================================================ */

export const SHOW_DAY = {
  id: 'show-day-fire-arena',
  /** Pin de agenda (ANA_SHOWS) suprimido enquanto o marker especial
   *  estiver no ar — o ShowDayPanel substitui o popover "Ingressos"
   *  nesse venue. */
  agendaShowId: 'show-fire-arena-fonte-nova-2026',
  venue: 'Fire Arena',
  city: 'Salvador',
  state: 'BA',
  // Arena Fonte Nova — mesmas coords do pin de agenda + ShowLiveStage.
  lng: -38.5042,
  lat: -12.9789,
  /** Janela do show em hora LOCAL do dispositivo. */
  startHour: 20,
  endHour: 23,
  /** Audiência simulada: base + crescimento por minuto de live. */
  viewersBase: 9_800,
  viewersPerMinute: 37,
} as const;

export type ShowDayPhase = 'announced' | 'live' | 'ended';

/** Início (20h) e fim (23h) do show de HOJE, no fuso local. */
export function getShowDayBounds(now: Date = new Date()): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt = new Date(now);
  startsAt.setHours(SHOW_DAY.startHour, 0, 0, 0);
  const endsAt = new Date(now);
  endsAt.setHours(SHOW_DAY.endHour, 0, 0, 0);
  return { startsAt, endsAt };
}

export function getShowDayPhase(now: Date = new Date()): ShowDayPhase {
  const h = now.getHours();
  if (h < SHOW_DAY.startHour) return 'announced';
  if (h < SHOW_DAY.endHour) return 'live';
  return 'ended';
}

/** Audiência simulada do momento — cresce ao longo da janela live,
 *  com um wiggle determinístico pelo minuto (sem Math.random, pra
 *  que mapa e painel mostrem o MESMO número). */
export function getShowDayViewers(now: Date = new Date()): number {
  const phase = getShowDayPhase(now);
  if (phase === 'announced') return 0;
  const { startsAt, endsAt } = getShowDayBounds(now);
  const ref = phase === 'live' ? now : endsAt;
  const minutes = Math.max(
    0,
    Math.floor((ref.getTime() - startsAt.getTime()) / 60_000),
  );
  // Wiggle ±60 derivado do minuto (hash barato) — vida sem aleatório.
  const wiggle = ((minutes * 2_654_435_761) % 121) - 60;
  return SHOW_DAY.viewersBase + minutes * SHOW_DAY.viewersPerMinute + wiggle;
}

/** "02:14:09" — countdown até as 20h (painel). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "1h23" — countdown compacto de granularidade de minuto (chip do
 *  marker no mapa; abaixo de 1h vira "42min"). */
export function formatCountdownShort(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** "1:23:45" — tempo decorrido de show (header AO VIVO). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "12,4 mil" — contagem de audiência pt-BR compacta. */
export function formatViewers(n: number): string {
  if (n >= 1000) {
    const milhares = n / 1000;
    const rounded = Math.round(milhares * 10) / 10;
    return `${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return n.toLocaleString('pt-BR');
}
