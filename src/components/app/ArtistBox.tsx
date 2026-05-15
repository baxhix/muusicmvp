'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  type DailyMissionId,
  useDailyMissions,
} from '@/hooks/useDailyMissions';
import styles from './ArtistBox.module.css';

// Loja da Boiadeira — official Ana Castela store. Same URL the
// TopBar drawer points to, duplicated here so the ArtistBox stays
// a self-contained module (importing TopBar internals would couple
// the two surfaces unnecessarily).
const STORE_URL =
  'https://lojaanacastela.com.br/?srsltid=AfmBOoqO3lURzf9V03K4wnnoPrXa2sFOUu2r7DE9TJguEVZbdzGrWpka';

/**
 * Per-mission display metadata. Stays client-side because there's no
 * reason for the server to ship icons + Portuguese copy on every
 * /api/me/missions call. The server returns just { id, progress,
 * target, done }; we stitch the rest here.
 *
 * `xp` is the reward awarded once the mission is complete — same
 * semantics as the old mock, but now stitched by id.
 */
interface MissionMeta {
  id: DailyMissionId;
  icon: string;
  name: string;
  xp: string;
}

const MISSION_META: MissionMeta[] = [
  { id: 'listen_5',    icon: '🎵', name: 'Ouça 5 músicas hoje',     xp: '+50 FP'  },
  { id: 'like_track',  icon: '❤️', name: 'Curtir uma música',        xp: '+30 FP'  },
  { id: 'start_chat',  icon: '💬', name: 'Inicie uma conversa',      xp: '+40 FP'  },
  { id: 'daily_login', icon: '🔥', name: 'Login diário',              xp: '+120 FP' },
];

const TOTAL = MISSION_META.length;

/** Sum of XP across only the missions currently completed. */
function sumEarnedXp(
  meta: MissionMeta[],
  doneById: Record<string, boolean>,
): number {
  return meta
    .filter((m) => doneById[m.id])
    .reduce(
      (acc, m) => acc + parseInt(m.xp.replace(/\D/g, ''), 10),
      0,
    );
}

export default function ArtistBox() {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);

  // Logged-in user's current Fanpoints balance — fetched live via
  // useUserProfile so it stays accurate when the user earns/spends
  // FP elsewhere.
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  // Live daily-mission progress from the platform's real activity
  // (listening_history, track_likes, user_activities). Polled every
  // 60s + on demand via refresh().
  const { missions } = useDailyMissions();

  // Map "id → done" for the metadata renderer below.
  const doneById = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (missions) for (const m of missions) map[m.id] = m.done;
    return map;
  }, [missions]);

  const completed = MISSION_META.filter((m) => doneById[m.id]).length;
  const progress  = Math.round((completed / TOTAL) * 100);
  const fpEarned  = sumEarnedXp(MISSION_META, doneById);

  // Remeasure the collapsible height whenever the missions change
  // (e.g. a flip from not-done to done changes the rendered marker).
  useEffect(() => {
    if (contentRef.current) setContentH(contentRef.current.scrollHeight);
  }, [doneById]);

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

      {/* Wallet row — Fanpoints balance on the left + "Conheça os
          benefícios" CTA on the right. The CTA used to be the
          "Loja da Boiadeira" affiliate link; per product feedback
          the benefits surface is now the primary action up here,
          and the store link moved into the discount badge below
          (with the "15% OFF" context attached). */}
      <div className={styles.walletRow}>
        <div className={styles.fanpointsRow}>
          <span className={styles.fanpointsIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.3 21.4 12 18 5.7 21.4 7 14.4 2 9.5 8.9 8.6 12 2" />
            </svg>
          </span>
          <span className={styles.fanpointsValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.fanpointsLabel}>Fanpoints</span>
        </div>

        {/* Conheça os benefícios — pill-styled secondary CTA (no
            arrow / no icon, per product feedback). Toggles the
            collapsible missions list below, same affordance the
            footer "Missões do Dia" row offers. When a dedicated
            benefits surface ships, route the click there. */}
        <button
          type="button"
          className={styles.storeLink}
          onClick={() => setOpen((o) => !o)}
        >
          Meus benefícios
        </button>
      </div>

      {/* Earned-discount badge that doubles as the Loja da
          Boiadeira CTA — cart icon, percent in white-bold, store
          name in muted gray. Tinted green to read as a reward,
          but border-less per product feedback so it sits softer
          against the artist box. Clicking opens the store in a
          new tab. */}
      <a
        className={styles.discountBadge}
        href={STORE_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        <span className={styles.discountIcon} aria-hidden="true">
          {/* Unlocked padlock — the shackle tilts up with only its
              left leg connecting to the body, signalling "you've
              unlocked this benefit". Replaced the cart icon per
              product feedback so the badge reads as a reward
              affordance again (the destination is still the
              store, but the cue up front is "unlocked"). */}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7.5" width="10" height="6.5" rx="1.4" />
            <path d="M5.2 7.5V5.2a2.8 2.8 0 0 1 5.4-1" />
          </svg>
        </span>
        <span className={styles.discountText}>
          <strong>15% OFF</strong> na Loja da Boiadeira
        </span>
      </a>

      {/* ── Collapsible content ── */}
      <div
        className={styles.content}
        style={{ maxHeight: open ? `${contentH}px` : '0px' }}
      >
        <div ref={contentRef}>

          <div className={styles.divider} />

          {/* Missions list — done/not-done driven by the server.
              Click is a no-op now since check state is computed
              from real activity (used to toggle local state). */}
          <div className={styles.missionsList}>
            {MISSION_META.map((m) => {
              const isDone = doneById[m.id] ?? false;
              return (
                <div
                  key={m.id}
                  className={`${styles.mission} ${isDone ? styles.missionDone : ''}`}
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
              );
            })}
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
          <span className={styles.xpTotal}>{fpEarned} Fanpoints</span>
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
