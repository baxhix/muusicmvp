'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { useRanking } from '@/hooks/useRanking';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import {
  MISSION_META,
  TOTAL_MISSIONS,
  SPARKLE_INDICES,
  sumEarnedXp,
  // InviteFriendsModal removido — botão "4 convites" sai do mobile.
  // BenefitsTabContent não é mais usado aqui (Conquistas migrou
  // pro FanpointsModal acessado via link "X Fanpoints").
} from './ArtistBox';
import VerifiedBadge from './VerifiedBadge';
import TruncatedText from './TruncatedText';
import RankMedallion from './RankMedallion';
import FanverseCore from '@/components/animations/FanverseCore';
import { MaterialsTabContent } from './MaterialsTabContent';
import Skeleton from './Skeleton';
import sheetStyles from './MobileFanverseSheet.module.css';
import boxStyles from './ArtistBox.module.css';

/* ============================================================
 * MobileFanverseSheet
 *
 * Layout mobile do Box Fanverse Ana Castela. Estrutura:
 *
 *   ┌────────────────────────────────┐
 *   │       HERO IMAGE (100%)        │ ← /ana-castela-box.jpg
 *   ├────────────────────────────────┤
 *   │ Fanverse Ana Castela    402 FP │ ← title row
 *   │ [4 convites]                   │
 *   ├────────────────────────────────┤
 *   │ Missões | Superfãs | Materiais │ ← tab bar
 *   ├────────────────────────────────┤
 *   │       <tab content>            │ ← body
 *   └────────────────────────────────┘
 *
 * Per product feedback: imagem cobre 100% da largura, nome +
 * pontos numa linha logo abaixo, tabs depois, conteúdo com
 * tipografia / spacing / tap-targets ajustados pra mobile
 * (mínimo 44dp por tap target).
 *
 * Reusa componentes shared do ArtistBox (BenefitsTabContent,
 * InviteFriendsModal, MISSION_META, SPARKLE_INDICES,
 * sumEarnedXp). Ranking é re-implementado inline pra mover
 * Fanpoints pra coluna da direita e carregar até 100 users
 * sem botão "Carregar mais" (per product feedback).
 * ============================================================ */

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'missoes' | 'ranking' | 'materiais';
}

/* Quantos users do ranking aparecem antes de truncar.
 * Per product feedback "carregue até o usuário 100". */
const RANKING_LIMIT_MOBILE = 100;

export default function MobileFanverseSheet({
  open,
  onClose,
  defaultTab = 'ranking',
}: Props) {
  type BoxTab = 'missoes' | 'ranking' | 'materiais';
  const [activeTab, setActiveTab] = useState<BoxTab>(defaultTab);
  /* showConquistas removido — Conquistas agora vive no
   * FanpointsModal (aba default "Minhas Conquistas"), aberto via
   * o link "X Fanpoints" da tab Superfãs. */
  // inviteOpen state removida — botão "4 convites" foi tirado do mobile.

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  const { missions } = useDailyMissions();
  const doneById = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (missions) for (const m of missions) map[m.id] = m.done;
    return map;
  }, [missions]);
  const fpEarned = sumEarnedXp(MISSION_META, doneById);

  /* Mission celebration burst — espelha mecânica do desktop:
   * quando a missão transita pra "done" enquanto o sheet está
   * aberto, dispara sparkle por 1.6s. */
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

  /* ESC fecha. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Reset tab pra defaultTab toda vez que (re)abrir. */
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  if (!open) return null;

  return (
    <div className={sheetStyles.sheet} role="dialog" aria-modal="true">
      {/* ── Hero image — 100% width, sticky no topo ──
       *  `position: sticky; top: 0; z-index: 0` no CSS. Imagem
       *  fica fixa atrás enquanto o conteúdo (gradient + título +
       *  meta row + tabs + body) sobe por cima.
       *
       *  Per product feedback "a camada de gradiente e o texto
       *  deve se movimentar por cima", título + gradiente NÃO
       *  estão mais dentro do hero — saíram pra `.fold` abaixo,
       *  que scrolla naturalmente. */}
      <div className={sheetStyles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ana-castela-fanverse-hero.jpg"
          alt="Ana Castela"
          className={sheetStyles.heroImg}
        />

        {/* Back arrow — top-left. Sticky dentro do hero pra
         *  ficar visível no topo enquanto o user scrolla. */}
        <button
          type="button"
          className={sheetStyles.backBtn}
          onClick={onClose}
          aria-label="Voltar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      </div>

      {/* ── Fold ──
       *  Bloco scrollável que SOBE por cima do hero sticky.
       *  Negative margin-top faz começar antes do fim do hero
       *  (overlap visual); gradient forte transparent →
       *  rgba(8,8,14,1) mistura visualmente com a imagem e
       *  funde com o bg sólido do resto do sheet, como o user
       *  pediu ("mesclasse com o box abaixo").
       *
       *  Per product feedback "Fanpoints devem ficar mais
       *  próximos das palavras Fanverse Ana Castela" — título
       *  + meta row dentro do mesmo bloco, com gap apertado. */}
      <div className={sheetStyles.fold}>
        {/* Eyebrow "Fanverse" + nome com verified badge + botão
         * de convites alinhado à direita do nome. Per product
         * feedback "adicione a palavra Fanverse fonte 14, inter,
         * acima do nome dela", "adicione o selo de verificada
         * no nome", "alinhe o botão 4 convites ao nome Ana
         * Castela", "aumente o tamanho do nome Ana Castela". */}
        <span className={sheetStyles.foldEyebrow}>Fanverse</span>
        <div className={sheetStyles.foldTitleRow}>
          <div className={sheetStyles.foldTitle}>
            {/* Selo de verificado à FRENTE do nome (per feedback). */}
            <VerifiedBadge size={22} className={sheetStyles.foldVerified} />
            <span className={sheetStyles.foldTitleName}>Ana Castela</span>
          </div>
          {/* Orb agora é CLICÁVEL — abre o overlay FanverseSearch
           * ("Analisando atividade do mundo"). Mesmo padrão do
           * desktop ArtistBox; aqui não tem stopPropagation porque
           * o orb não vive dentro de um botão pai. */}
          <button
            type="button"
            className={sheetStyles.foldOrb}
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
              } catch { /* SSR */ }
            }}
            aria-label="Abrir Fanverse Search"
          >
            <FanverseCore />
          </button>
        </div>
        <div className={sheetStyles.metaRow}>
          {/* metaPoints é o TRIGGER do modal Ranking Fanverse
           * (Classificação · Minha evolução · Jornada · Loja),
           * abrindo na aba "Minha evolução". */}
          <button
            type="button"
            className={sheetStyles.metaPoints}
            onClick={() => {
              try {
                window.dispatchEvent(
                  new CustomEvent('app:open-ranking-store', { detail: { screen: 'evolucao' } }),
                );
              } catch { /* SSR */ }
            }}
            aria-label="Abrir Fanverse — Minha evolução"
          >
            <span className={sheetStyles.metaPointsValue}>
              {fanpoints.toLocaleString('pt-BR')}
            </span>
            <span className={sheetStyles.metaPointsRank}>(Top 1!)</span>
            <span className={sheetStyles.metaPointsLabel}>Fanpoints</span>
          </button>
          {/* Botão "4 convites" removido do mobile per product
           * feedback "Remova o botão de 4 convites do mobile". */}
        </div>
      </div>

      {/* ── Tab bar — mesma ordem do desktop:
       *  Superfãs | Missões | Exclusivo — per spec "no mobile,
       *  deixe as tabs na mesma ordem que no desktop".
       *
       *  Motion Tab select com pill que desliza via layoutId.
       *  layoutId "mobileFanverseTabPill" é independente do
       *  desktop ("artistBoxTabPill") pra evitar cross-bleed se
       *  ambos montassem simultaneamente. ── */}
      <div className={sheetStyles.tabsRow}>
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
                layoutId="mobileFanverseTabPill"
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
                layoutId="mobileFanverseTabPill"
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
                layoutId="mobileFanverseTabPill"
                className={boxStyles.tabPill}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className={boxStyles.tabLabel}>Exclusivo</span>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={sheetStyles.body}>
        {activeTab === 'ranking' && (
          <>
            {/* O link "X Fanpoints" foi REMOVIDO daqui per spec
             * "remova o link 151824 Fanpoints que existe entre as
             * tabs e a listagem do ranking". O trigger pro modal
             * agora mora APENAS no .metaPoints do fold (abaixo de
             * "Ana Castela") — mesma decisão tomada no desktop. */}
            <MobileRankingList />
          </>
        )}

        {activeTab === 'materiais' && (
          <div className={sheetStyles.materialsScope}>
            <MaterialsTabContent />
          </div>
        )}

        {activeTab === 'missoes' && (
          <>
            {/* Header "Missões do dia" (sentence case) + Fanpoints
             * na MESMA linha, ANTES da lista — per spec "coloque
             * na linha de cima junto com 120 Fanpoints". */}
            <div className={sheetStyles.missionsTotal}>
              <span className={sheetStyles.missionsTotalLabel}>Missões do dia</span>
              <span className={sheetStyles.missionsTotalXp}>{fpEarned} Fanpoints</span>
            </div>
            <div className={sheetStyles.missionsList}>
              {MISSION_META.map((m) => {
                const isDone = doneById[m.id] ?? false;
                const isCelebrating = celebratingIds.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`${boxStyles.mission} ${sheetStyles.missionMobile} ${isDone ? boxStyles.missionDone : ''} ${isCelebrating ? boxStyles.missionJustDone : ''}`}
                  >
                    <span className={`${boxStyles.missionIcon} ${sheetStyles.missionIconMobile}`}>{m.icon}</span>
                    <div className={boxStyles.missionText}>
                      <TruncatedText className={`${boxStyles.missionName} ${sheetStyles.missionNameMobile}`}>{m.name}</TruncatedText>
                    </div>
                    {/* Per product feedback "Missões, inverta a
                     * ordem do check e do badge FP" — check vem
                     * antes, badge FP depois (mesmo que desktop). */}
                    <div className={`${boxStyles.missionCheck} ${sheetStyles.missionCheckMobile}`}>
                      <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 4l2 2 3-3.5" />
                      </svg>
                    </div>
                    <span className={`${boxStyles.missionXp} ${sheetStyles.missionXpMobile}`}>{m.xp}</span>
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
          </>
        )}
      </div>

      {/* InviteFriendsModal removido junto com o botão de 4 convites
       * per product feedback "Remova o botão de 4 convites do mobile". */}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * MobileRankingList — variante mobile do ranking.
 *
 * Diferenças vs RankingTabContent (desktop):
 *  - Card maior (padding 14px, altura mínima 64px)
 *  - Avatar maior (44×44 vs 34)
 *  - Tipografia maior (nome 15px, subline 13px)
 *  - Fanpoints na COLUNA DA DIREITA do card (não no subline)
 *  - Carrega até 100 users (sem botão "Carregar mais")
 *  - Mesma mecânica: presence dot, top3 medal, nome → /app/u/[id]
 * ──────────────────────────────────────────────────────────── */
/* ───────────────────────────────────────────────────────────────
 * Top10ProgressBar — barra de progresso reutilizável (Superfãs +
 * Conquistas). Hoste seus próprios dados via useRanking + useAuth
 * pra que possa ser dropada em qualquer tab sem prop-drilling.
 * ─────────────────────────────────────────────────────────────── */
function Top10ProgressBar() {
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
    <div className={sheetStyles.rankingProgress}>
      <div className={sheetStyles.rankingProgressHeader}>
        <span className={sheetStyles.rankingProgressLabel}>
          {meInTop10
            ? 'Você está no Top 10!'
            : top10Threshold === null
              ? 'Continue ouvindo pra entrar no ranking'
              : `${pointsToTop10.toLocaleString('pt-BR')} pontos para entrar no top 10`}
        </span>
        <span
          className={sheetStyles.rankingProgressCrown}
          aria-hidden="true"
        >
          👑
        </span>
      </div>
      <div
        className={`${boxStyles.tabRankingProgressTrack} ${sheetStyles.rankingProgressTrack}`}
      >
        <div
          className={boxStyles.tabRankingProgressFill}
          style={{ width: `${meProgressPct}%` }}
        />
      </div>
    </div>
  );
}

function MobileRankingList() {
  const { user } = useAuth();
  const { ranking, loading, error } = useRanking(true);
  const { users: liveUsers } = useLiveUsers();
  const onlineIds = useMemo(
    () => new Set(liveUsers.map((u) => u.id)),
    [liveUsers],
  );

  /* Top 100 — per product feedback "carregue até o usuário 100". */
  const visible = useMemo(
    () => ranking.slice(0, RANKING_LIMIT_MOBILE),
    [ranking],
  );

  return (
    <div className={sheetStyles.rankingWrap}>
      {/* Top10ProgressBar foi MOVIDO daqui pra aba Conquistas
       * exclusivamente, per product feedback "mova a barra de
       * progresso 'Você está no top 10' e a coroa para a aba
       * conquista". A aba Superfãs entra direto na lista. */}

      {/* Lista. */}
      {error ? (
        <div className={sheetStyles.rankingEmpty}>Não consegui carregar agora.</div>
      ) : loading && ranking.length === 0 ? (
        <div style={{ padding: '6px 14px' }}>
          <Skeleton count={6} height={48} gap={8} ariaLabel="Carregando ranking" />
        </div>
      ) : ranking.length === 0 ? (
        <div className={sheetStyles.rankingEmpty}>Sem fãs ainda.</div>
      ) : (
        <div className={sheetStyles.rankingList}>
          {/* Lista única 1..100 — top3 em linha igual aos demais
           * (sem pódio), per product feedback "no mobile, deixe em
           * lista o top3 igual aos demais". O destaque do top10
           * continua só no medalhão (coroa/estrela) do avatar. */}
          {visible.map((r, idx) => {
            const rank = idx + 1;
            const isMe = r.userId === user?.id;
            const name = r.name?.trim() || 'Fã';
            const avatar = r.avatarUrl ?? '/avatar-placeholder.svg';
            const isOnline = isMe || onlineIds.has(r.userId);
            return (
              <div
                key={r.userId}
                className={`${sheetStyles.rankingRow} ${isMe ? sheetStyles.rankingRowMe : ''}`}
              >
                {/* Rank uniforme #N pra todos (inclusive top3). */}
                <span className={sheetStyles.rankingRank}>
                  {rank === 1 ? '👑' : `#${rank}`}
                </span>

                {/* Avatar + presence dot. */}
                <span className={sheetStyles.rankingAvatarWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt=""
                    className={sheetStyles.rankingAvatar}
                  />
                  <span
                    className={`${sheetStyles.rankingPresence} ${isOnline ? sheetStyles.rankingPresenceOn : ''}`}
                    aria-label={isOnline ? 'Online' : 'Offline'}
                  />
                  <RankMedallion position={rank} size="md" />
                </span>

                {/* Info: nome (link) + cidade. */}
                <div className={sheetStyles.rankingInfo}>
                  <span className={sheetStyles.rankingNameRow}>
                    {/* Selo de verificado sempre no Top 1, na frente do nome. */}
                    {rank === 1 && (
                      <VerifiedBadge size={15} className={sheetStyles.rankingVerified} />
                    )}
                    <Link
                      href={`/app/u/${r.userId}`}
                      className={sheetStyles.rankingName}
                      prefetch={false}
                    >
                      {name}
                    </Link>
                  </span>
                  {r.city && (
                    <span className={sheetStyles.rankingCity}>{r.city}</span>
                  )}
                </div>

                {/* Fanpoints — coluna da direita do card. */}
                <div className={sheetStyles.rankingPoints}>
                  <span className={sheetStyles.rankingPointsValue}>
                    {r.points.toLocaleString('pt-BR')}
                  </span>
                  <span className={sheetStyles.rankingPointsLabel}>FP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Top3Podium removido per product feedback "no mobile, deixe em
 * lista o top3 igual aos demais" — os 3 primeiros agora entram na
 * mesma lista plana (rank #1..#100), com o destaque do top10
 * vivendo só no medalhão (coroa/estrela) do avatar. */
