'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import VerifiedBadge from './VerifiedBadge';
import FanverseCore from '@/components/animations/FanverseCore';
import {
  MISSION_META,
  TOTAL_MISSIONS as TOTAL,
  sumEarnedXp,
  RankingTabContent,
} from './ArtistBox';
import { MaterialsTabContent } from './MaterialsTabContent';
import styles from './ArtistBoxRail.module.css';
/* Reuso direto do CSS do ArtistBox desktop pra que as tabs + a tab
 * Missões fiquem idênticas (mesma ordem, segmented-control com pill
 * animado, mesmos cards). */
import boxStyles from './ArtistBox.module.css';

/**
 * ArtistBoxRail — versão compacta vertical do ArtistBox usada em
 * desktop pequeno (769-1440px). Renderiza um rail estreito
 * (~52px) de ícones empilhados; click em qualquer ícone abre um
 * flyout lateral à direita com o conteúdo da tab correspondente
 * (mesmo padrão visual do ArtistBox grande).
 *
 * Ícones do rail:
 *   1. Avatar Ana Castela → abre flyout (default tab missoes)
 *   2. Fanverse Orbe → abre o overlay FanverseSearch
 *   3. Missões (target) → abre flyout na tab missoes
 *   4. Superfãs (coroa) → abre flyout na tab ranking
 *   5. Materiais (pasta) → abre flyout na tab materiais
 *   6. Vídeo (play) → dispatcha app:fanverse-open-video, que o
 *      NowPlaying escuta pra entrar em modo video
 *
 * NOTA: a tab "Conquistas" foi removida pra reduzir o número de
 * tabs visíveis pra 3. O conteúdo de benefícios virou um link
 * inline dentro da tab Superfãs (ver ArtistBox.tsx RankingTabContent).
 *
 * Renderização condicional vive em ArtistBox.tsx — quando
 * useIsSmallDesktop() é true, ArtistBox retorna <ArtistBoxRail />
 * em vez do box grande. >1440px renderiza o box como sempre.
 */
type Tab = 'missoes' | 'ranking' | 'materiais';

export default function ArtistBoxRail() {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('missoes');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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
  const progress = Math.round((completed / TOTAL) * 100);
  const fpEarned = sumEarnedXp(MISSION_META, doneById);

  /* Click fora NÃO fecha mais o flyout (per feedback): ele só fecha
   * pela seta de voltar no topo, clicando de novo na foto de perfil
   * (toggle) ou via Escape. Sem listener de click-outside. */

  /* Escape fecha o flyout. */
  useEffect(() => {
    if (!flyoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlyoutOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [flyoutOpen]);

  /* CTA "Ver materiais" do feed post material_alert: abre o flyout
   * direto na tab Materiais. ArtistBox grande tem o próprio listener
   * em sua scope. */
  useEffect(() => {
    const handler = () => {
      setActiveTab('materiais');
      setFlyoutOpen(true);
    };
    window.addEventListener('app:fanverse-open-materials', handler);
    return () => window.removeEventListener('app:fanverse-open-materials', handler);
  }, []);

  const openTab = (tab: Tab) => {
    setActiveTab(tab);
    setFlyoutOpen(true);
  };

  const openFanverseSearch = () => {
    try {
      window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
    } catch { /* SSR */ }
  };

  const openVideo = () => {
    try {
      window.dispatchEvent(new CustomEvent('app:fanverse-open-video'));
    } catch { /* SSR */ }
  };

  /* Carrinho — abre o modal Ranking Fanverse direto na tab Loja
   * (mesmo modal de 4 tabs: Classificação · Minha evolução · Jornada
   * · Loja). */
  const openStore = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('app:open-ranking-store', { detail: { screen: 'loja' } }),
      );
    } catch { /* SSR */ }
  };

  return (
    <div ref={wrapperRef} className={styles.wrap}>
      {/* ── Rail vertical (sempre visível) ─────────────────────── */}
      <nav className={styles.rail} aria-label="Fanverse Ana Castela">
        {/* Avatar — clique abre flyout na tab missões + faz papel
         * de "identidade" do box. */}
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.avatarBtn} ${flyoutOpen ? styles.iconBtnActive : ''}`}
          onClick={() => (flyoutOpen ? setFlyoutOpen(false) : openTab('missoes'))}
          aria-label={flyoutOpen ? 'Fechar Fanverse Ana Castela' : 'Abrir Fanverse Ana Castela'}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela-fanverse-desktop.jpg"
            alt="Ana Castela"
            className={styles.avatarImg}
          />
          <Tooltip>Ana Castela</Tooltip>
        </button>

        {/* Orbe Fanverse Search */}
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.orbBtn}`}
          onClick={openFanverseSearch}
          aria-label="Abrir Fanverse Search"
        >
          <span className={styles.orbInner} aria-hidden="true">
            <FanverseCore />
          </span>
          <Tooltip>Fanverse Search</Tooltip>
        </button>

        {/* Divider sutil entre identidade e seções */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Missões */}
        <button
          type="button"
          className={`${styles.iconBtn} ${activeTab === 'missoes' && flyoutOpen ? styles.iconBtnActive : ''}`}
          onClick={() => openTab('missoes')}
          aria-label="Missões"
        >
          <IconTarget />
          {completed > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {completed}
            </span>
          )}
          <Tooltip>Missões</Tooltip>
        </button>

        {/* Superfãs (Ranking) */}
        <button
          type="button"
          className={`${styles.iconBtn} ${activeTab === 'ranking' && flyoutOpen ? styles.iconBtnActive : ''}`}
          onClick={() => openTab('ranking')}
          aria-label="Superfãs"
        >
          <IconCrown />
          <Tooltip>Superfãs</Tooltip>
        </button>

        {/* Materiais — pastas que a Central de Fãs compartilha. */}
        <button
          type="button"
          className={`${styles.iconBtn} ${activeTab === 'materiais' && flyoutOpen ? styles.iconBtnActive : ''}`}
          onClick={() => openTab('materiais')}
          aria-label="Materiais"
        >
          <IconFolder />
          <Tooltip>Materiais</Tooltip>
        </button>

        {/* Loja — carrinho que abre o modal Ranking Fanverse na tab Loja. */}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={openStore}
          aria-label="Loja"
        >
          <IconCart />
          <Tooltip>Loja</Tooltip>
        </button>

        {/* Divider antes do atalho do vídeo */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Atalho de vídeo — dispatcha pro NowPlaying entrar em modo
         * vídeo (player flutuante no rodapé expande pra 320×180 com
         * iframe YouTube). */}
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.videoBtn}`}
          onClick={openVideo}
          aria-label="Assistir vídeo"
        >
          <IconPlay />
          <Tooltip>Vídeo</Tooltip>
        </button>
      </nav>

      {/* ── Flyout lateral (visível só com flyoutOpen) ─────────── */}
      {flyoutOpen && (
        <div
          className={styles.flyout}
          role="dialog"
          aria-modal="false"
          aria-label="Fanverse Ana Castela"
        >
          {/* Seta de voltar — único jeito (junto do toggle no avatar)
           * de fechar o flyout. Flutua no topo-esquerdo sobre o hero. */}
          <button
            type="button"
            className={styles.flyoutBack}
            onClick={() => setFlyoutOpen(false)}
            aria-label="Voltar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Header do flyout — foto + nome + verified + Fanpoints */}
          <div className={styles.flyoutHeader}>
            <div className={styles.flyoutHero}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ana-castela-fanverse-desktop.jpg"
                alt="Ana Castela"
                className={styles.flyoutHeroImg}
              />
              <div className={styles.flyoutHeroGradient} />
              <div className={styles.flyoutTitleBlock}>
                <span className={styles.flyoutEyebrow}>Fanverse</span>
                <div className={styles.flyoutTitleRow}>
                  <span className={styles.flyoutTitleName}>Ana Castela</span>
                  <VerifiedBadge size={18} className={styles.flyoutVerified} />
                </div>
                <div className={styles.flyoutMeta}>
                  <span className={styles.flyoutMetaValue}>
                    {fanpoints.toLocaleString('pt-BR')}
                  </span>
                  <span className={styles.flyoutMetaLabel}>Fanpoints</span>
                </div>
              </div>
            </div>

            {/* Tab bar — MESMO estilo e ordem do ArtistBox desktop:
             * segmented control com pill animado (Superfãs / Missões /
             * Exclusivo). Reusa boxStyles + motion (layoutId próprio). */}
            <div className={styles.flyoutTabs}>
              <div className={boxStyles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'ranking'}
                  className={boxStyles.tab}
                  onClick={() => setActiveTab('ranking')}
                >
                  {activeTab === 'ranking' && (
                    <motion.span
                      layoutId="railTabPill"
                      className={boxStyles.tabPill}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className={boxStyles.tabLabel}>Superfãs</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'missoes'}
                  className={boxStyles.tab}
                  onClick={() => setActiveTab('missoes')}
                >
                  {activeTab === 'missoes' && (
                    <motion.span
                      layoutId="railTabPill"
                      className={boxStyles.tabPill}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className={boxStyles.tabLabel}>Missões</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'materiais'}
                  className={boxStyles.tab}
                  onClick={() => setActiveTab('materiais')}
                >
                  {activeTab === 'materiais' && (
                    <motion.span
                      layoutId="railTabPill"
                      className={boxStyles.tabPill}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className={boxStyles.tabLabel}>Exclusivo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Body — switch por tab. RankingTabContent vem exportado
           * do ArtistBox.tsx (reuso direto) — ele já carrega o link
           * inline pra Conquistas (BenefitsTabContent). Missões tem
           * render inline simplificado (sem sparkle celebration). */}
          <div className={styles.flyoutBody}>
            {activeTab === 'missoes' && (
              <>
                {/* Header + lista + barra IDÊNTICOS ao ArtistBox desktop
                 * (boxStyles): "Missões do dia" + info na esquerda, total
                 * de Fanpoints na mesma linha à direita; cada card com
                 * ícone | nome | check | +FP na MESMA linha. */}
                <div className={boxStyles.missionsHeader}>
                  <span className={boxStyles.missionsTitle}>
                    Missões do dia
                    <span
                      className={boxStyles.missionsInfo}
                      role="img"
                      aria-label="Cada dia uma missão diferente. Aproveite!"
                      data-tooltip="Cada dia uma missão diferente. Aproveite!"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </span>
                  </span>
                  <span className={boxStyles.xpTotal}>{fpEarned} Fanpoints</span>
                </div>
                <div className={boxStyles.missionsList}>
                  {MISSION_META.map((m) => {
                    const isDone = doneById[m.id] ?? false;
                    return (
                      <div
                        key={m.id}
                        className={`${boxStyles.mission} ${isDone ? boxStyles.missionDone : ''}`}
                      >
                        <span className={boxStyles.missionIcon}>{m.icon}</span>
                        <div className={boxStyles.missionText}>
                          <span className={boxStyles.missionName}>{m.name}</span>
                        </div>
                        <div className={boxStyles.missionCheck}>
                          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1.5 4l2 2 3-3.5" />
                          </svg>
                        </div>
                        <span className={boxStyles.missionXp}>{m.xp}</span>
                      </div>
                    );
                  })}
                </div>
                <div className={boxStyles.progressWrap}>
                  <div className={boxStyles.progressTrack}>
                    <div
                      className={boxStyles.progressFill}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </>
            )}
            {activeTab === 'ranking' && <RankingTabContent />}
            {activeTab === 'materiais' && <MaterialsTabContent />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Tooltip — mostra label à direita do ícone no hover. CSS faz
 * o controle de opacity/transform via `:hover .tooltip` no parent.
 * ============================================================ */
function Tooltip({ children }: { children: React.ReactNode }) {
  return <span className={styles.tooltip}>{children}</span>;
}

/* ============================================================
 * Ícones inline — todos 18-22px, viewBox 0 0 24 24. Usam
 * currentColor pra herdar do .iconBtn.
 * ============================================================ */
function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconCrown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 4h2.4l2 11.2a1.7 1.7 0 0 0 1.7 1.4h8.2a1.7 1.7 0 0 0 1.7-1.3L21.5 7H6" />
    </svg>
  );
}
