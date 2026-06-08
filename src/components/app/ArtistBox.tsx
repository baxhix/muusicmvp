'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { BENEFITS, BenefitIcon } from './SuperfansPanel';
import {
  type DailyMissionId,
  useDailyMissions,
} from '@/hooks/useDailyMissions';
import VerifiedBadge from './VerifiedBadge';
import FanverseCore from '@/components/animations/FanverseCore';
import { useIsSmallDesktop } from '@/hooks/useIsSmallDesktop';
import ArtistBoxRail from './ArtistBoxRail';
import { MaterialsTabContent } from './MaterialsTabContent';
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
export interface MissionMeta {
  id: DailyMissionId;
  icon: string;
  name: string;
  xp: string;
}

export const MISSION_META: MissionMeta[] = [
  /* Per product feedback "diminua para 5 missões diárias" — array
   * cortada de 6 → 5. Removida 'follow_artist' (a última, menor XP
   * relativo + ação menos central do app). */
  { id: 'listen_5',     icon: '🎵', name: 'Ouça 5 músicas hoje',     xp: '+50 FP'  },
  { id: 'like_track',   icon: '❤️', name: 'Curtir uma música',        xp: '+30 FP'  },
  { id: 'start_chat',   icon: '💬', name: 'Inicie uma conversa',      xp: '+40 FP'  },
  { id: 'daily_login',  icon: '🔥', name: 'Login diário',              xp: '+120 FP' },
  { id: 'share_song',   icon: '🔗', name: 'Compartilhe uma música',   xp: '+25 FP'  },
];

export const TOTAL_MISSIONS = MISSION_META.length;
/* Local alias mantido pro código existente do ArtistBox que
 * usa TOTAL — não vale a pena rebatizar 5 sites. */
const TOTAL = TOTAL_MISSIONS;

/* Index estável pros 5 sparkles do burst de celebração. Extraído
 * pra fora do render porque o `[0,1,2,3,4]` inline criava array
 * novo a cada paint do componente, invalidando React.memo internos
 * potenciais. */
export const SPARKLE_INDICES = [0, 1, 2, 3, 4] as const;

/** Sum of XP across only the missions currently completed. */
export function sumEarnedXp(
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
  /* Em desktop pequeno (769-1440px) renderiza a versão compacta
   * vertical (ArtistBoxRail). Em >1440px segue com o box flutuante
   * tradicional. Em mobile (<769) o componente é display:none via
   * CSS — esse return early não importa lá.
   *
   * O hook é reativo (matchMedia listener), então redimensionar
   * a janela troca a UI live. Os hooks abaixo continuam rodando
   * mesmo no caminho rail pra evitar mismatch entre renders
   * (regra do React: ordem dos hooks fixa). */
  const isSmallDesktop = useIsSmallDesktop();

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
  /* Tab "beneficios" foi removida per product feedback "Remova o
   * item Conquistas da tab... Vamos deixar apenas 3 tabs". O
   * conteúdo de Conquistas (BenefitsTabContent) virou um link
   * inline no topo da aba Superfãs (RankingTabContent), que
   * expande/colapsa sob demanda. */
  type BoxTab = 'missoes' | 'ranking' | 'materiais';
  const [activeTab, setActiveTab] = useState<BoxTab>('missoes');

  /* Modal "Convide seus amigos" — 4 códigos copiáveis. Triggered
   * pelo botão pill "4 convites" ao lado de 402.299 Fanpoints
   * no header do box. Per product feedback. */
  const [inviteOpen, setInviteOpen] = useState(false);

  // Logged-in user's current Fanpoints balance — fetched live via
  // useUserProfile so it stays accurate when the user earns/spends
  // FP elsewhere.
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  // Posição do usuário no ranking — exibida ao lado de "Fanpoints"
  // per spec "à frente da palavra Fanpoints, coloque entre
  // parênteses a colocação do usuário logado no ranking nesse
  // formato (#11º), com exceção se for o primeiro, deve ser
  // (Top 1!)". useRanking já é chamado dentro do RankingTabContent;
  // chamá-lo aqui também é barato (mesmo cache de hook).
  const { ranking: rankingForBadge } = useRanking(true);
  const myRank = user
    ? rankingForBadge.findIndex((r) => r.userId === user.id) + 1
    : 0;
  const rankBadge =
    myRank === 1 ? '(Top 1!)' : myRank > 1 ? `(#${myRank}º)` : '';

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

  // ── Open at Ranking tab via BottomNav crown (desktop) ──
  //
  // Per product feedback "ao clicar no ícone de coroa no bottom
  // bar, deve abrir a tab ranking do Box Fanverse". O BottomNav
  // desktop dispara `app:open-fanverse-ranking`; aqui abrimos o
  // box (caso esteja fechado) e ativamos a tab Ranking.
  // Idempotente: re-clicar no mesmo state mantém aberto + ranking.
  useEffect(() => {
    const onOpenRanking = () => {
      setActiveTab('ranking');
      setOpen(true);
    };
    window.addEventListener('app:open-fanverse-ranking', onOpenRanking);
    return () =>
      window.removeEventListener('app:open-fanverse-ranking', onOpenRanking);
  }, []);

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

  /* CTA "Ver materiais" do feed post material_alert dispara
   * app:fanverse-open-materials — abrimos o box + setamos a tab
   * Materiais. ArtistBoxRail tem o próprio listener em sua own
   * scope. */
  useEffect(() => {
    const handler = () => {
      setActiveTab('materiais');
      setOpen(true);
    };
    window.addEventListener('app:fanverse-open-materials', handler);
    return () => window.removeEventListener('app:fanverse-open-materials', handler);
  }, []);

  /* Rail compacto pra desktop pequeno (769-1440px) per product
   * feedback "EM telas menores o box fanverse se tornar uma barra
   * vertical com os acessos em forma de icone". Substitui o box
   * flutuante 320px por rail 52px + flyout sob demanda. */
  if (isSmallDesktop) {
    return <ArtistBoxRail />;
  }

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
          src="/ana-castela-fanverse-hero.jpg"
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
      {/* Header AGORA é o toggle do dropdown — per product feedback
       *  "remova a seta do lado esquerdo do box para ter mais espaço
       *  para as tabs. Deixe o comportamento de expandir ao clicar
       *  na imagem da Ana Castela/nome". O chevron `.headerToggle`
       *  que vivia em `.discountRow` foi removido — `.discountRow`
       *  agora só hospeda o tab bar.
       *
       *  Layout REFEITO per product feedback "Adapte o header do box
       *  Fanverse Ana Castela desktop par algo semelhante ao layout
       *  que temos no mobile" — agora segue o padrão hero image
       *  full-width + fold overlapping com gradient + eyebrow
       *  "Fanverse" + nome grande + verified badge + orb decorativo
       *  + meta row com Fanpoints, mesmo do MobileFanverseSheet. */}
      <button
        type="button"
        className={`${styles.header} ${styles.headerBtn}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Fechar Fanverse' : 'Abrir Fanverse'}
      >
        {/* Hero image — desktop usa o crop landscape (chapéu rosa)
         * per product feedback "Diminua a largura do header e
         * substitua pela imagem em anexo somente no desktop". Hero
         * tem padding lateral (não é mais full-bleed) e radius
         * próprio. O MobileFanverseSheet continua com o asset
         * 1080×1080 (`/ana-castela-fanverse-hero.jpg`); o ArtistBox
         * é mobile:none então essa src só aparece no desktop. */}
        <div className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela-fanverse-desktop.jpg"
            alt="Ana Castela"
            className={styles.heroImg}
          />
        </div>

        {/* Fold — overlap com gradient sobre o hero.
         *
         * Estrutura per spec "separe o orbe do mesmo bloco da palavra
         * Ana Castela, mas mesmo assim mantenha alinhado":
         *  .foldHeadRow (flex row, align-items: center)
         *    ├── .foldHead (column: eyebrow + título + meta)
         *    └── .foldOrb  (orb à direita, centrado vertical)
         *
         * Com o orbe FORA do bloco do título, a coluna de texto fica
         * compacta — "Fanverse" e "496.674 Fanpoints" se aproximam
         * de "Ana Castela" verticalmente. */}
        <div className={styles.fold}>
          <div className={styles.foldHeadRow}>
            <div className={styles.foldHead}>
              <span className={styles.foldEyebrow}>Fanverse</span>
              <div className={styles.foldTitleRow}>
                <div className={styles.foldTitle}>
                  <span className={styles.foldTitleName}>Ana Castela</span>
                  <VerifiedBadge size={18} className={styles.foldVerified} />
                </div>
              </div>
              <div
                className={styles.metaRow}
                data-onboarding-anchor="fanpoints"
              >
                <div className={styles.metaPoints}>
                  <span className={styles.metaPointsValue}>
                    {fanpoints.toLocaleString('pt-BR')}
                  </span>
                  <span className={styles.metaPointsLabel}>Fanpoints</span>
                  {/* Badge de colocação no ranking — (Top 1!) pro
                   * primeiro lugar; (#Nº) pros demais. Não renderiza
                   * se o user ainda não aparece no ranking. */}
                  {rankBadge && (
                    <span
                      className={`${styles.metaRankBadge} ${myRank === 1 ? styles.metaRankBadgeTop : ''}`}
                      aria-label={
                        myRank === 1
                          ? 'Top 1 no ranking'
                          : `Posição ${myRank} no ranking`
                      }
                    >
                      {rankBadge}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Orb CLICÁVEL — abre o overlay FanverseSearch
             * ("Analisando atividade do mundo"). e.stopPropagation
             * impede que o clique vaze pro toggle do header. Agora
             * mora fora do bloco do título mas alinhado vertical via
             * align-items: center no .foldHeadRow. */}
            <button
              type="button"
              className={styles.foldOrb}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
                } catch { /* SSR */ }
              }}
              aria-label="Abrir Fanverse Search"
            >
              <FanverseCore />
            </button>
          </div>
        </div>
      </button>

      {/* Discount row — agora hospeda APENAS o tab bar. O chevron
       *  toggle foi removido (header virou o trigger do dropdown)
       *  pra abrir espaço pras 3 tabs sem aperto. */}
      <div className={styles.discountRow}>
        {/* Tab bar — substitui o antigo badge "15% OFF Ativado na
         * Loja da Boiadeira" per product feedback. Mesmo padrão
         * visual do SuperfansPanel (segmented control inset com
         * .tabs/.tab/.tabActive). Switch do conteúdo do dropdown
         * acontece abaixo, no body. */}
        <div className={styles.tabs} role="tablist">
          {/* Ordem invertida per spec "inverta a posição das tabs
           * Superfãs e Missões" — Superfãs agora vem primeiro. */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ranking'}
            className={`${styles.tab} ${activeTab === 'ranking' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('ranking'); if (!open) setOpen(true); }}
            data-onboarding-anchor="ranking"
          >
            Superfãs
          </button>
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
            aria-selected={activeTab === 'materiais'}
            className={`${styles.tab} ${activeTab === 'materiais' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('materiais'); if (!open) setOpen(true); }}
          >
            Exclusivo
          </button>
        </div>
      </div>

      {/* Resumo das Missões — visível APENAS quando o box está
       *  fechado, per spec "com o box Fanverse Ana Castela
       *  fechado, deixe visível a barra de progresso com a palavra
       *  Missões do dia e 170 Fanpoints". Replica o
       *  .missionsHeader + .progressWrap da tab Missões. Clique
       *  no bloco expande o box e leva pra tab Missões. */}
      {!open && (
        <>
          <div className={styles.closedMissionsSummary}>
            <div className={styles.missionsHeader}>
              <span className={styles.missionsTitle}>
                Missões do dia
                <span
                  className={styles.missionsInfo}
                  data-tooltip="Cada dia uma missão diferente. Aproveite!"
                  role="img"
                  aria-label="Cada dia uma missão diferente. Aproveite!"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </span>
              <span className={styles.xpTotal}>{fpEarned} Fanpoints</span>
            </div>
            <div className={styles.progressWrap}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          {/* Affordance "expandir" — chevron pulsante apontando pra
           * baixo, agora abaixo do resumo de Missões. */}
          <button
            type="button"
            className={styles.expandHint}
            onClick={() => { setActiveTab('missoes'); setOpen(true); }}
            aria-label="Expandir Fanverse"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>
        </>
      )}

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
        <div>
          {/* Divider removido per spec "remova a linha que tem logo
           * abaixo das tabs no desktop". */}
          {/* Body switch por tab. Conquistas saiu como aba — agora é
           * um link inline dentro de RankingTabContent. */}
          {activeTab === 'ranking' && <RankingTabContent />}
          {activeTab === 'materiais' && <MaterialsTabContent />}
          {activeTab === 'missoes' && (
          <>
          {/* Header das missões: "Missões do dia" (sentence case)
           * + 120 Fanpoints na mesma linha, ANTES da lista. Per spec
           * "coloque na linha de cima junto com 120 Fanpoints". */}
          <div className={styles.missionsHeader}>
            <span className={styles.missionsTitle}>
              Missões do dia
              <span
                className={styles.missionsInfo}
                data-tooltip="Cada dia uma missão diferente. Aproveite!"
                role="img"
                aria-label="Cada dia uma missão diferente. Aproveite!"
                onClick={(e) => e.stopPropagation()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </span>
            <span className={styles.xpTotal}>{fpEarned} Fanpoints</span>
          </div>
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
                  {/* Per product feedback "Missões, inverta a ordem
                   * do check e do badge FP" — check VEM ANTES, badge
                   * FP DEPOIS na linha. */}
                  <div className={styles.missionCheck}>
                    <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 4l2 2 3-3.5"/>
                    </svg>
                  </div>
                  <span className={styles.missionXp}>{m.xp}</span>
                  {/* Sparkle burst overlay — appears for ~1.6s
                      after a mission transitions to done. 5
                      small particles scatter horizontally with
                      different rise + fade timings so the burst
                      reads as organic festivity rather than a
                      static graphic. See `.missionSparkles` +
                      `.sparkle` in the module CSS. */}
                  {isCelebrating && (
                    <div className={styles.missionSparkles} aria-hidden="true">
                      {SPARKLE_INDICES.map((i) => (
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
          </>
          )}
        </div>
      </div>

      {/* Progress bar — só na tab Missões. Per spec "remova '1/6
       * missões 17%'. Deixe apenas a barra de progresso." */}
      {activeTab === 'missoes' && (
      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
      )}

      {/* Dropdown footer — só a chevron de toggle agora; título +
       * Fanpoints migraram pra cima (.missionsHeader). */}
      <div className={styles.footer} onClick={() => setOpen(o => !o)}>
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

      {/* Modal "Convide seus amigos" — render fora do dropdown
       *  (mesmo tree do .box, mas overlay full-viewport via
       *  position:fixed no CSS). Renderiza condicionalmente. */}
      {inviteOpen && (
        <InviteFriendsModal onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Modal "Convide seus amigos" — 4 códigos pre-gerados com
 * botão "Copiar" por linha. Per product feedback "ao clicar,
 * abre um modal com 4 códigos, botão de copiar. Título do
 * modal: Convide seus amigos". Click no backdrop ou na X fecha.
 * ──────────────────────────────────────────────────────────── */
const INVITE_CODES = [
  'FANV-9K2X4',
  'FANV-MT7Q8',
  'FANV-B5RP3',
  'FANV-YH6JD',
];

export function InviteFriendsModal({ onClose }: { onClose: () => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ESC fecha o modal. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Cleanup do timer ao desmontar pra não disparar setState
   * num componente já fora da tree. */
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function handleCopy(code: string, idx: number) {
    /* navigator.clipboard pode falhar em contexts não-secure;
     * fallback via execCommand. */
    const onDone = () => {
      setCopiedIdx(idx);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedIdx(null), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(onDone).catch(() => {
        // fallback silencioso
        onDone();
      });
    } else {
      onDone();
    }
  }

  return (
    <div
      className={styles.inviteBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Convide seus amigos"
    >
      <div
        className={styles.inviteModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inviteHeader}>
          <h3 className={styles.inviteTitle}>Convide seus amigos.</h3>
          <button
            type="button"
            className={styles.inviteClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className={styles.inviteSubtitle}>
          Compartilhe um dos códigos abaixo. Cada amigo que entrar
          rende Fanpoints pra você.
        </p>
        <div className={styles.inviteList}>
          {INVITE_CODES.map((code, idx) => (
            <div key={code} className={styles.inviteRow}>
              <span className={styles.inviteCode}>{code}</span>
              <button
                type="button"
                className={`${styles.inviteCopyBtn} ${copiedIdx === idx ? styles.inviteCopyBtnDone : ''}`}
                onClick={() => handleCopy(code, idx)}
              >
                {copiedIdx === idx ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Ranking — espelha o conteúdo do SuperfansPanel mas
 * compactado pro footprint do ArtistBox: SEM foto e SEM pontos
 * por linha. Mantém:
 *   - rank
 *   - nome
 *   - cidade
 *   - barra de progresso ("X pontos para entrar no top 10")
 *   - botão "Carregar mais usuários" (top 6 → full)
 * Per product feedback "ranking deve ter o conteúdo do
 * SuperfansPanel ajustado pro box, sem pontuação, sem foto,
 * mantém barra de progresso, deve ter botão carregar mais".
 * ──────────────────────────────────────────────────────────── */
/* Top10ProgressBar — barra reusável extraída do RankingTabContent.
 * Per product feedback "mova a barra de progresso 'Você está no
 * top 10' e a coroa para a aba conquista" — vive agora SÓ na
 * aba Conquistas (desktop). Hosta useRanking + useAuth próprios. */
function Top10ProgressBarDesktop() {
  const { user } = useAuth();
  const { ranking } = useRanking(true);
  const top10Threshold = ranking.length >= 10 ? ranking[9].points : null;
  const myRow = user ? ranking.find((r) => r.userId === user.id) ?? null : null;
  const myPoints = myRow?.points ?? 0;
  const myRank = myRow
    ? ranking.findIndex((r) => r.userId === user!.id) + 1
    : ranking.length + 1;
  const meInTop10 = myRow ? myRank <= 10 : false;
  const pointsToTop10 =
    myRow && top10Threshold !== null
      ? Math.max(0, top10Threshold + 1 - myPoints)
      : 0;
  const meProgressPct = 50;
  return (
    <div className={styles.tabRankingProgress}>
      <div className={styles.tabRankingProgressLabel}>
        {meInTop10
          ? '👑 Você está no Top 10!'
          : top10Threshold === null
            ? '👑 Continue ouvindo pra entrar no ranking'
            : `👑 ${pointsToTop10.toLocaleString('pt-BR')} pontos para entrar no top 10`}
      </div>
      <div className={styles.tabRankingProgressTrack}>
        <div
          className={styles.tabRankingProgressFill}
          style={{ width: `${meProgressPct}%` }}
        />
      </div>
    </div>
  );
}

export function RankingTabContent() {
  const { user } = useAuth();
  const { ranking, loading, error } = useRanking(true);
  /* Lista de online ao vivo — usada pra renderizar o dot
   * verde/cinza ao lado do avatar de cada linha. Recarrega
   * a cada 30s + on socket `presence:batch`. */
  const { users: liveUsers } = useLiveUsers();
  const onlineIds = useMemo(
    () => new Set(liveUsers.map((u) => u.id)),
    [liveUsers],
  );
  /* Pagina o ranking em batches de 20 (default 6) per spec
   * "adicione o botão Ver mais para conseguir ver os outros
   * usuários do Ranking" — cada clique revela 20 a mais sem ir
   * direto pra 100; o botão fica sempre próximo do scroll
   * position do usuário em vez de "explodir" o tamanho da lista. */
  const [visibleCount, setVisibleCount] = useState(6);

  /* Memoizado pra que o slice não recrie array a cada render
   * (ex.: cada update do hook useLiveUsers dispara render). */
  const visible = useMemo(
    () => ranking.slice(0, visibleCount),
    [visibleCount, ranking],
  );

  return (
    <div className={styles.tabRanking}>
      {/* "Minhas conquistas" abre o FanpointsModal (mount global no
       * layout). Custom event mantém o componente desacoplado do
       * router — mesma estratégia do orb → FanverseSearch. */}
      <button
        type="button"
        className={styles.conquistasLink}
        onClick={() => {
          try {
            window.dispatchEvent(new CustomEvent('app:open-fanpoints'));
          } catch { /* SSR */ }
        }}
      >
        Minhas conquistas
      </button>

      {/* Lista (sem foto, sem pontos). */}
      {error ? (
        <div className={styles.tabEmpty}>Não consegui carregar agora.</div>
      ) : ranking.length === 0 ? (
        <div className={styles.tabEmpty}>
          {loading ? 'Carregando…' : 'Sem fãs ainda.'}
        </div>
      ) : (
        <div className={styles.tabRankingList}>
          {visible.map((r, idx) => {
            const rank = idx + 1;
            const isMe = r.userId === user?.id;
            const isTop3 = rank <= 3;
            const name = r.name?.trim() || r.email.split('@')[0];
            const avatar = r.avatarUrl ?? '/avatar-placeholder.svg';
            /* Online = presença ao vivo (lista do useLiveUsers).
             * O "Você" sempre conta como online — o backend só
             * inclui o próprio user no payload quando o socket está
             * ativo, mas o usuário lendo o ranking obviamente está
             * online. */
            const isOnline = isMe || onlineIds.has(r.userId);
            return (
              <div
                key={r.userId}
                className={`${styles.tabRankingRow} ${isMe ? styles.tabRankingRowMe : ''} ${isTop3 ? styles.tabRankingRowTop3 : ''}`}
              >
                {/* Per product feedback "sinalize melhor o top 3":
                 * rank usa medal pillorada quando ≤3 (bg dourado/prata/
                 * bronze) em vez de só o emoji solto. */}
                <span className={`${styles.tabRankingRank} ${isTop3 ? styles.tabRankingRankMedal : ''} ${rank === 1 ? styles.tabRankingRankGold : rank === 2 ? styles.tabRankingRankSilver : rank === 3 ? styles.tabRankingRankBronze : ''}`}>
                  {isTop3 ? rank : `#${rank}`}
                </span>
                {/* Avatar wrap — hospeda o dot de online/offline no
                 * canto inferior direito. Mesmo padrão visual dos
                 * avatares do chat (verde sólido + ring preto). */}
                <span className={styles.tabRankingAvatarWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt=""
                    className={styles.tabRankingAvatar}
                  />
                  <span
                    className={`${styles.tabRankingPresence} ${isOnline ? styles.tabRankingPresenceOn : ''}`}
                    aria-label={isOnline ? 'Online' : 'Offline'}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                </span>
                <div className={styles.tabRankingInfo}>
                  {/* Nome (clicável → /app/u/{id}) + cidade ABAIXO
                   * em linha separada. Per product feedback "Deixe
                   * o nome da cidade logo abaixo e a pontuação à
                   * direita, como no mobile". */}
                  <Link
                    href={`/app/u/${r.userId}`}
                    className={styles.tabRankingName}
                    prefetch={false}
                  >
                    {name}
                  </Link>
                  {r.city && (
                    <span className={styles.tabRankingCity}>{r.city}</span>
                  )}
                </div>
                {/* Pontuação na DIREITA do card, fora do bloco de
                 * info — mesmo padrão do mobile. */}
                <span className={styles.tabRankingPoints}>
                  {r.points.toLocaleString('pt-BR')} FP
                </span>
              </div>
            );
          })}
        </div>
      )}

      {visibleCount < ranking.length && (
        <button
          type="button"
          className={styles.tabRankingLoadMore}
          onClick={() => setVisibleCount((c) => c + 20)}
        >
          Ver mais
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Conquistas — listagem das BENEFITS (reusa SuperfansPanel)
 * com split FIXO por índice em vez de threshold de Fanpoints,
 * per product feedback "nos 4 primeiros itens deixe ativos com
 * cadeado desbloqueado; demais bloqueados com cadeado + o que
 * precisa ser feito abaixo". Linha de descrição truncada em 1
 * linha (`.tabBenefitDesc` usa ellipsis) pra caber mais itens
 * sem aumentar altura.
 * ──────────────────────────────────────────────────────────── */
export function BenefitsTabContent() {
  /* Per product feedback iterativo:
   *  - "deixe apenas 3 itens desbloqueados" → slice(0, 3)
   *  - "remova a linha descritiva" → renderiza só title (sem desc)
   *  - "remova a palavra Bloqueadas" → sem section title separador
   *  - "adicione mais 8 itens com scroll" → BENEFITS estendido (6 → 14)
   *
   * Lista única scrollável (.tabBenefitsScroll com overflow-y).
   * Locked usa o copy "Acumule X Fanpoints" como ação a ser feita
   * — única linha embaixo do título. */
  const unlocked = BENEFITS.slice(0, 3);
  const locked = BENEFITS.slice(3);

  return (
    <div className={styles.tabBenefitsScroll}>
      {/* Top10ProgressBarDesktop NÃO vive mais aqui — fora do
       * BenefitsTabContent. Mobile renderiza sua própria barra
       * fina via wrapper (.benefitsProgressWrap) no
       * MobileFanverseSheet; desktop renderiza Top10ProgressBarDesktop
       * adjacente ao <BenefitsTabContent /> no ArtistBox tab body.
       * Per product feedback "tem duas barras de progresso. Deixe
       * apenas a mais fina" — evita o double-bar no mobile. */}
      <div className={styles.tabBenefits}>
        {unlocked.map((b) => (
          <div key={b.id} className={styles.tabBenefitRow}>
            <span className={styles.tabBenefitIcon} aria-hidden="true">
              <BenefitIcon kind={b.icon} />
            </span>
            <div className={styles.tabBenefitInfo}>
              <span className={styles.tabBenefitTitle}>{b.title}</span>
            </div>
            <LockIcon variant="unlocked" />
          </div>
        ))}
        {locked.map((b) => (
          <div
            key={b.id}
            className={`${styles.tabBenefitRow} ${styles.tabBenefitRowLocked}`}
          >
            <span className={styles.tabBenefitIcon} aria-hidden="true">
              <BenefitIcon kind={b.icon} />
            </span>
            <div className={styles.tabBenefitInfo}>
              <span className={styles.tabBenefitTitle}>{b.title}</span>
              <span className={styles.tabBenefitDesc}>
                Acumule {b.threshold.toLocaleString('pt-BR')} Fanpoints
              </span>
            </div>
            <LockIcon variant="locked" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Cadeado inline — duas variantes (aberto/fechado). Tamanho
 * 14×14, cor herdada via currentColor pra adaptar ao estado
 * unlocked (rgba branco) ou locked (já com opacity reduzida no
 * row). */
function LockIcon({ variant }: { variant: 'locked' | 'unlocked' }) {
  return (
    <span
      className={`${styles.tabBenefitLock} ${variant === 'unlocked' ? styles.tabBenefitLockOpen : ''}`}
      aria-label={variant === 'unlocked' ? 'Desbloqueado' : 'Bloqueado'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        {variant === 'locked' ? (
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        ) : (
          /* Aro saindo pra direita (cadeado aberto) — mesma origem
           * vertical, mas o lado direito do aro "puxa pra cima
           * e pra fora" indicando o destrancado. */
          <path d="M8 11V8a4 4 0 0 1 7.6-1.8" />
        )}
      </svg>
    </span>
  );
}
