'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
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

type Tab = 'conquistas' | 'fanpoints' | 'atividade' | 'trocar';

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

  useEffect(() => {
    if (!open || tab !== 'atividade') return;
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
        {/* Header */}
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Fanpoints</h2>
            <p className={styles.subtitle}>
              Acompanhe sua evolução, descubra novas recompensas e
              veja como aproveitar seus pontos.
            </p>
          </div>
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
            aria-selected={tab === 'fanpoints'}
            className={`${styles.tab} ${tab === 'fanpoints' ? styles.tabActive : ''}`}
            onClick={() => setTab('fanpoints')}
          >
            Fanpoints
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'atividade'}
            className={`${styles.tab} ${tab === 'atividade' ? styles.tabActive : ''}`}
            onClick={() => setTab('atividade')}
          >
            Atividade Recente
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className={`${styles.tab} ${styles.tabDisabled}`}
            disabled
          >
            Como Trocar
            <span className={styles.tabBadge}>Em breve</span>
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
            />
          )}
          {tab === 'fanpoints' && <FanpointsTab />}
          {tab === 'atividade' && (
            <AtividadeTab
              items={activities}
              loading={activitiesLoading}
              onJumpToFanpoints={() => setTab('fanpoints')}
            />
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
}: {
  fanpoints: number;
  myRank: number;
  currentTier: { id: string; label: string; threshold: number } | null;
  nextTier:    { id: string; label: string; threshold: number } | null;
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
 * Tab 3 — Atividade Recente
 * Lista cronológica + CTA pra Fanpoints tab.
 * ──────────────────────────────────────────────────────────── */
function AtividadeTab({
  items,
  loading,
  onJumpToFanpoints,
}: {
  items: ActivityItem[];
  loading: boolean;
  onJumpToFanpoints: () => void;
}) {
  return (
    <div className={styles.tabPanel}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Últimas movimentações</h3>
        {loading && <p className={styles.empty}>Carregando…</p>}
        {!loading && items.length === 0 && (
          <p className={styles.empty}>
            Você ainda não tem atividade registrada. Interaja na
            plataforma pra começar a ganhar Fanpoints.
          </p>
        )}
        {!loading && items.length > 0 && (
          <ul className={styles.activityList}>
            {items.map((a) => (
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
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Como ganhar mais Fanpoints?</h3>
        <p className={styles.paragraph}>
          Quer saber todas as formas de acumular e utilizar seus pontos?
          {' '}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={onJumpToFanpoints}
          >
            Veja a aba Fanpoints
          </button>
          .
        </p>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Tab 4 — Como Trocar (placeholder)
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
