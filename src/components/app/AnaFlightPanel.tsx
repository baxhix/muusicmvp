'use client';

import { useEffect, useState } from 'react';
import type { AnaFlightPayload } from '@/lib/globeStore';
import { LONDRINA, LISBON } from '@/lib/anaFlight';
import styles from './AnaFlightPanel.module.css';

interface Props {
  payload: AnaFlightPayload | null;
  onClose: () => void;
}

/**
 * Tour Portugal — the modal that opens when a fan taps the
 * airplane marker on the globe.
 *
 * Shows the flight progress (Londrina → Lisboa, hours remaining),
 * Ana's avatar, and a free-form message input the fan can use to
 * send a "good flight" / fan message. The send action is a stub
 * today — wire to a real /api/fan-messages endpoint when one
 * exists. Until then we drop the message into the console + show
 * a success state so the form feels real during user testing.
 *
 * Visually mirrors the AnaCheckInPanel modal (centered card,
 * dark gradient + heavy blur, dismissible on backdrop tap +
 * Escape) so the two surfaces feel like one design system.
 */
export default function AnaFlightPanel({ payload, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState(false);

  // Reset the form when the panel is dismissed so reopening
  // starts fresh — no half-typed drafts lingering between
  // sessions on the same device.
  useEffect(() => {
    if (!payload) {
      setDraft('');
      setSent(false);
    }
  }, [payload]);

  // Escape closes the modal. We don't trap focus here because
  // the panel is mostly read-only — only the textarea and one
  // button to tab through — but Escape feels like a standard
  // dismissal affordance and matches the check-in modal.
  useEffect(() => {
    if (!payload) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [payload, onClose]);

  if (!payload) return null;

  const { progress, arrived, hoursRemaining } = payload;
  const progressPct = Math.round(progress * 100);
  const hoursLabel = arrived
    ? 'Em Lisboa'
    : hoursRemaining < 1
      ? 'Pousando em breve'
      : `Faltam ${Math.round(hoursRemaining)} h`;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    // TODO: POST /api/fan-messages { recipient: 'ana-castela', body }
    console.log('[ana-flight] fan message →', body);
    setSent(true);
  };

  return (
    <div
      className={styles.scrim}
      onClick={onClose}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tour Portugal — Ana Castela em voo"
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

        {/* Hero — Ana avatar + title */}
        <div className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela-fanverse-hero.jpg"
            alt=""
            className={styles.avatar}
            aria-hidden="true"
          />
          <div className={styles.heroText}>
            <span className={styles.kicker}>
              <span className={styles.kickerDot} aria-hidden="true" />
              Em voo agora
            </span>
            <h2 className={styles.title}>Tour Portugal</h2>
            <p className={styles.subtitle}>{hoursLabel}</p>
          </div>
        </div>

        {/* Progress strip — origin label + bar + destination label */}
        <div className={styles.route}>
          <div className={styles.routeEnd}>
            <span className={styles.routeCity}>{LONDRINA.name}</span>
            <span className={styles.routeState}>{LONDRINA.state}</span>
          </div>

          <div className={styles.routeBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
            <div className={styles.routeBarTrack} aria-hidden="true" />
            <div
              className={styles.routeBarFill}
              style={{ width: `${progressPct}%` }}
              aria-hidden="true"
            />
            <span
              className={styles.routeBarPlane}
              style={{ left: `${progressPct}%` }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </div>

          <div className={`${styles.routeEnd} ${styles.routeEndRight}`}>
            <span className={styles.routeCity}>{LISBON.name}</span>
            <span className={styles.routeState}>{LISBON.state}</span>
          </div>
        </div>

        {/* Fan message form */}
        {sent ? (
          <div className={styles.sentState} role="status">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12l5 5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className={styles.sentText}>Mensagem enviada! Boa viagem, Ana 💖</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSend}>
            <label htmlFor="ana-flight-msg" className={styles.formLabel}>
              Mande uma mensagem para a Ana
            </label>
            <textarea
              id="ana-flight-msg"
              className={styles.field}
              placeholder="Boa viagem! Mal posso esperar pelo show…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={400}
              autoFocus={false}
            />
            <div className={styles.formFoot}>
              <span className={styles.counter}>{draft.length}/400</span>
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={!draft.trim()}
              >
                <span>Enviar</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
