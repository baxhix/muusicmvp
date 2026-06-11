'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import VerifiedBadge from './VerifiedBadge';
import Lightbox, { type LightboxItem } from './Lightbox';
import { useAuth } from '@/lib/auth/AuthContext';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { globeStore } from '@/lib/globeStore';
import { track } from '@/lib/analytics';
import { SHOW_DAY, getShowDayPhase } from '@/lib/showDay';
import { useShowDayPhase } from '@/hooks/useShowDayPhase';
import { useShowDaySimulation } from '@/hooks/useShowDaySimulation';
import { type SimShowMessage } from '@/data/showDayFeed';
import styles from './ShowDayPanel.module.css';

/* ============================================================
 * SHOW DAY PANEL — "Hoje tem show" no AMBIENTE do Show Ao Vivo.
 *
 * Takeover full-screen (clone do ShowLiveStage): vinheta escura
 * com buraco central revelando o mapa inclinado pra arena, luzes
 * de palco (anéis + spots) e chat ancorado à direita — SEM box
 * de vídeo nem logos de patrocínio. Header: "● AO VIVO ·
 * Cobertura ao vivo Ana Castela | Fire Arena".
 *
 * O CHAT mantém a simulação do Show de hoje (fãs + Central Ana
 * Castela mandando fotos exclusivas via useShowDaySimulation —
 * nada persiste). Composer local-only com a identidade real.
 *
 * Auto-montado em /app/layout.tsx FORA do BrainstormGate. Abre
 * via globeStore.openShowDay() (marker) ou CustomEvent
 * 'app:open-show-day'. Esc/× fecham (sem backdrop — a vinheta é
 * pointer-events:none pro mapa receber drag/zoom por baixo).
 * ============================================================ */

/* Mesmo enquadramento cinematográfico do Show Ao Vivo (câmera
 * baixa olhando pro palco). SHOW_DAY fica na Arena Fonte Nova. */
const ARENA_CINEMATIC = {
  center: [SHOW_DAY.lng, SHOW_DAY.lat] as [number, number],
  zoom: 16,
  pitch: 65,
  bearing: -12,
  duration: 2400,
};

export default function ShowDayPanel() {
  const { user } = useAuth();
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const openedAtRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { phase } = useShowDayPhase();
  const { messages, attendeeCount, appendLocal } = useShowDaySimulation({
    phase,
    active: open,
  });

  /* Registro dos canais de abertura — handler é panel-owned
   * (sobrevive a remounts do Globe; ver globeStore). */
  useEffect(() => {
    const openPanel = (source: 'map_pin' | 'event') => {
      openedAtRef.current = Date.now();
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

  /* Esc fecha. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  /* Inclina o mapa pra arena enquanto aberto (igual ao Show Ao
   * Vivo). Globe restaura o view anterior no exit. */
  useEffect(() => {
    if (!open) return;
    globeStore.enterCinematic(ARENA_CINEMATIC);
    return () => globeStore.exitCinematic();
  }, [open]);

  /* data-showlive esconde o resto do chrome (TopBar, player,
   * ArtistBox, banner, docks…) — mesmo mecanismo do Show Ao Vivo. */
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.showlive = 'true';
    return () => {
      delete document.documentElement.dataset.showlive;
    };
  }, [open]);

  /* Auto-scroll do stream (bail se o user scrollou pra cima). */
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

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

  // Gate do menu Novas Features (flag `showDay`). Após os hooks.
  if (!flags.showDay || !open) return null;

  return (
    <>
      <div
        className={styles.root}
        role="dialog"
        aria-modal="true"
        aria-label={`Cobertura ao vivo — ${SHOW_DAY.venue}, ${SHOW_DAY.city}`}
      >
        {/* ── Vinheta com buraco central + luzes de palco ────── */}
        <div className={styles.vignette} aria-hidden="true">
          <div className={styles.stageRing} />
          <div className={`${styles.stageRing} ${styles.stageRingDelay}`} />
          <div className={`${styles.stageRing} ${styles.stageRingFar}`} />
          <div className={styles.stageSpotLeft} />
          <div className={styles.stageSpotRight} />
        </div>

        {/* ── Header label ──────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.headerLabel}>
            <span className={styles.headerLive}>
              <span className={styles.liveDot} aria-hidden="true" />
              AO VIVO
            </span>
            <span className={styles.headerVenue}>
              <span className={styles.headerPrefix}>Cobertura ao vivo </span>
              Ana Castela
              <span className={styles.headerCity}> | {SHOW_DAY.venue}</span>
            </span>
          </div>
        </div>

        {/* ── Close (canto superior direito) ────────────────── */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={close}
          aria-label="Sair da cobertura"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* ── Chat (ancorado à direita) ─────────────────────── */}
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <span className={styles.chatTitle}>Chat ao vivo</span>
            <span className={styles.chatCount}>
              {attendeeCount.toLocaleString('pt-BR')} assistindo
            </span>
          </div>
          <div className={styles.chatStream} ref={chatScrollRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.chatLine} ${m.sender.isStaff ? styles.chatLineStaff : ''} ${m.sender.role === 'super-fa' ? styles.chatLineSuperfan : ''} ${m.isSelf ? styles.chatLineSelf : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.sender.avatarUrl}
                  alt=""
                  className={styles.chatAvatar}
                  loading="lazy"
                  aria-hidden="true"
                />
                <div className={styles.chatBody}>
                  <span className={styles.chatName}>
                    {m.sender.name}
                    {m.sender.isStaff && <VerifiedBadge size={11} />}
                    {m.sender.role === 'super-fa' && (
                      <span className={styles.chatTierBadge}>SUPER-FÃ</span>
                    )}
                    {m.isSelf && <span className={styles.chatSelfBadge}>você</span>}
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
                  {m.body && <span className={styles.chatMessage}>{m.body}</span>}
                </div>
              </div>
            ))}
          </div>
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
              aria-label="Enviar"
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
        </div>
      </div>

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
