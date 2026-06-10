'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import MotionModalShell from './MotionModalShell';
import MobileSheetShell from './MobileSheetShell';
import VerifiedBadge from './VerifiedBadge';
import Lightbox, { type LightboxItem } from './Lightbox';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAuth } from '@/lib/auth/AuthContext';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { globeStore } from '@/lib/globeStore';
import { track } from '@/lib/analytics';
import {
  SHOW_DAY,
  formatCountdown,
  formatElapsed,
  getShowDayPhase,
} from '@/lib/showDay';
import { useShowDayPhase } from '@/hooks/useShowDayPhase';
import { useShowDaySimulation } from '@/hooks/useShowDaySimulation';
import {
  SHOW_ATTENDEES,
  type SimShowMessage,
} from '@/data/showDayFeed';
import styles from './ShowDayPanel.module.css';

/* ============================================================
 * SHOW DAY PANEL — superfície do "Hoje tem show".
 *
 * Painel ancorado sobre o mapa (scrim leve — o globo continua
 * visível atrás) com:
 *   - Header por fase: countdown (announced), "● AO VIVO" +
 *     decorrido (live), "SHOW ENCERRADO" (ended).
 *   - Strip de presentes (avatar stack + contador driftando) que
 *     alterna pra vista "Presentes no show".
 *   - Chat SIMULADO: fãs comentando + Central Ana Castela
 *     mandando fotos exclusivas (motor no useShowDaySimulation —
 *     nada é persistido, nenhum POST de chat).
 *   - Composer local-only com a identidade real do usuário.
 *
 * Auto-montado em /app/layout.tsx FORA do BrainstormGate
 * (visível pra todos). Abre via globeStore.openShowDay() (marker
 * do mapa) ou CustomEvent 'app:open-show-day' (CTAs futuros).
 * Desktop = MotionModalShell; mobile = MobileSheetShell.
 * ============================================================ */

export default function ShowDayPanel() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'presentes'>('chat');
  const [draft, setDraft] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const openedAtRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { phase, countdownMs, elapsedMs } = useShowDayPhase();
  const { messages, attendeeCount, appendLocal } = useShowDaySimulation({
    phase,
    active: open,
  });

  /* Registro dos canais de abertura — handler é panel-owned
   * (sobrevive a remounts do Globe; ver globeStore). */
  useEffect(() => {
    const openPanel = (source: 'map_pin' | 'event') => {
      openedAtRef.current = Date.now();
      setView('chat');
      setOpen(true);
      track('show_day_panel_opened', { phase: getShowDayPhase(), source });
    };
    globeStore.registerOpenShowDay(() => openPanel('map_pin'));
    const onEvent = () => openPanel('event');
    window.addEventListener('app:open-show-day', onEvent);
    return () => window.removeEventListener('app:open-show-day', onEvent);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setLightboxIndex(null);
    setDraft('');
    track('show_day_panel_closed', {
      phase: getShowDayPhase(),
      seconds_open: Math.round((Date.now() - openedAtRef.current) / 1000),
    });
  }, []);

  /* Auto-scroll do stream (bail se o user scrollou pra cima). */
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, view]);

  /* Fotos já enviadas pela Central → items do Lightbox. */
  const photoMessages = useMemo(
    () => messages.filter((m) => m.photo),
    [messages],
  );
  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      photoMessages.map((m) => ({
        id: String(m.id),
        src: m.photo!.url,
        alt: m.body ?? 'Foto exclusiva do show',
        name: 'Central Ana Castela — foto exclusiva',
      })),
    [photoMessages],
  );

  const openPhoto = useCallback(
    (msg: SimShowMessage) => {
      const idx = photoMessages.findIndex((m) => m.id === msg.id);
      if (idx < 0) return;
      setLightboxIndex(idx);
      track('show_day_photo_viewed', {
        photo_index: idx,
        phase: getShowDayPhase(),
      });
    },
    [photoMessages],
  );

  const openPresentes = useCallback(() => {
    setView('presentes');
    track('show_day_presentes_viewed', { phase: getShowDayPhase() });
  }, []);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    appendLocal(body, {
      name: user?.name ?? 'Você',
      avatarUrl: user?.avatarUrl ?? '/avatar-placeholder.svg',
    });
    if (phase !== 'ended') {
      track('show_day_message_sent_local', {
        phase,
        body_length: body.length,
      });
    }
    setDraft('');
  };

  // Feature gated pelo menu Novas Features (flag `showDay`). Após
  // todos os hooks: non-owners (ALL_OFF) e owner com toggle off não
  // montam o painel. O marker (ShowDayLayer) usa o mesmo gate, então
  // openShowDay nem chega a ser disparado nesses casos.
  if (!flags.showDay) return null;

  const attendeeLabel = `${attendeeCount.toLocaleString('pt-BR')} fãs presentes`;

  const content = (
    <div className={styles.content} data-phase={phase}>
      {/* ── Header por fase ─────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.statusRow}>
          <span className={styles.statusBadge}>
            <span className={styles.statusDot} aria-hidden="true" />
            {phase === 'live'
              ? 'AO VIVO'
              : phase === 'ended'
                ? 'SHOW ENCERRADO'
                : 'HOJE TEM SHOW'}
          </span>
          {phase === 'announced' && (
            <span className={styles.statusTime}>
              começa em {formatCountdown(countdownMs)}
            </span>
          )}
          {phase === 'live' && (
            <span className={styles.statusTime}>
              {formatElapsed(elapsedMs)}
            </span>
          )}
        </div>
        <span className={styles.venue}>
          {SHOW_DAY.venue} · {SHOW_DAY.city}, {SHOW_DAY.state}
        </span>
      </div>

      {/* ── Strip de presentes ──────────────────────────────── */}
      <button
        type="button"
        className={styles.presenceStrip}
        onClick={view === 'chat' ? openPresentes : () => setView('chat')}
        aria-label={
          view === 'chat'
            ? `Ver ${attendeeLabel}`
            : 'Voltar pro chat do show'
        }
      >
        <span className={styles.presenceAvatars} aria-hidden="true">
          {SHOW_ATTENDEES.slice(0, 5).map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.id}
              src={a.avatarUrl}
              alt=""
              className={styles.presenceAvatar}
              loading="lazy"
            />
          ))}
        </span>
        <span className={styles.presenceLabel}>{attendeeLabel}</span>
        <span className={styles.presenceChevron} aria-hidden="true">
          {view === 'chat' ? '›' : '‹'}
        </span>
      </button>

      {/* ── Corpo: chat ⇄ presentes ─────────────────────────── */}
      {view === 'chat' ? (
        <div className={styles.stream} ref={chatScrollRef}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.bubble} ${m.sender.isStaff ? styles.bubbleStaff : ''} ${m.isSelf ? styles.bubbleSelf : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.sender.avatarUrl}
                alt=""
                className={styles.bubbleAvatar}
                loading="lazy"
              />
              <div className={styles.bubbleBody}>
                <span className={styles.bubbleName}>
                  {m.sender.name}
                  {m.sender.isStaff && <VerifiedBadge size={11} />}
                  {m.sender.role === 'super-fa' && (
                    <span className={styles.roleChip}>SUPER-FÃ</span>
                  )}
                  {m.isSelf && <span className={styles.selfChip}>você</span>}
                </span>
                {m.photo && (
                  <button
                    type="button"
                    className={styles.photoBtn}
                    onClick={() => openPhoto(m)}
                    aria-label="Ampliar foto exclusiva do show"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.photo.url}
                      alt={m.body ?? 'Foto exclusiva do show'}
                      width={m.photo.width}
                      height={m.photo.height}
                      className={styles.photoImg}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                )}
                {m.body && (
                  <span className={styles.bubbleText}>{m.body}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.attendeesList}>
          {SHOW_ATTENDEES.map((a) => (
            <div key={a.id} className={styles.attendeeRow}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.avatarUrl}
                alt=""
                className={styles.attendeeAvatar}
                loading="lazy"
              />
              <div className={styles.attendeeInfo}>
                <span className={styles.attendeeName}>
                  {a.name}
                  {a.role === 'super-fa' && (
                    <span className={styles.roleChip}>SUPER-FÃ</span>
                  )}
                </span>
                <span className={styles.attendeeCity}>{a.city}</span>
              </div>
              <span className={styles.attendeePresence}>no local</span>
            </div>
          ))}
          <p className={styles.attendeesFooter}>
            Mostrando {SHOW_ATTENDEES.length} de{' '}
            {attendeeCount.toLocaleString('pt-BR')}
          </p>
        </div>
      )}

      {/* ── Composer (some no ended) ────────────────────────── */}
      {view === 'chat' && phase !== 'ended' && (
        <form className={styles.composer} onSubmit={handleSend}>
          <input
            type="text"
            className={styles.composerField}
            placeholder="Mande sua mensagem…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
          />
          <button
            type="submit"
            className={styles.composerSend}
            aria-label="Enviar mensagem"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      )}
      {view === 'chat' && phase === 'ended' && (
        <p className={styles.endedFooter}>
          Show encerrado · até a próxima! 🤠
        </p>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <MobileSheetShell open={open} onClose={close} title="Hoje tem show">
          {content}
        </MobileSheetShell>
      ) : (
        <MotionModalShell
          open={open}
          onClose={close}
          modalClassName={styles.modal}
          scrimClassName={styles.scrim}
          ariaLabel={`Hoje tem show — ${SHOW_DAY.venue}, ${SHOW_DAY.city}`}
        >
          {content}
        </MotionModalShell>
      )}
      {lightboxIndex !== null && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          index={Math.min(lightboxIndex, lightboxItems.length - 1)}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
