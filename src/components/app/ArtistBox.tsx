'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ArtistBox.module.css';

const MISSIONS = [
  { id: 1, icon: '🎵', name: 'Ouça 5 músicas hoje',       xp: '+50 FP',  done: true  },
  { id: 2, icon: '❤️', name: 'Reaja a um post no feed',   xp: '+30 FP',  done: false },
  { id: 3, icon: '💬', name: 'Inicie uma conversa',        xp: '+40 FP',  done: false },
  { id: 4, icon: '🔥', name: 'Sequência de 3 dias',        xp: '+120 FP', done: false },
];

const TOTAL     = MISSIONS.length;
const FP_EARNED = MISSIONS.filter(m => m.done).reduce((acc, m) => {
  const n = parseInt(m.xp.replace(/\D/g, ''), 10);
  return acc + n;
}, 0);

export default function ArtistBox() {
  const [done, setDone] = useState<Record<number, boolean>>(
    Object.fromEntries(MISSIONS.map(m => [m.id, m.done]))
  );
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    if (contentRef.current) setContentH(contentRef.current.scrollHeight);
  }, [done]);

  const completed = Object.values(done).filter(Boolean).length;
  const progress  = Math.round((completed / TOTAL) * 100);

  return (
    <div className={styles.box}>

      {/* Artist header — always visible */}
      <div className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ana-castela-box.jpg" alt="Ana Castela" className={styles.photo} />
        <div className={styles.info}>
          <div className={styles.nameLine}>
            <span className={styles.label}>Fanverse</span>
            <span className={styles.name}>Ana Castela</span>
          </div>
          <span className={styles.memberSince}>Membro desde Maio de 2026</span>
        </div>
      </div>

      {/* ── Collapsible content ── */}
      <div
        className={styles.content}
        style={{ maxHeight: open ? `${contentH}px` : '0px' }}
      >
        <div ref={contentRef}>

          <div className={styles.divider} />

          {/* Missions list */}
          <div className={styles.missionsList}>
            {MISSIONS.map(m => (
              <div
                key={m.id}
                className={`${styles.mission} ${done[m.id] ? styles.missionDone : ''}`}
                onClick={() => setDone(d => ({ ...d, [m.id]: !d[m.id] }))}
              >
                <span className={styles.missionIcon}>{m.icon}</span>
                <div className={styles.missionText}>
                  <span className={styles.missionName}>{m.name}</span>
                </div>
                <span className={styles.missionXp}>{m.xp}</span>
                <div className={styles.missionCheck}>
                  <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 4l2 2 3-3.5"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Gradient mask — visible when collapsed */}
      {!open && <div className={styles.contentMask} />}

      {/* Progress bar — always visible */}
      <div className={styles.progressWrap}>
        <div className={styles.progressLabel}>
          <span className={styles.progressText}>{completed}/{TOTAL} missões</span>
          <span className={styles.progressText}>{progress}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── Always-visible footer ── */}
      <div className={styles.footer} onClick={() => setOpen(o => !o)}>
        <div className={styles.footerRow}>
          <span className={styles.missionsTitle}>Missões do Dia</span>
          <span className={styles.xpTotal}>{FP_EARNED} Fanpoints</span>
        </div>
        <div className={styles.footerArrow}>
          <svg
            className={`${styles.footerChevron} ${open ? styles.footerChevronOpen : ''}`}
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M5 9l7 7 7-7"/>
          </svg>
        </div>
      </div>

    </div>
  );
}
