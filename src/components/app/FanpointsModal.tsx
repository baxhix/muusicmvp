'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '@/lib/auth/AuthContext';
import Skeleton from './Skeleton';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import { BENEFITS, BenefitIcon } from './SuperfansPanel';
import RankMedallion from './RankMedallion';
import styles from './FanpointsModal.module.css';

/**
 * FanpointsModal — centraliza explicações e progresso do programa
 * de Fanpoints em 4 tabs.
 *
 * Mount-once em /app/app/layout.tsx; abre/fecha via custom event
 * `app:open-fanpoints` (mesmo padrão do FanverseSearch). Click no
 * backdrop ou ESC fecham.
 *
 * Design: zero bordas, sem cores chamativas — segue o tema escuro
 * do app. As tabs usam o pattern minimal "underline-on-active"
 * (referência: design-system Style | Image | Arrange).
 */

type Tab = 'conquistas' | 'beneficios' | 'fanpoints' | 'ranking' | 'trocar';

interface ActivityItem {
  id: string;
  kind: string;
  points: number;
  createdAt: string;
}

/* Labels human-readable pra cada `kind` retornado pela API. */
const KIND_LABELS: Record<string, string> = {
  stream: 'Tocou uma música',
  three_streams: 'Marco de 3 músicas',
  login: 'Login na plataforma',
  chat_started: 'Iniciou uma conversa',
  post_liked: 'Curtiu um post',
  comment_posted: 'Comentou em um post',
  post_shared: 'Compartilhou um post',
};

/* Regras integradas (espelho da fanpoint_rules). Display label +
 * pontos. Mantida no client pra evitar chamar /api/admin (que é
 * gated por role). */
const EARN_RULES = [
  { kind: 'login',          icon: '🔥', name: 'Login diário',                 points: 50 },
  { kind: 'three_streams',  icon: '🎵', name: 'A cada 3 músicas ouvidas',      points: 10 },
  { kind: 'post_liked',     icon: '❤️', name: 'Curtir uma publicação',         points: 5  },
  { kind: 'comment_posted', icon: '💬', name: 'Comentar em uma publicação',    points: 10 },
  { kind: 'post_shared',    icon: '🔗', name: 'Compartilhar uma publicação',   points: 15 },
  { kind: 'chat_started',   icon: '✉️', name: 'Iniciar uma conversa',          points: 3  },
];

/* Jornada de tiers. Threshold = colocação no ranking pra atingir
 * o tier. Tier atual = primeiro tier cujo threshold ≥ myRank. */
const TIERS = [
  { id: 'top100', label: 'Top 100',  threshold: 100 },
  { id: 'top50',  label: 'Top 50',   threshold: 50  },
  { id: 'top10',  label: 'Top 10',   threshold: 10  },
  { id: 'top5',   label: 'Top 5',    threshold: 5   },
  { id: 'top1',   label: 'Top 1',    threshold: 1   },
];

/* Tier atual a partir da colocação (reusado pela aba Jornada do
 * RankingStoreModal). Retorna o tier mais exigente alcançado. */
export function currentTierForRank(myRank: number) {
  if (!myRank) return null;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (myRank <= TIERS[i].threshold) return TIERS[i];
  }
  return null;
}

const REWARDS = [
  { icon: '🏅', label: 'Badge exclusivo no perfil' },
  { icon: '⭐', label: 'Destaque no Fanverse Search' },
  { icon: '🎁', label: 'Benefícios especiais com o artista' },
  { icon: '🚀', label: 'Acesso antecipado a novas features' },
];

export default function FanpointsModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<Tab>('conquistas');

  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  const { ranking } = useRanking(open);
  const myRank = useMemo(
    () => (user ? ranking.findIndex((r) => r.userId === user.id) + 1 : 0),
    [user, ranking],
  );

  /* Tier atual: primeiro tier (em ordem do array) cujo threshold é
   * ALCANÇADO. Como o array vai do mais fácil pro mais difícil,
   * iteramos de trás pra frente — o usuário "está" no tier mais
   * exigente que ele consegue atingir. */
  const currentTierIdx = useMemo(() => {
    if (!myRank) return -1;
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (myRank <= TIERS[i].threshold) return i;
    }
    return -1;
  }, [myRank]);

  const currentTier = currentTierIdx >= 0 ? TIERS[currentTierIdx] : null;
  const nextTier    = currentTierIdx >= 0 && currentTierIdx < TIERS.length - 1
    ? TIERS[currentTierIdx + 1]
    : null;

  /* Atividade recente — buscada quando o modal abre, na tab certa. */
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  /* Atividade Recente vive DENTRO da tab Conquistas agora (per
   * spec). Fetch dispara sempre que o modal abre + a tab atual
   * é Conquistas. Mantém-se single-source-of-truth dos dados. */
  useEffect(() => {
    if (!open || tab !== 'conquistas') return;
    let cancelled = false;
    setActivitiesLoading(true);
    fetch('/api/me/activities?limit=20')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return;
        setActivities(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setActivitiesLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, tab]);

  /* Listener global pro custom event de abertura (mesmo padrão
   * FanverseSearch). */
  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setTab('conquistas');
    }
    window.addEventListener('app:open-fanpoints', onOpen);
    return () => window.removeEventListener('app:open-fanpoints', onOpen);
  }, []);

  /* ESC fecha. */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  /* Portal pro body pra escapar de qualquer containing block. */
  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Fanpoints"
    >
      <div className={styles.modal}>
        {/* Header — close (X) no canto superior direito.
         * Título 32px + emoji estrela + sem subtítulo per spec
         * "deixe o título em 32px e inclua o emoji de estrela.
         * Aumente o padding. Remova o subtítulo". */}
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>
              <span className={styles.titleIcon} aria-hidden="true">⭐</span>
              Fanpoints
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'conquistas'}
            className={`${styles.tab} ${tab === 'conquistas' ? styles.tabActive : ''}`}
            onClick={() => setTab('conquistas')}
          >
            Conquistas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'beneficios'}
            className={`${styles.tab} ${tab === 'beneficios' ? styles.tabActive : ''}`}
            onClick={() => setTab('beneficios')}
          >
            Benefícios
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'fanpoints'}
            className={`${styles.tab} ${tab === 'fanpoints' ? styles.tabActive : ''}`}
            onClick={() => setTab('fanpoints')}
          >
            Fanpoints
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ranking'}
            className={`${styles.tab} ${tab === 'ranking' ? styles.tabActive : ''}`}
            onClick={() => setTab('ranking')}
          >
            Ranking
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className={`${styles.tab} ${styles.tabDisabled}`}
            disabled
          >
            Como Trocar
          </button>
        </div>

        {/* Body — scroll interno; tabs ficam fixas no header */}
        <div className={styles.body}>
          {tab === 'conquistas' && (
            <ConquistasTab
              fanpoints={fanpoints}
              myRank={myRank}
              currentTier={currentTier}
              nextTier={nextTier}
              activities={activities}
              activitiesLoading={activitiesLoading}
              onJumpToFanpoints={() => setTab('fanpoints')}
            />
          )}
          {tab === 'beneficios' && (
            <BeneficiosTab fanpoints={fanpoints} currentTier={currentTier} />
          )}
          {tab === 'fanpoints' && <FanpointsTab />}
          {tab === 'ranking' && (
            <RankingTab user={user} ranking={ranking} myRank={myRank} />
          )}
          {tab === 'trocar' && <TrocarTab />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab 1 — Minhas Conquistas
 * Saldo, tier atual, próximo tier, jornada, recompensas.
 * ──────────────────────────────────────────────────────────── */
function ConquistasTab({
  fanpoints,
  myRank,
  currentTier,
  nextTier,
  activities,
  activitiesLoading,
  onJumpToFanpoints,
}: {
  fanpoints: number;
  myRank: number;
  currentTier: { id: string; label: string; threshold: number } | null;
  nextTier:    { id: string; label: string; threshold: number } | null;
  activities: ActivityItem[];
  activitiesLoading: boolean;
  onJumpToFanpoints: () => void;
}) {
  /* Progress: distance from currentTier threshold para nextTier
   * threshold. Mostramos pelo posição relativa (myRank diminui
   * conforme sobe). */
  const progress = useMemo(() => {
    if (!currentTier || !nextTier) return 100;
    const span = currentTier.threshold - nextTier.threshold;
    if (span <= 0) return 100;
    const done = currentTier.threshold - myRank;
    return Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  }, [currentTier, nextTier, myRank]);

  return (
    <div className={styles.tabPanel}>
      {/* Saldo + Nível atual lado a lado per spec "deixe o meu
       * nível atual ao lado do saldo atual". Card único com
       * duas colunas: esquerda saldo, direita nível. */}
      <div className={styles.summaryRow}>
        <div className={styles.balanceCard}>
          <span className={styles.balanceLabel}>Saldo atual</span>
          <span className={styles.balanceValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.balanceUnit}>Fanpoints</span>
        </div>
        <div className={styles.balanceCard}>
          <span className={styles.balanceLabel}>Nível atual</span>
          <span className={styles.balanceValueSmall}>
            {currentTier ? currentTier.label : 'Sem classificação'}
          </span>
          {myRank > 0 && (
            <span className={styles.balanceUnit}>
              {myRank === 1 ? 'Top 1!' : `#${myRank}º no ranking`}
            </span>
          )}
        </div>
      </div>

      {/* Próximo nível */}
      {nextTier && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Próximo nível</h3>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={styles.progressNote}>
            Faltam <strong>{Math.max(0, myRank - nextTier.threshold)}</strong>{' '}
            posições no ranking para alcançar <strong>{nextTier.label}</strong>.
          </p>
        </section>
      )}

      {/* Recompensas CONQUISTADAS (filtradas: só as desbloqueadas).
       * Per spec "substitua Recompensas por tier por Recompensas
       * conquistadas". Quando nenhum tier desbloqueado, mostra
       * empty hint. */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Recompensas conquistadas</h3>
        {currentTier ? (
          <ul className={styles.rewardsList}>
            {REWARDS.map((r) => (
              <li key={r.label} className={styles.rewardItem}>
                <span className={styles.rewardIcon} aria-hidden="true">{r.icon}</span>
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            Você ainda não conquistou recompensas. Continue acumulando
            Fanpoints para desbloquear os primeiros benefícios.
          </p>
        )}
      </section>

      {/* Atividade Recente — movida pra dentro de Minhas Conquistas
       * per spec "leve o Atividade Recent para dentro de Minhas
       * Conquistas, como uma seção nova lá dentro". Reusa o mesmo
       * fetch /api/me/activities + render de cards. */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Atividade recente</h3>
        {activitiesLoading && (
          <Skeleton count={4} height={56} gap={8} ariaLabel="Carregando atividades" />
        )}
        {!activitiesLoading && activities.length === 0 && (
          <p className={styles.empty}>
            Você ainda não tem atividade registrada. Interaja na
            plataforma pra começar a ganhar Fanpoints.
          </p>
        )}
        {!activitiesLoading && activities.length > 0 && (
          <ul className={styles.activityList}>
            {activities.map((a) => (
              <li key={a.id} className={styles.activityItem}>
                <div className={styles.activityMeta}>
                  <span className={styles.activityName}>
                    {KIND_LABELS[a.kind] ?? a.kind}
                  </span>
                  <span className={styles.activityDate}>
                    {formatRelativeDate(a.createdAt)}
                  </span>
                </div>
                <span className={styles.activityPoints}>
                  {a.points > 0 ? `+${a.points}` : a.points} FP
                </span>
              </li>
            ))}
          </ul>
        )}
        {!activitiesLoading && activities.length > 0 && (
          <p className={styles.paragraph}>
            Quer saber todas as formas de acumular Fanpoints?{' '}
            <button
              type="button"
              className={styles.inlineLink}
              onClick={onJumpToFanpoints}
            >
              Veja a aba Fanpoints
            </button>
            .
          </p>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab 2 — Fanpoints
 * O que são, como acumular, pra que servem, validade.
 * ──────────────────────────────────────────────────────────── */
function FanpointsTab() {
  return (
    <div className={styles.tabPanel}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>O que são?</h3>
        <p className={styles.paragraph}>
          Fanpoints são pontos acumulados através da sua participação
          na plataforma. Eles representam seu nível de engajamento e
          ajudam a desbloquear conquistas e benefícios exclusivos.
        </p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Como acumular?</h3>
        <ul className={styles.earnList}>
          {EARN_RULES.map((rule) => (
            <li key={rule.kind} className={styles.earnItem}>
              <span className={styles.earnIcon} aria-hidden="true">{rule.icon}</span>
              <span className={styles.earnName}>{rule.name}</span>
              <span className={styles.earnPoints}>+{rule.points} FP</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Para que servem?</h3>
        <ul className={styles.bulletList}>
          <li>Evolução de nível no ranking</li>
          <li>Desbloqueio de conquistas e badges</li>
          <li>Benefícios exclusivos com o artista</li>
          <li>Troca por recompensas (em breve)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Os Fanpoints expiram?</h3>
        <p className={styles.paragraph}>
          {/* Bloco preparado pra leitura dinâmica futura. Hoje o
           * default é não expirar — quando o admin habilitar
           * validade, troque o texto via config. */}
          Seus Fanpoints não possuem prazo de validade atualmente.
        </p>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Ranking — substituiu a antiga Atividade Recente (que
 * virou seção dentro de Minhas Conquistas).
 *
 * Mostra a posição do usuário + top N usuários do ranking
 * (Fanpoints ranking). Reusa o array `ranking` já buscado no
 * top-level via useRanking().
 * ──────────────────────────────────────────────────────────── */
interface RankingEntry {
  userId: string;
  name?: string | null;
  avatarUrl?: string | null;
  points: number;
}
function RankingTab({
  user,
  ranking,
  myRank,
}: {
  user: { id: string } | null;
  ranking: RankingEntry[];
  myRank: number;
}) {
  const top = ranking.slice(0, 20);
  return (
    <div className={styles.tabPanel}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Sua posição</h3>
        <div className={styles.levelRow}>
          <span className={styles.levelTier}>
            {myRank === 0
              ? 'Sem classificação'
              : myRank === 1
              ? 'Top 1!'
              : `#${myRank}º`}
          </span>
          {myRank > 0 && (
            <span className={styles.levelRank}>
              entre {ranking.length} superfãs
            </span>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Top 20 do ranking</h3>
        {ranking.length === 0 ? (
          <p className={styles.empty}>
            O ranking ainda está sendo formado. Comece a interagir
            pra aparecer aqui.
          </p>
        ) : (
          <ul className={styles.rankList}>
            {top.map((r, idx) => {
              const rank = idx + 1;
              const isMe = r.userId === user?.id;
              const name = r.name?.trim() || 'Fã';
              const avatar = r.avatarUrl ?? '/avatar-placeholder.svg';
              return (
                <li
                  key={r.userId}
                  className={`${styles.rankItem} ${isMe ? styles.rankItemMe : ''}`}
                >
                  <span className={styles.rankPosition}>{`#${rank}`}</span>
                  {/* Avatar do user no ranking per spec "inclua o
                   * avatar dos usuários do Ranking". Wrap relative
                   * pra hospedar o medalhão Top 10 no canto. */}
                  <span className={styles.rankAvatarWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatar}
                      alt=""
                      className={styles.rankAvatar}
                    />
                    <RankMedallion position={rank} size="sm" />
                  </span>
                  <span className={styles.rankName}>{name}</span>
                  <span className={styles.rankPoints}>
                    {r.points.toLocaleString('pt-BR')} FP
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Benefícios — lista de marcos de Fanpoints e o que cada
 * um desbloqueia. Reusa BENEFITS de SuperfansPanel (catálogo
 * shared com a antiga aba Conquistas). Cada item mostra o
 * threshold em FP, ícone, título e descrição. Tags de status:
 * "Conquistado" (threshold ≤ saldo) ou "Bloqueado".
 * ──────────────────────────────────────────────────────────── */
export function BeneficiosTab({
  fanpoints,
  currentTier,
}: {
  fanpoints: number;
  currentTier: { id: string; label: string; threshold: number } | null;
}) {
  return (
    <div className={styles.tabPanel}>
      {/* Jornada de conquistas — migrada da tab Conquistas per spec
       * "leve o item Jornada de conquistas para a tab benefícios".
       * Ordem INVERTIDA per spec "inverta a ordenação dos cards":
       * Top 1 primeiro (objetivo máximo) → Top 100 por último
       * (degrau inicial). [...TIERS].reverse() não muda o array
       * original. */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Jornada de conquistas</h3>
        <ul className={styles.timeline}>
          {[...TIERS].reverse().map((t) => {
            const idx = TIERS.findIndex((x) => x.id === t.id);
            const myIdx = currentTier
              ? TIERS.findIndex((x) => x.id === currentTier.id)
              : -1;
            const state =
              myIdx === -1
                ? 'locked'
                : idx < myIdx
                ? 'done'
                : idx === myIdx
                ? 'current'
                : 'locked';
            return (
              <li
                key={t.id}
                className={`${styles.timelineItem} ${styles[`timeline_${state}`]}`}
              >
                <span className={styles.timelineDot} aria-hidden="true" />
                <span className={styles.timelineLabel}>{t.label}</span>
                {state === 'current' && (
                  <span className={styles.timelineCurrent}>atual</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Marcos de Fanpoints
        </h3>
        <p className={styles.paragraph}>
          Cada marco desbloqueia um benefício exclusivo na Fanverse.
          Quanto mais Fanpoints, mais conexão direta com o artista.
        </p>
      </section>

      {/* Marcos agora organizados em accordion por tier (Top 1,
       *  Top 5, Top 10, Top 50, Top 100). Cada card expansível
       *  via motion AnimatePresence + height animation. Per
       *  spec atualizado os 3 primeiros (Top 1 / Top 5 / Top 10)
       *  ficam abertos por default. */}
      <MarcosAccordion fanpoints={fanpoints} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * MarcosAccordion — agrupa BENEFITS por tier e renderiza um
 * card accordion (Motion) por tier. Top 1/5/10 abertos por
 * default per spec.
 * ──────────────────────────────────────────────────────────── */
interface MarcosAccordionProps {
  fanpoints: number;
}

/* Tiers de marco usados pra agrupar benefícios. Threshold em
 *  FP que define o teto MÁXIMO de benefícios desse tier (o
 *  bucket pega benefícios com threshold ≤ tier.threshold E >
 *  o threshold do tier anterior). Ordenação: Top 1 (mais
 *  exclusivo) → Top 100 (mais acessível). */
const MARCO_TIERS = [
  { id: 'top1',   label: 'Top 1',   minFp: 50000,  description: 'Onde só os mais dedicados chegam.' },
  { id: 'top5',   label: 'Top 5',   minFp: 20000,  description: 'Benefícios exclusivos pros realmente comprometidos.' },
  { id: 'top10',  label: 'Top 10',  minFp: 10000,  description: 'Você está entre os mais ativos da Fanverse.' },
  { id: 'top50',  label: 'Top 50',  minFp: 2500,   description: 'Comece a desbloquear vantagens exclusivas.' },
  { id: 'top100', label: 'Top 100', minFp: 0,      description: 'O primeiro passo na jornada.' },
];

function MarcosAccordion({ fanpoints }: MarcosAccordionProps) {
  /* Bucket de benefícios por tier: cada tier recebe os
   *  BENEFITS cujo threshold cai entre minFp do tier e
   *  minFp do tier ACIMA (mais exclusivo). Top 100 recebe
   *  benefits com threshold 0–2500, Top 50: 2500–10000, etc. */
  const bucketsByTier = useMemo(() => {
    const out: Record<string, typeof BENEFITS> = {};
    MARCO_TIERS.forEach((tier, idx) => {
      const upperBound =
        idx === 0 ? Infinity : MARCO_TIERS[idx - 1].minFp;
      out[tier.id] = BENEFITS.filter(
        (b) => b.threshold >= tier.minFp && b.threshold < upperBound,
      );
    });
    return out;
  }, []);

  /* Set de cards abertos. Per spec, os 3 primeiros (Top 1, Top
   *  5, Top 10) começam abertos. Toggle individual via click no
   *  header. */
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(['top1', 'top5', 'top10']),
  );

  const toggle = (id: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.marcosAccordion}>
      {MARCO_TIERS.map((tier) => {
        const benefits = bucketsByTier[tier.id];
        const isOpen = openSet.has(tier.id);
        /* Tier unlocked = user já tem FP suficiente pra esse
         *  tier mínimo. Visual: gradient brand quando unlocked,
         *  glass dim quando locked. */
        const unlocked = fanpoints >= tier.minFp;

        return (
          <div
            key={tier.id}
            className={`${styles.marcoCard} ${unlocked ? styles.marcoUnlocked : ''}`}
          >
            <button
              type="button"
              className={styles.marcoHeader}
              onClick={() => toggle(tier.id)}
              aria-expanded={isOpen}
              aria-controls={`marco-body-${tier.id}`}
            >
              <div className={styles.marcoHeaderLeft}>
                <span className={styles.marcoLabel}>{tier.label}</span>
                <span className={styles.marcoMinFp}>
                  {tier.minFp === 0
                    ? 'a partir de 0 FP'
                    : `${tier.minFp.toLocaleString('pt-BR')}+ FP`}
                </span>
              </div>
              <motion.span
                className={styles.marcoChevron}
                aria-hidden="true"
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
                  <path
                    d="M2 4l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.span>
            </button>

            {/* Body — height anima de 0 → auto via motion. */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  id={`marco-body-${tier.id}`}
                  className={styles.marcoBody}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.22 },
                  }}
                  style={{ overflow: 'hidden' }}
                >
                  <p className={styles.marcoDescription}>{tier.description}</p>
                  {benefits.length === 0 ? (
                    <p className={styles.marcoEmpty}>
                      Sem novos marcos neste tier — você desbloqueia tudo no tier
                      anterior.
                    </p>
                  ) : (
                    <ul className={styles.marcoBenefitsList}>
                      {benefits.map((b) => {
                        const benUnlocked = fanpoints >= b.threshold;
                        return (
                          <li
                            key={b.id}
                            className={`${styles.marcoBenefitItem} ${
                              benUnlocked ? styles.benefitUnlocked : styles.benefitLocked
                            }`}
                          >
                            <span className={styles.benefitIcon} aria-hidden="true">
                              <BenefitIcon kind={b.icon} />
                            </span>
                            <div className={styles.benefitBody}>
                              <div className={styles.benefitTitleRow}>
                                <span className={styles.benefitTitle}>{b.title}</span>
                                <span className={styles.benefitThreshold}>
                                  {b.threshold === 0
                                    ? 'Acesso inicial'
                                    : `${b.threshold.toLocaleString('pt-BR')} FP`}
                                </span>
                              </div>
                              <span className={styles.benefitDescription}>
                                {b.description}
                              </span>
                              <span className={styles.benefitStatus}>
                                {benUnlocked ? '✓ Conquistado' : 'Bloqueado'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab Como Trocar (placeholder)
 * ──────────────────────────────────────────────────────────── */
function TrocarTab() {
  return (
    <div className={styles.tabPanel}>
      <section className={styles.section}>
        <p className={styles.paragraph}>
          Estamos preparando uma área de recompensas para que você
          possa trocar seus Fanpoints por benefícios exclusivos.
        </p>
      </section>
    </div>
  );
}

/* Formata createdAt ISO → "Hoje", "Ontem" ou data curta. */
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  const dayMs = 86_400_000;
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `Hoje às ${hh}:${mm}`;
  }
  if (ms < 2 * dayMs) return 'Ontem';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
