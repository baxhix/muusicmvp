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
  // Default to OPEN on desktop so the box still reads as the
  // permanently-visible "Fanverse card" it always was — but the
  // toggle now genuinely flips the dropdown closed (see the
  // updated CSS below: the desktop `max-height: none` override
  // is gone, so the .boxOpen / max-height transition runs on
  // every viewport).
  //
  // On mobile the box is `display: none` entirely (per the
  // existing @media block), so this initial value is a no-op
  // there.
  const [open, setOpen] = useState(true);

  /* Tab ativa no corpo do box, per product feedback "no lugar do
   * badge 15% OFF, adicionar três tabs: Missões, Ranking, Meus
   * benefícios". Tab bar segue o mesmo padrão visual do
   * SuperfansPanel (.tabs/.tab/.tabActive). Default: 'missoes' —
   * preserva o comportamento atual de mostrar a lista de missões
   * + progresso. Outras tabs mostram placeholder "Em breve"
   * (implementação completa fica pro próximo round). */
  type BoxTab = 'missoes' | 'ranking' | 'beneficios';
  const [activeTab, setActiveTab] = useState<BoxTab>('missoes');
  // contentRef is retained because the inner missions list still
  // references it via ref (legacy — kept so the layout doesn't
  // collapse to 0 if the missions container is queried for
  // scrollHeight by any future feature like auto-scroll).
  const contentRef = useRef<HTMLDivElement>(null);

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

  // ── Per-mission completion celebration ──
  //
  // Per product feedback "Ao concluir cada tarefa, adicione as
  // animações festivas dentro do box" — every time a mission
  // transitions from open → done, the box pops a brief sparkle
  // burst inside the row + a row glow pulse. Multiple
  // completions can overlap; each id gets a 1.6s timer that
  // peels it back out of the `celebratingIds` set when the
  // animation finishes.
  //
  // The previous done-state-by-mission lives in `prevDoneByIdRef`
  // so the effect only celebrates the TRANSITION, not the
  // steady "this mission is already done" state visible on
  // every render after the user reloads the page.
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const prevDoneByIdRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!missions || missions.length === 0) return;
    const prev = prevDoneByIdRef.current;
    if (prev === null) {
      // First population — record the baseline without
      // celebrating anything. Otherwise reloading the app on a
      // 5/5 day would spray confetti for every mission.
      prevDoneByIdRef.current = doneById;
      return;
    }
    const newlyDone: string[] = [];
    for (const m of missions) {
      if (m.done && !prev[m.id]) newlyDone.push(m.id);
    }
    if (newlyDone.length === 0) {
      prevDoneByIdRef.current = doneById;
      return;
    }
    setCelebratingIds((curr) => {
      const next = new Set(curr);
      for (const id of newlyDone) next.add(id);
      return next;
    });
    const timeouts = newlyDone.map((id) =>
      window.setTimeout(() => {
        setCelebratingIds((curr) => {
          const next = new Set(curr);
          next.delete(id);
          return next;
        });
      }, 1600),
    );
    prevDoneByIdRef.current = doneById;
    return () => {
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [missions, doneById]);

  // ── Pulse the chevron when the user earns Fanpoints ──
  //
  // The `app:points-awarded` CustomEvent fires anywhere
  // `awardPoints()` runs (likes, comments, sends, chat starts,
  // every-3-streams). The PointsToast hooks the same event to
  // surface a "+10 FP" toast; we add a complementary affordance
  // here — a brief glow on the chevron — so the user knows where
  // the new total went, even if they missed the toast. ~1.5s,
  // then auto-cleared so the pulse is single-shot, not nagging.
  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onAwarded = () => {
      setPulsing(true);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setPulsing(false), 1500);
    };
    window.addEventListener('app:points-awarded', onAwarded);
    return () => {
      window.removeEventListener('app:points-awarded', onAwarded);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  return (
    <div className={`${styles.box} ${open ? styles.boxOpen : ''}`}>

      {/* Compact header pill — always visible. Pinned to the
       *  top-left so it shares the same horizontal axis as the
       *  TopBar avatar on the right. Click anywhere on it to
       *  toggle the dropdown below. */}
      <button
        type="button"
        className={`${styles.compactBar} ${pulsing ? styles.compactBarPulsing : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Fechar Fanverse' : 'Abrir Fanverse'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ana-castela-box.jpg"
          alt=""
          className={styles.compactPhoto}
        />
        <span className={styles.compactName}>Ana Castela</span>
        <span className={styles.compactFanpoints}>
          {/* Crown icon — Fanverse points indicator. Was a 5-point
           *  star; product feedback wanted a crown to align with
           *  the "Superfã" identity. The peaks-to-baseline path
           *  reads as a crown at any size from 12-24px. */}
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
          </svg>
          {fanpoints.toLocaleString('pt-BR')}
        </span>
        <svg
          className={`${styles.compactChevron} ${open ? styles.compactChevronOpen : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>

      {/* Artist header + discount badge — both ALWAYS visible
       *  per product feedback "A versão retraída do box
       *  Fanverse Ana Castela deve ser até o fim do badge de
       *  15% off e não ficar apenas uma linha". Previously
       *  these lived INSIDE `.dropdown` so they collapsed
       *  alongside the missions list; now they're siblings of
       *  `.dropdown` (and of the `.compactBar` pill that's
       *  desktop-hidden), guaranteeing the collapsed view
       *  always shows photo + name + Fanpoints + the discount
       *  pill before any toggle. */}
      <div className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ana-castela-box.jpg" alt="Ana Castela" className={styles.photo} />
        <div className={styles.info}>
          <div className={styles.nameLine}>
            <span className={styles.label}>Fanverse</span>
            <span className={styles.name}>Ana Castela</span>
          </div>
          {/* Fanpoints sits IMMEDIATELY below the name per product
              feedback "deixe o número de fanpoints logo abaixo do
              nome". The earlier bottom-alignment (justify-content:
              space-between on `.info`) was retired — the row now
              flows naturally under the name with a tight gap. */}
          <div className={styles.fanpointsInline}>
            <span className={styles.fanpointsInlineIcon} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
              </svg>
            </span>
            <span className={styles.fanpointsInlineValue}>
              {fanpoints.toLocaleString('pt-BR')}
            </span>
            <span className={styles.fanpointsInlineLabel}>Fanpoints</span>
          </div>
        </div>
        {/* Chevron moved OUT of the header row per product
            feedback "a seta a frente do cupom de 15% off" — it
            now leads the discount-badge row below this header
            instead of sitting alone in the top-right corner. */}
      </div>

      {/* Discount row — chevron toggle lives at the LEFT (in
       *  front of the coupon pill) per product feedback "a seta
       *  a frente do cupom de 15% off". The expand/collapse
       *  control thereby reads as the entry point into the
       *  collapsible content below, and the header row becomes
       *  cleaner (just photo + name + fanpoints, no trailing
       *  affordance). */}
      <div className={styles.discountRow}>
        <button
          type="button"
          className={`${styles.headerToggle} ${pulsing ? styles.headerTogglePulsing : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Fechar Fanverse' : 'Abrir Fanverse'}
        >
          <svg
            className={`${styles.headerToggleChevron} ${open ? styles.headerToggleChevronOpen : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
        {/* Tab bar — substitui o antigo badge "15% OFF Ativado na
         * Loja da Boiadeira" per product feedback. Mesmo padrão
         * visual do SuperfansPanel (segmented control inset com
         * .tabs/.tab/.tabActive). Switch do conteúdo do dropdown
         * acontece abaixo, no body. */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'missoes'}
            className={`${styles.tab} ${activeTab === 'missoes' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('missoes'); if (!open) setOpen(true); }}
          >
            Missões
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ranking'}
            className={`${styles.tab} ${activeTab === 'ranking' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('ranking'); if (!open) setOpen(true); }}
          >
            Ranking
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'beneficios'}
            className={`${styles.tab} ${activeTab === 'beneficios' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('beneficios'); if (!open) setOpen(true); }}
          >
            Meus benefícios
          </button>
        </div>
      </div>

      {/* Drop-down body — collapsed by default, animates open via
       *  the .boxOpen modifier on the wrapper above. Now hosts
       *  ONLY the missions list + progress + footer. The artist
       *  header + discount badge moved above this wrapper so
       *  they stay visible in the collapsed state. */}
      <div className={styles.dropdown}>

      {/* Missions list — the dropdown wrapper above already
       *  collapses/expands the whole body, so we don't need the
       *  inner maxHeight clipper anymore. Mission rows are always
       *  laid out when the dropdown is open. */}
      <div className={styles.content}>
        <div ref={contentRef}>
          <div className={styles.divider} />
          {/* Body switch por tab. 'missoes' = lista atual; demais
           * mostram placeholder "Em breve" até conteúdo real ser
           * implementado. */}
          {activeTab !== 'missoes' && (
            <div className={styles.tabPlaceholder}>
              <span className={styles.tabPlaceholderTitle}>
                {activeTab === 'ranking' ? 'Ranking' : 'Meus benefícios'}
              </span>
              <span className={styles.tabPlaceholderHint}>Em breve</span>
            </div>
          )}
          {activeTab === 'missoes' && (
          <div className={styles.missionsList}>
            {MISSION_META.map((m) => {
              const isDone = doneById[m.id] ?? false;
              const isCelebrating = celebratingIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`${styles.mission} ${isDone ? styles.missionDone : ''} ${isCelebrating ? styles.missionJustDone : ''}`}
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
                  {/* Sparkle burst overlay — appears for ~1.6s
                      after a mission transitions to done. 5
                      small particles scatter horizontally with
                      different rise + fade timings so the burst
                      reads as organic festivity rather than a
                      static graphic. See `.missionSparkles` +
                      `.sparkle` in the module CSS. */}
                  {isCelebrating && (
                    <div className={styles.missionSparkles} aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={styles.sparkle}
                          style={
                            {
                              ['--sp-x' as string]: `${(i - 2) * 14}px`,
                              ['--sp-delay' as string]: `${i * 60}ms`,
                            } as React.CSSProperties
                          }
                        >
                          <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" />
                          </svg>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {/* Progress bar — só na tab Missões (mede missões do dia). */}
      {activeTab === 'missoes' && (
      <div className={styles.progressWrap}>
        <div className={styles.progressLabel}>
          <span className={styles.progressText}>{completed}/{TOTAL} missões</span>
          <span className={styles.progressText}>{progress}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
      )}

      {/* Dropdown footer — closes the dropdown (toggle). */}
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

      </div>  {/* /dropdown */}
    </div>
  );
}
