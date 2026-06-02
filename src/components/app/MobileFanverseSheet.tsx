'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import {
  MISSION_META,
  TOTAL_MISSIONS,
  SPARKLE_INDICES,
  sumEarnedXp,
  InviteFriendsModal,
  RankingTabContent,
  BenefitsTabContent,
} from './ArtistBox';
import sheetStyles from './MobileFanverseSheet.module.css';
import boxStyles from './ArtistBox.module.css';

/* ============================================================
 * MobileFanverseSheet
 *
 * Painel mobile fullscreen que mostra EXATAMENTE o mesmo
 * conteúdo do ArtistBox (Fanverse Ana Castela) — header com
 * foto + nome + Fanpoints + botão de convites, tab bar
 * Missões/Ranking/Conquistas, e o body da tab ativa.
 *
 * Per product feedback "no mobile, refatore o bloco que aparece
 * ao clicar no ícone de coroa na navbar para ser inserido o
 * conteúdo que tem no box Fanverse Ana Castela com extamente as
 * mesmas informações, hierarquia de dados, etc."
 *
 * Reusa via named imports do ArtistBox os 3 tab content
 * components + dados de missions, evitando duplicação. Os
 * estilos de tab/header também vêm do ArtistBox.module.css —
 * o módulo deste arquivo só layouts próprios do panel
 * (envelope fullscreen + animação slide-up + close button).
 * ============================================================ */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Tab inicial. Default 'ranking' (porque a entrada principal
   *  é o crown do BottomNav, que conceitualmente leva pro
   *  Ranking de Superfãs). */
  defaultTab?: 'missoes' | 'ranking' | 'beneficios';
}

export default function MobileFanverseSheet({
  open,
  onClose,
  defaultTab = 'ranking',
}: Props) {
  type BoxTab = 'missoes' | 'ranking' | 'beneficios';
  const [activeTab, setActiveTab] = useState<BoxTab>(defaultTab);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  const { missions } = useDailyMissions();
  const doneById = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (missions) for (const m of missions) map[m.id] = m.done;
    return map;
  }, [missions]);
  const completed = MISSION_META.filter((m) => doneById[m.id]).length;
  const progress = Math.round((completed / TOTAL_MISSIONS) * 100);
  const fpEarned = sumEarnedXp(MISSION_META, doneById);

  /* Mission celebration burst — mesma mecânica do ArtistBox.
   * Quando uma missão vira "done" enquanto o sheet está aberto,
   * dispara o sparkle por 1.6s. */
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const prevDoneByIdRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!missions || missions.length === 0) return;
    const prev = prevDoneByIdRef.current;
    if (prev === null) {
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

  /* ESC fecha o sheet. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Reset tab pra defaultTab toda vez que o sheet (re)abrir.
   * Evita ficar travado numa tab anterior quando re-abre. */
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  if (!open) return null;

  return (
    <div className={sheetStyles.sheet} role="dialog" aria-modal="true">
      {/* Botão close — fica no canto superior direito. O
       *  MobileRouteHeader (que vive no shell) também dá um back,
       *  mas redundância proposital pra UX. */}
      <button
        type="button"
        className={sheetStyles.closeBtn}
        onClick={onClose}
        aria-label="Fechar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Header — mesma hierarquia do ArtistBox.header: foto +
       *  (label "Fanverse" + name "Ana Castela") + Fanpoints +
       *  Convites pill. Classes vêm do ArtistBox.module.css pra
       *  garantir paridade visual exata. */}
      <div className={`${boxStyles.header} ${sheetStyles.headerOverride}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ana-castela-box.jpg" alt="Ana Castela" className={boxStyles.photo} />
        <div className={boxStyles.info}>
          <div className={boxStyles.nameLine}>
            <span className={boxStyles.label}>Fanverse</span>
            <span className={boxStyles.name}>Ana Castela</span>
          </div>
          <div className={boxStyles.fanpointsInline}>
            <span className={boxStyles.fanpointsInlineValue}>
              {fanpoints.toLocaleString('pt-BR')}
            </span>
            <span className={boxStyles.fanpointsInlineLabel}>Fanpoints</span>
            <span
              role="button"
              tabIndex={0}
              className={boxStyles.invitesBtn}
              onClick={(e) => {
                e.stopPropagation();
                setInviteOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setInviteOpen(true);
                }
              }}
            >
              4 convites
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar — mesmas 3 tabs em mesma ordem. */}
      <div className={boxStyles.discountRow}>
        <div className={boxStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'missoes'}
            className={`${boxStyles.tab} ${activeTab === 'missoes' ? boxStyles.tabActive : ''}`}
            onClick={() => setActiveTab('missoes')}
          >
            Missões
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ranking'}
            className={`${boxStyles.tab} ${activeTab === 'ranking' ? boxStyles.tabActive : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            Ranking
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'beneficios'}
            className={`${boxStyles.tab} ${activeTab === 'beneficios' ? boxStyles.tabActive : ''}`}
            onClick={() => setActiveTab('beneficios')}
          >
            Conquistas
          </button>
        </div>
      </div>

      {/* Body — mesma hierarquia do ArtistBox.dropdown.content:
       *  divisor + conteúdo da tab + (só na Missões) progress. */}
      <div className={sheetStyles.body}>
        <div className={boxStyles.divider} />
        {activeTab === 'ranking' && <RankingTabContent />}
        {activeTab === 'beneficios' && <BenefitsTabContent />}
        {activeTab === 'missoes' && (
          <div className={boxStyles.missionsList}>
            {MISSION_META.map((m) => {
              const isDone = doneById[m.id] ?? false;
              const isCelebrating = celebratingIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`${boxStyles.mission} ${isDone ? boxStyles.missionDone : ''} ${isCelebrating ? boxStyles.missionJustDone : ''}`}
                >
                  <span className={boxStyles.missionIcon}>{m.icon}</span>
                  <div className={boxStyles.missionText}>
                    <span className={boxStyles.missionName}>{m.name}</span>
                  </div>
                  <span className={boxStyles.missionXp}>{m.xp}</span>
                  <div className={boxStyles.missionCheck}>
                    <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 4l2 2 3-3.5" />
                    </svg>
                  </div>
                  {isCelebrating && (
                    <div className={boxStyles.missionSparkles} aria-hidden="true">
                      {SPARKLE_INDICES.map((i) => (
                        <span
                          key={i}
                          className={boxStyles.sparkle}
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

        {activeTab === 'missoes' && (
          <div className={boxStyles.progressWrap}>
            <div className={boxStyles.progressLabel}>
              <span className={boxStyles.progressText}>{completed}/{TOTAL_MISSIONS} missões</span>
              <span className={boxStyles.progressText}>{progress}%</span>
            </div>
            <div className={boxStyles.progressTrack}>
              <div className={boxStyles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {activeTab === 'missoes' && (
          <div className={sheetStyles.missionsTotal}>
            <span className={boxStyles.missionsTitle}>Missões do Dia</span>
            <span className={boxStyles.xpTotal}>{fpEarned} Fanpoints</span>
          </div>
        )}
      </div>

      {inviteOpen && (
        <InviteFriendsModal onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
