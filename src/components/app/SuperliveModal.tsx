'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import VerifiedBadge from './VerifiedBadge';
import {
  SUPERLIVE_FANS,
  SUPERLIVE_MESSAGES,
  type SuperliveFan,
} from '@/lib/superliveFakeData';
import styles from './SuperliveModal.module.css';

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
 * SUPERLIVE MODAL — brainstorm feature
 *
 * Centered modal that simulates a live Ana Castela broadcast:
 *
 *   - Top: looping video with a "AO VIVO" badge + viewer count
 *   - Bottom: continuously scrolling fan chat (fake data,
 *     1.2–2.6s per message at full throttle so the surface
 *     feels like the real-time peak of a popular show)
 *   - Footer: composer where the viewer can drop their own
 *     message into the stream (local-only — no backend yet)
 *
 * Mounted in /app/page.tsx behind the `superlive` brainstorm
 * flag, opened via the SuperliveTrigger pill at the top of
 * the home view. Everything in this component is self-
 * contained: no shell context, no globe wiring, just a flag
 * gate around the trigger.
 * ============================================================ */

const MAX_VISIBLE_MESSAGES = 60;
/** Viewer-count animation — drifts ±a small random delta every
 *  3s within a baseline band. Makes the count feel alive without
 *  jumping into implausible numbers. */
const VIEWER_BASE = 24_812;
const VIEWER_DRIFT = 380;

/** Fake-message tick range — picks a delay each round so the
 *  chat doesn't feel metronomic. Range tuned by eye against
 *  Instagram-Live behavior at moderate engagement. */
const MIN_TICK_MS = 1200;
const MAX_TICK_MS = 2600;

export default function SuperliveModal({ open, onClose }: Props) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [viewers, setViewers] = useState(VIEWER_BASE);
  const [draft, setDraft] = useState('');
  const [muted, setMuted] = useState(true);
  const counterRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fanCursorRef = useRef(0);
  const msgCursorRef = useRef(0);

  // Seed the chat with a small handful of messages so the surface
  // doesn't open empty. Picks are deterministic by cursor (not
  // Math.random) so the seeded list is the same across reloads
  // until the cursor wraps.
  const initialLines = useMemo<ChatLine[]>(() => {
    const seed: ChatLine[] = [];
    for (let i = 0; i < 8; i++) {
      const fan = SUPERLIVE_FANS[i % SUPERLIVE_FANS.length];
      const body = SUPERLIVE_MESSAGES[(i * 7) % SUPERLIVE_MESSAGES.length];
      seed.push({ id: -1 - i, fan, body });
    }
    return seed;
  }, []);

  // Reset state every open so reopens feel fresh.
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

  // Append a new fake message on a self-scheduled timeout. Each
  // round schedules the NEXT round with a fresh delay so the
  // cadence varies — setInterval with a fixed period feels too
  // metronomic for a "real" chat stream. We also pick fan/msg
  // via two independent cursors so consecutive messages can
  // come from different fans even if they share a base index.
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const fanIdx = fanCursorRef.current % SUPERLIVE_FANS.length;
      const msgIdx = msgCursorRef.current % SUPERLIVE_MESSAGES.length;
      // Cursors drift at different primes so the pair re-pairs
      // slowly — no immediate "same fan, same message" repeats.
      fanCursorRef.current += 7;
      msgCursorRef.current += 11;
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
    timer = setTimeout(tick, 800);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // Drift the viewer count every 3s within ±VIEWER_DRIFT.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setViewers((curr) => {
        const delta = Math.floor((Math.random() - 0.45) * VIEWER_DRIFT);
        const next = Math.max(VIEWER_BASE - 1500, curr + delta);
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [open]);

  // Auto-scroll the chat to bottom when new lines append. We bail
  // if the user has scrolled UP — that signals they're reading
  // older content and we shouldn't fight them.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  // Auto-play video on open. Muted by default so autoplay isn't
  // blocked by the browser; the speaker icon lets the viewer
  // un-mute manually.
  useEffect(() => {
    if (!open) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {
      /* autoplay can fail with user-activation policies — fine */
    });
  }, [open]);

  // Escape closes the modal so it matches every other shell-
  // mounted overlay (PlaylistModal, AnaCheckInPanel, etc.).
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
      // Viewer's own message — uses a generic "Você" persona so
      // the chat highlights it visually via the `tier: 'self'`
      // class hook below.
      fan: {
        name: 'Você',
        avatar: 'https://i.pravatar.cc/64?u=me-superlive',
        tier: 'superfan',
      },
      body,
    };
    setLines((curr) => {
      const merged = [...curr, next];
      return merged.length > MAX_VISIBLE_MESSAGES
        ? merged.slice(merged.length - MAX_VISIBLE_MESSAGES)
        : merged;
    });
    setDraft('');
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div
      className={styles.scrim}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Superlive — transmissão ao vivo da Ana Castela"
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

        {/* ── Video stage ─────────────────────────────────── */}
        <div className={styles.videoStage}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className={styles.video}
            src="/feed/simplesmente-acontece.mp4"
            poster="/feed/ana-castela-2.png"
            loop
            muted
            playsInline
          />
          {/* Top-left chrome — live badge + viewer count */}
          <div className={styles.videoOverlayTop}>
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} aria-hidden="true" />
              AO VIVO
            </span>
            <span className={styles.viewers}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {viewers.toLocaleString('pt-BR')}
            </span>
          </div>

          {/* Bottom-left — Ana identity */}
          <div className={styles.videoOverlayBottom}>
            <div className={styles.creator}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ana-castela.png" alt="" className={styles.creatorAvatar} aria-hidden="true" />
              <div className={styles.creatorMeta}>
                <span className={styles.creatorName}>
                  Ana Castela
                  <VerifiedBadge size={13} />
                </span>
                <span className={styles.creatorSub}>Tour Portugal — bate-papo</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.muteBtn}
              onClick={toggleMute}
              aria-label={muted ? 'Ativar som' : 'Silenciar'}
            >
              {muted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M22 9l-6 6M16 9l6 6" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
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
            placeholder="Mande sua mensagem…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
          />
          <button
            type="button"
            className={styles.composerHeart}
            onClick={() => {
              counterRef.current += 1;
              const next: ChatLine = {
                id: counterRef.current,
                fan: {
                  name: 'Você',
                  avatar: 'https://i.pravatar.cc/64?u=me-superlive',
                  tier: 'superfan',
                },
                body: '❤️❤️❤️',
              };
              setLines((curr) =>
                [...curr, next].slice(-MAX_VISIBLE_MESSAGES),
              );
            }}
            aria-label="Mandar coração"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          </button>
          <button
            type="submit"
            className={styles.composerSend}
            disabled={!draft.trim()}
            aria-label="Enviar mensagem"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  );
}
