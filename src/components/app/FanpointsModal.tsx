'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import { BENEFITS, BenefitIcon } from './SuperfansPanel';
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
            Minhas Conquistas
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
          {tab === 'beneficios' && <BeneficiosTab fanpoints={fanpoints} />}
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
      {/* Saldo atual */}
      <div className={styles.balanceCard}>
        <span className={styles.balanceLabel}>Saldo atual</span>
        <span className={styles.balanceValue}>
          {fanpoints.toLocaleString('pt-BR')}
        </span>
        <span className={styles.balanceUnit}>Fanpoints</span>
      </div>

      {/* Nível atual */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Meu nível atual</h3>
        <div className={styles.levelRow}>
          <span className={styles.levelTier}>
            {currentTier ? currentTier.label : 'Sem classificação'}
          </span>
          {myRank > 0 && (
            <span className={styles.levelRank}>
              {myRank === 1 ? '(Top 1!)' : `(#${myRank}º no ranking)`}
            </span>
          )}
        </div>
      </section>

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

      {/* Jornada */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Jornada de conquistas</h3>
        <ul className={styles.timeline}>
          {TIERS.map((t) => {
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

      {/* Recompensas */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Recompensas por tier</h3>
        <ul className={styles.rewardsList}>
          {REWARDS.map((r) => (
            <li key={r.label} className={styles.rewardItem}>
              <span className={styles.rewardIcon} aria-hidden="true">{r.icon}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Atividade Recente — movida pra dentro de Minhas Conquistas
       * per spec "leve o Atividade Recent para dentro de Minhas
       * Conquistas, como uma seção nova lá dentro". Reusa o mesmo
       * fetch /api/me/activities + render de cards. */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Atividade recente</h3>
        {activitiesLoading && <p className={styles.empty}>Carregando…</p>}
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
  email: string;
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
              const name = r.name?.trim() || r.email.split('@')[0];
              return (
                <li
                  key={r.userId}
                  className={`${styles.rankItem} ${isMe ? styles.rankItemMe : ''}`}
                >
                  <span className={styles.rankPosition}>
                    {rank <= 3 ? rank : `#${rank}`}
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
function BeneficiosTab({ fanpoints }: { fanpoints: number }) {
  return (
    <div className={styles.tabPanel}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Marcos de Fanpoints
        </h3>
        <p className={styles.paragraph}>
          Cada marco desbloqueia um benefício exclusivo na Fanverse.
          Quanto mais Fanpoints, mais conexão direta com o artista.
        </p>
      </section>
      <ul className={styles.benefitsList}>
        {BENEFITS.map((b) => {
          const unlocked = fanpoints >= b.threshold;
          return (
            <li
              key={b.id}
              className={`${styles.benefitItem} ${unlocked ? styles.benefitUnlocked : styles.benefitLocked}`}
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
                  {unlocked ? '✓ Conquistado' : 'Bloqueado'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
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
