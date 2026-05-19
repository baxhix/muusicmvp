'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import VerifiedBadge from './VerifiedBadge';
import {
  SUPERLIVE_FANS,
  SUPERLIVE_MESSAGES,
  type SuperliveFan,
} from '@/lib/superliveFakeData';
import styles from './CollectiveListeningModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ChatLine {
  id: number;
  fan: SuperliveFan;
  body: string;
}

/* ============================================================
 * COLLECTIVE LISTENING MODAL — "Audição coletiva" / Fire Arena
 *
 * Brainstorm feature: fans listen to Ana's album "Let's Go
 * Rodeo" together while chatting about it. Top of the modal
 * shows a vinyl spinning behind the album cover; bottom is the
 * same continuous fake-fan chat that the Superlive modal uses
 * (sharing the SUPERLIVE_FANS + SUPERLIVE_MESSAGES pools so
 * the visual rhythm reads as the same crowd).
 *
 * Self-contained: no shell context, no globe wiring. Gated by
 * the `collectiveListening` brainstorm flag at the trigger
 * (see CollectiveListeningTrigger.tsx).
 * ============================================================ */

const MAX_VISIBLE_MESSAGES = 60;
const MIN_TICK_MS = 1300;
const MAX_TICK_MS = 2800;
const VIEWER_BASE = 12_407;
const VIEWER_DRIFT = 240;

export default function CollectiveListeningModal({ open, onClose }: Props) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [viewers, setViewers] = useState(VIEWER_BASE);
  const [draft, setDraft] = useState('');
  const counterRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fanCursorRef = useRef(0);
  const msgCursorRef = useRef(0);

  // Seed messages on open. Deterministic by cursor so reopens
  // start from the same first frame.
  const initialLines = useMemo<ChatLine[]>(() => {
    const seed: ChatLine[] = [];
    for (let i = 0; i < 7; i++) {
      const fan = SUPERLIVE_FANS[(i * 3) % SUPERLIVE_FANS.length];
      const body = SUPERLIVE_MESSAGES[(i * 5) % SUPERLIVE_MESSAGES.length];
      seed.push({ id: -1 - i, fan, body });
    }
    return seed;
  }, []);

  useEffect(() => {
    if (!open) {
      setLines([]);
      setDraft('');
      counterRef.current = 0;
      fanCursorRef.current = 0;
      msgCursorRef.current = 0;
      return;
    }
    setLines(initialLines);
    setViewers(VIEWER_BASE);
  }, [open, initialLines]);

  // Fake chat tick — same shape as SuperliveModal but the
  // cursors step at different primes so the two surfaces don't
  // produce identical message sequences when both are open
  // back-to-back.
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const fanIdx = fanCursorRef.current % SUPERLIVE_FANS.length;
      const msgIdx = msgCursorRef.current % SUPERLIVE_MESSAGES.length;
      fanCursorRef.current += 5;
      msgCursorRef.current += 13;
      counterRef.current += 1;
      const next: ChatLine = {
        id: counterRef.current,
        fan: SUPERLIVE_FANS[fanIdx],
        body: SUPERLIVE_MESSAGES[msgIdx],
      };
      setLines((curr) => {
        const merged = [...curr, next];
        return merged.length > MAX_VISIBLE_MESSAGES
          ? merged.slice(merged.length - MAX_VISIBLE_MESSAGES)
          : merged;
      });
      const delay =
        MIN_TICK_MS + Math.floor(Math.random() * (MAX_TICK_MS - MIN_TICK_MS));
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 900);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // Viewer-count drift (smaller band than Superlive — album
  // listening sessions are quieter than live broadcasts).
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setViewers((curr) => {
        const delta = Math.floor((Math.random() - 0.45) * VIEWER_DRIFT);
        return Math.max(VIEWER_BASE - 1200, curr + delta);
      });
    }, 3500);
    return () => clearInterval(id);
  }, [open]);

  // Auto-scroll the chat to bottom when new lines append. Same
  // "don't fight the user if they've scrolled up" logic as the
  // Superlive modal.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    counterRef.current += 1;
    const next: ChatLine = {
      id: counterRef.current,
      fan: {
        name: 'Você',
        avatar: '/avatar-placeholder.svg',
        tier: 'superfan',
      },
      body,
    };
    setLines((curr) =>
      [...curr, next].slice(-MAX_VISIBLE_MESSAGES),
    );
    setDraft('');
  };

  return (
    <div className={styles.scrim} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Audição coletiva — Let's Go Rodeo"
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* ── Album stage ─────────────────────────────────── */}
        <div className={styles.stage}>
          {/* Record wrapper — fixed-size square that anchors both
           *  the spinning vinyl AND the static album cover. The
           *  cover used to live as a SIBLING of .vinyl in .stage,
           *  which meant top:50% measured from .stage's height
           *  (variable, included the overlay text) — the cover
           *  drifted off the vinyl's center. With the wrapper,
           *  both children are positioned relative to the same
           *  200×200 box, so the cover sits dead center while the
           *  vinyl spins around it. */}
          <div className={styles.record}>
            <div className={styles.vinyl} aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/single.png"
              alt="Capa do álbum Let's Go Rodeo"
              className={styles.albumCover}
            />
            <span className={styles.vinylHole} aria-hidden="true" />
          </div>
          <div className={styles.stageOverlay}>
            {/* Single combined line: "Ana Castela ✓ · Let's Go Rodeo".
              * Used to be two separate elements stacked (h2 album +
              * span artist) which ate vertical space; per product
              * feedback they read better fused into one row, with
              * the artist in bright white + the album in a slightly
              * muted weight after the separator. */}
            <h2 className={styles.albumLine}>
              <span className={styles.albumLineArtist}>
                Ana Castela
                <VerifiedBadge size={12} />
              </span>
              <span className={styles.albumLineSep} aria-hidden="true">·</span>
              <span className={styles.albumLineAlbum}>Let&apos;s Go Rodeo</span>
            </h2>
            <span className={styles.viewers}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {viewers.toLocaleString('pt-BR')} ouvindo juntos
            </span>
          </div>

          {/* ── Simulated player row ─────────────────────
           * Matches the home NowPlaying mini-bar visual:
           * circular cover with wave-bar overlay + track
           * title + artist + circular play button. Adds a
           * progress bar below the row (the home mini bar
           * doesn't have one). All static / demo state — swap
           * in real audio + playhead when the audio player
           * wires up. */}
          <div className={styles.player}>
            <div className={styles.playerMain}>
              <div className={styles.playerArt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/single.png"
                  alt=""
                  aria-hidden="true"
                />
                <div className={styles.playerWave} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className={styles.playerInfo}>
                <span className={styles.playerTrackName}>Pipoco</span>
                <span className={styles.playerArtist}>Ana Castela</span>
              </div>
              <button
                type="button"
                className={styles.playerPlay}
                aria-label="Pausar reprodução"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Demo: shows pause glyph (we assume the live
                 *  audition is "playing" right now). Swap with
                 *  toggleable state when the audio wires up. */}
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="3" y="2" width="2.8" height="10" rx="1" fill="currentColor" />
                  <rect x="8.2" y="2" width="2.8" height="10" rx="1" fill="currentColor" />
                </svg>
              </button>
            </div>
            <div className={styles.playerProgress}>
              <div className={styles.playerProgressFill} />
            </div>
            <div className={styles.playerTimes}>
              <span>01:25</span>
              <span>03:42</span>
            </div>
          </div>
        </div>

        {/* ── Chat stream ─────────────────────────────────── */}
        <div className={styles.chatStream} ref={chatScrollRef}>
          {lines.map((line) => (
            <div
              key={line.id}
              className={`${styles.chatLine} ${
                line.fan.tier === 'mod'
                  ? styles.chatLineMod
                  : line.fan.tier === 'superfan'
                    ? styles.chatLineSuperfan
                    : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.fan.avatar}
                alt=""
                className={styles.chatAvatar}
                aria-hidden="true"
              />
              <div className={styles.chatBody}>
                <span className={styles.chatName}>
                  {line.fan.name}
                  {line.fan.verified && <VerifiedBadge size={11} />}
                  {line.fan.tier === 'mod' && (
                    <span className={styles.chatTierBadge}>MOD</span>
                  )}
                  {line.fan.tier === 'superfan' && (
                    <span className={styles.chatTierBadge}>SUPERFÃ</span>
                  )}
                </span>
                <span className={styles.chatMessage}>{line.body}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Composer ───────────────────────────────────── */}
        <form className={styles.composer} onSubmit={handleSend}>
          <input
            type="text"
            className={styles.composerField}
            placeholder="Comente sobre a música…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
          />
          <button
            type="submit"
            className={styles.composerSend}
            disabled={!draft.trim()}
            aria-label="Enviar comentário"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
