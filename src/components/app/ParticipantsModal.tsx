'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api/client';
import type { ApiSuperchatParticipant } from '@/lib/api/types';
import styles from './ParticipantsModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ONLINE_WINDOW_MS = 60_000;

function isOnline(p: ApiSuperchatParticipant): boolean {
  if (!p.lastSeenAt) return false;
  return Date.now() - new Date(p.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

function displayName(p: ApiSuperchatParticipant): string {
  return p.name?.trim() || p.email.split('@')[0];
}

function avatarSrc(p: ApiSuperchatParticipant): string {
  return p.avatarUrl ?? `https://i.pravatar.cc/72?u=${p.id}`;
}

export default function ParticipantsModal({ open, onClose }: Props) {
  const [participants, setParticipants] = useState<ApiSuperchatParticipant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<{ participants: ApiSuperchatParticipant[] }>('/api/superchat/participants')
      .then((res) => {
        if (cancelled) return;
        setParticipants(res.participants);
      })
      .catch((err) => {
        console.error('participants fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof window === 'undefined') return null; // SSR guard

  const online = participants.filter(isOnline);
  const offline = participants.filter((p) => !isOnline(p));

  // Render through a portal into document.body so the backdrop covers
  // the whole viewport even when the modal is mounted INSIDE another
  // position:fixed container (SuperchatPanel) that would otherwise trap
  // it inside its 420px slot via the stacking-context rules.
  return createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Participantes do Superchat"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <div className={styles.headTitleWrap}>
            <h3 className={styles.headTitle}>Participantes</h3>
            <span className={styles.headCount}>
              {participants.length} {participants.length === 1 ? 'pessoa' : 'pessoas'} no Superchat
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.list}>
          {loading && participants.length === 0 ? (
            <div className={styles.empty}>Carregando…</div>
          ) : participants.length === 0 ? (
            <div className={styles.empty}>Ninguém entrou no Superchat ainda.</div>
          ) : (
            <>
              {online.length > 0 && (
                <Section title={`Online · ${online.length}`}>
                  {online.map((p) => (
                    <Row key={p.id} p={p} online />
                  ))}
                </Section>
              )}
              {offline.length > 0 && (
                <Section title={`Offline · ${offline.length}`}>
                  {offline.map((p) => (
                    <Row key={p.id} p={p} online={false} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionEyebrow}>{title}</div>
      <div className={styles.sectionList}>{children}</div>
    </div>
  );
}

function Row({ p, online }: { p: ApiSuperchatParticipant; online: boolean }) {
  return (
    <div className={styles.row}>
      <div className={styles.avatarWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarSrc(p)} alt="" className={styles.avatar} />
        {online && <span className={styles.onlineDot} aria-hidden="true" />}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{displayName(p)}</span>
        {p.city && <span className={styles.city}>{p.city}</span>}
      </div>
    </div>
  );
}
