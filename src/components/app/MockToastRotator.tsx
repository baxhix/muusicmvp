'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { useAppShell } from '@/lib/app/AppShellContext';
import styles from './MockToastRotator.module.css';

/** Mensagem real vinda do socket (chat:message) — disparada via
 *  CustomEvent('app:chat-message-toast') pelo useChatLive sempre
 *  que uma msg chega FORA da conv ativa, não-self, kind='user'. */
export interface RealChatToastDetail {
  senderName: string;
  senderAvatarUrl: string | null;
  snippet: string;
  conversationId: string;
}

/* ============================================================
 * MOCK TOAST ROTATOR — cycling demo notifications
 *
 * Replaces the previous `ListeningTogether` avatar cascade. The
 * rotator cycles through a fixed pool of mock notifications,
 * presenting each as a single horizontal pill that slides up
 * from below the viewport, holds for a few seconds, slides out,
 * and the next entry takes its place after a short gap.
 *
 * The visual matches `SameTrackToast` / `PointsToast` — same
 * pill envelope, same animations, same screen position — so the
 * rotator reads as one of those real notifications even though
 * everything here is hard-coded mock data.
 *
 * Notification types:
 *   1. listening_together — "+455 pessoas ouvindo com você"
 *   2. message_sent       — "Beatriz K. enviou uma mensagem"
 *   3. waved              — "Lucas M. acenou para você"
 *   4. top_track          — "Pipoco é a sua mais ouvida"
 *   5. top_20             — "Você está no TOP 20!"
 *
 * Per product feedback "Use dados mocados por hora" — the data
 * stays fixed across the session; the cadence is what gives the
 * illusion of a steady stream of platform activity arriving.
 * ============================================================ */

interface MockUser {
  name: string;
  avatar: string;
}

const MOCK_USERS: MockUser[] = [
  { name: 'Beatriz K.', avatar: 'https://i.pravatar.cc/72?img=47' },
  { name: 'Rafael S.', avatar: 'https://i.pravatar.cc/72?img=12' },
  { name: 'Lucas M.', avatar: 'https://i.pravatar.cc/72?img=33' },
  { name: 'Ana C.', avatar: 'https://i.pravatar.cc/72?img=56' },
  { name: 'Thiago F.', avatar: 'https://i.pravatar.cc/72?img=8' },
  { name: 'Paula G.', avatar: 'https://i.pravatar.cc/72?img=44' },
];

const MOCK_TRACKS = [
  { title: 'Pipoco', artist: 'Ana Castela' },
  { title: 'Boiadeira', artist: 'Ana Castela' },
  // "Lets Go Rodeo" was previously listed as a track here, but
  // it's the ALBUM name, not a song — replaced with another
  // Ana Castela single per product feedback.
  { title: 'Solteiro Forçado', artist: 'Ana Castela' },
];

type MockToast =
  | { kind: 'listening_together'; count: number }
  | { kind: 'message_sent'; user: MockUser }
  | { kind: 'waved'; user: MockUser }
  | { kind: 'top_track'; track: { title: string; artist: string } }
  | { kind: 'top_20'; rank: number }
  /** Direct message from Ana Castela — brand-style notification
   *  surfaced with her own avatar instead of a random pravatar. */
  | { kind: 'ana_message' }
  /** New publication from the "Central de Fãs" account — brand-
   *  level feed announcement, also uses Ana's central portrait. */
  | { kind: 'new_publication' }
  /** Mensagem REAL vinda do socket. Quando essa entry é a próxima
   *  a exibir, o rotator pula do mock e renderiza dados reais
   *  (nome + avatar + snippet do remetente). */
  | { kind: 'real_message'; data: RealChatToastDetail };

/**
 * Pre-baked rotation order. Each tick advances by one; the array
 * wraps so the same sequence repeats. The `+455` listening pill
 * is interleaved between the other types per product feedback
 * ("intercale ... com outras notificações"). New brand-level
 * types (ana_message, new_publication) are sprinkled in so they
 * surface alongside the user-level ones at a comfortable cadence.
 */
/* Per feedback "Remova a simulação de aceno automático da plataforma":
 * todas as entries `{ kind: 'waved' }` foram retiradas da ROTATION.
 * O type 'waved' continua definido em MockToast pra não quebrar tipos,
 * mas não rota mais — sem toast textual "X te acenou" mocado, sem
 * cascata de 👋 disparada por timer. Acenos reais (via socket /
 * useNotificationsLive) continuam funcionando normalmente. */
const ROTATION: MockToast[] = [
  { kind: 'listening_together', count: 455 },
  { kind: 'ana_message' },
  { kind: 'message_sent', user: MOCK_USERS[0] },
  { kind: 'listening_together', count: 482 },
  { kind: 'new_publication' },
  { kind: 'top_track', track: MOCK_TRACKS[0] },
  { kind: 'message_sent', user: MOCK_USERS[1] },
  { kind: 'top_20', rank: 18 },
  { kind: 'listening_together', count: 471 },
  { kind: 'ana_message' },
  { kind: 'top_track', track: MOCK_TRACKS[1] },
  { kind: 'message_sent', user: MOCK_USERS[3] },
  { kind: 'listening_together', count: 493 },
  { kind: 'new_publication' },
  { kind: 'top_20', rank: 12 },
  { kind: 'top_track', track: MOCK_TRACKS[2] },
];

/* ── Stack tuning (iOS Notifications pattern) ───────────────
 *
 * Per spec "Mantenha as notificações mocadas empilhadas usando
 * o motion até juntar 10, com a opção de fechá-las. Depois elas
 * podem desaparecer. Ao clicar, elas devem ser expandidas para
 * ver uma a uma. Use a iOS Notifications stack."
 *
 * Mock cadence: 1 toast a cada ~3.5s até atingir MAX_STACK.
 * Quando o stack está cheio, a fila de mocks pausa; mensagens
 * REAIS (chat) ainda entram e empurram a mais antiga não-pinned.
 * Após 30s sem nenhum push novo, o stack faz auto-clear via fade.
 */
const MAX_STACK = 10;
const MOCK_PUSH_INTERVAL_MS = 3500;
const AUTO_CLEAR_AFTER_IDLE_MS = 30_000;
/** Quantos toasts ficam visíveis no collapsed stack (resto fica
 *  oculto atrás dos top 3). Top 3 mostram com scale-down. */
const VISIBLE_PEEK = 3;

interface StackItem {
  /** Auto-increment id — usado como React key + dismissId. */
  id: number;
  toast: MockToast;
  /** Real messages são "pinned" — quando stack está cheio, mocks
   *  são droppados antes de pins. */
  pinned: boolean;
}

/** Brand-palette confetti colors shared with FeedCelebration so
 *  the rank-up burst feels like the same family as the quiz-win
 *  celebration the user explicitly compared it to. */
const CONFETTI_COLORS = [
  '#4F46E5',
  '#7C3AED',
  '#0284C7',
  '#0F766E',
  '#15803D',
  '#D97706',
  '#DC2626',
  '#DB2777',
  '#3DDB74',
];

/** Fire the same three-origin confetti burst FeedCelebration uses
 *  when the user solves a quiz correctly. Difference: this burst
 *  uses canvas-confetti's GLOBAL canvas (no scoping), so the
 *  particles cover the full viewport — appropriate for a toast
 *  that lives outside the feed envelope. */
function fireRankConfetti() {
  const defaults = {
    spread: 70,
    ticks: 200,
    gravity: 0.9,
    decay: 0.94,
    startVelocity: 32,
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  };
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.2, y: 0.7 } });
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.65 } });
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.8, y: 0.7 } });
}

export default function MockToastRotator() {
  /* Stack ordenado cronologicamente: index 0 = mais antigo, último
   *  = mais recente (topo do stack). Visualmente o último renderiza
   *  por cima (z-index maior). */
  const [stack, setStack] = useState<StackItem[]>([]);
  /* Tap no stack collapsed expande pra lista vertical individual;
   *  tap de novo collapse. */
  const [expanded, setExpanded] = useState(false);
  const counterRef = useRef(0);
  const mockIdxRef = useRef(0);
  /* Timestamp do último push (mock ou real). Usado pelo auto-clear
   *  pra detectar idle. */
  const lastPushAtRef = useRef<number>(0);
  /* Chat/router pra abrir conv real ao clicar no toast expandido. */
  const { chat } = useAppShell();
  const router = useRouter();

  /* Push novo mock toast a cada MOCK_PUSH_INTERVAL_MS, até MAX_STACK.
   *  Se o stack está cheio, NÃO faz push de mocks (deixa o user
   *  dismissar). Reais entram independente via handler abaixo. */
  useEffect(() => {
    const interval = window.setInterval(() => {
      setStack((prev) => {
        if (prev.length >= MAX_STACK) return prev;
        counterRef.current += 1;
        const next = ROTATION[mockIdxRef.current % ROTATION.length];
        mockIdxRef.current += 1;
        lastPushAtRef.current = Date.now();
        return [...prev, { id: counterRef.current, toast: next, pinned: false }];
      });
    }, MOCK_PUSH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  /* Listener pra mensagens REAIS via socket. Sempre entra (pinned),
   *  drop oldest non-pinned se stack está cheio. */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RealChatToastDetail>).detail;
      if (!detail?.senderName) return;
      setStack((prev) => {
        /* Dedupe consecutivo (same sender + snippet). */
        const last = prev[prev.length - 1];
        if (
          last &&
          last.toast.kind === 'real_message' &&
          last.toast.data.senderName === detail.senderName &&
          last.toast.data.snippet === detail.snippet
        ) {
          return prev;
        }
        counterRef.current += 1;
        const newItem: StackItem = {
          id: counterRef.current,
          toast: { kind: 'real_message', data: detail },
          pinned: true,
        };
        lastPushAtRef.current = Date.now();
        if (prev.length >= MAX_STACK) {
          /* Tenta dropar o oldest non-pinned; se todos pinned,
           *  dropa o oldest mesmo. */
          const dropIdx = prev.findIndex((t) => !t.pinned);
          if (dropIdx !== -1) {
            return [
              ...prev.slice(0, dropIdx),
              ...prev.slice(dropIdx + 1),
              newItem,
            ];
          }
          return [...prev.slice(1), newItem];
        }
        return [...prev, newItem];
      });
    };
    window.addEventListener('app:chat-message-toast', handler);
    return () => window.removeEventListener('app:chat-message-toast', handler);
  }, []);

  /* Auto-clear depois de idle (AUTO_CLEAR_AFTER_IDLE_MS sem push).
   *  Roda a cada 3s checando o lastPushAtRef. */
  useEffect(() => {
    if (stack.length === 0) return;
    const id = window.setInterval(() => {
      const idleFor = Date.now() - lastPushAtRef.current;
      if (idleFor >= AUTO_CLEAR_AFTER_IDLE_MS) {
        setStack([]);
        setExpanded(false);
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [stack.length]);

  /* Side-effect: rank-up confetti (desativado per feedback —
   *  mantido como hook futuro). */
  useEffect(() => {
    if (stack.length === 0) return;
    const last = stack[stack.length - 1];
    if (last.toast.kind === 'top_20') {
      /* fireRankConfetti() permanece comentado — feedback "estão
       *  ocorrendo muitas e eram pra ser poucas" */
    }
  }, [stack]);

  const dismissOne = (id: number) => {
    setStack((prev) => prev.filter((t) => t.id !== id));
  };

  if (stack.length === 0) return null;

  /* Click handler do container — só toggla expand quando stack
   *  tem múltiplos itens. Stop propagation no dismiss/clickable
   *  child evita disparar isso por engano. */
  const handleContainerClick = () => {
    if (stack.length > 1) setExpanded((v) => !v);
  };

  return (
    <div
      className={`${styles.root} ${expanded ? styles.rootExpanded : ''}`}
      aria-live="polite"
      onClick={handleContainerClick}
    >
      <AnimatePresence initial={false}>
        {stack.map((item, i) => {
          /* depth: 0 = topo (newest), 1+ = peek atrás.
           *  Collapsed: top 3 visíveis, mais antigos opacity 0.
           *  Expanded: todos visíveis em coluna. */
          const depth = stack.length - 1 - i;
          const isTop = depth === 0;
          /* Peek pra CIMA: cards mais antigos sobem 8/16px e
           *  encolhem progressivamente atrás do top. */
          const peekY = expanded ? 0 : -(depth * 8);
          const peekScale = expanded ? 1 : 1 - depth * 0.04;
          const peekOpacity = expanded
            ? 1
            : depth >= VISIBLE_PEEK
              ? 0
              : 1 - depth * 0.18;
          /* Clicáveis: real_message expanded → abre conv.
           *  Mocks ficam decorativos. */
          const clickable =
            expanded && item.toast.kind === 'real_message';

          return (
            <motion.div
              key={item.id}
              layout
              className={`${styles.toast} ${expanded ? styles.toastExpanded : ''} ${clickable ? styles.toastClickable : ''}`}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{
                opacity: peekOpacity,
                y: peekY,
                scale: peekScale,
              }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              style={{
                zIndex: 100 - depth,
                pointerEvents: isTop || expanded ? 'auto' : 'none',
              }}
              role="status"
              onClick={(e) => {
                /* Stop propagation pra container handler não
                 *  togglear expand quando o user clica no toast
                 *  individual durante o expanded state. */
                if (expanded) e.stopPropagation();
                if (clickable && item.toast.kind === 'real_message') {
                  chat.open(item.toast.data.conversationId);
                  router.push('/app/chat');
                }
              }}
            >
              <ToastBody toast={item.toast} />
              {expanded && (
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissOne(item.id);
                  }}
                  aria-label="Fechar notificação"
                >
                  <svg viewBox="0 0 10 10" width="10" height="10" fill="none" aria-hidden="true">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ClickableToast wrapper removido — chat.open/router.push agora
 *  ficam inline no handler do motion.div dentro de MockToastRotator
 *  (componente único após refator pro stack pattern). */

function ToastBody({ toast }: { toast: MockToast }) {
  switch (toast.kind) {
    case 'listening_together': {
      // Cascade reveal: each subsequent avatar staggers in by
      // 140ms (driven by `--avatar-i` in CSS) so the stack lands
      // one-by-one — the same "users surgindo um por cima do
      // outro" animation the previous ListeningTogether had.
      // 3 avatars per product feedback (was 4 → reduced by 1 so
      // the audio-bar animation comfortably fits inline on the
      // same row as the text). Avatars are sized smaller than
      // the standardized 36px avatar slot (24px each) to make
      // room for the row to stay single-line.
      const cascadeAvatars = [
        MOCK_USERS[0],
        MOCK_USERS[2],
        MOCK_USERS[4],
      ];
      return (
        <>
          <div className={styles.avatarStack} aria-hidden="true">
            {cascadeAvatars.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u.name}
                src={u.avatar}
                alt=""
                className={styles.avatarStackItem}
                style={{ ['--avatar-i' as string]: i } as React.CSSProperties}
              />
            ))}
          </div>
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>
                +{toast.count.toLocaleString('pt-BR')} pessoas
              </strong>{' '}
              ouvindo com você
            </span>
            <span className={styles.audioBars} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </div>
        </>
      );
    }

    case 'message_sent':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toast.user.avatar} alt="" className={styles.avatar} />
          {/* Single-line variant per product feedback: the
            * "Toque pra abrir o chat" CTA row was removed,
            * leaving just the actor + action sentence. */}
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.user.name}</strong>{' '}
              enviou uma mensagem
            </span>
          </div>
        </>
      );

    case 'real_message':
      /* Toast vindo do socket — dados reais do remetente. Mesmo
       * layout do `message_sent` mockado mas com avatar dinâmico
       * + snippet do body. Fallback do avatar pro silhouette
       * padrão quando o user não tem foto. */
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toast.data.senderAvatarUrl ?? '/avatar-placeholder.svg'}
            alt=""
            className={styles.avatar}
          />
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              <strong className={styles.strong}>
                {toast.data.senderName}
              </strong>{' '}
              enviou uma mensagem
            </span>
          </div>
        </>
      );

    case 'waved':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toast.user.avatar} alt="" className={styles.avatar} />
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            {/* Single-line variant per product feedback: just the
              * actor + "acenou para você" + a waving-hand emoji.
              * The previous CTA ("Mande um aceno de volta") was
              * removed to keep the row minimal. */}
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.user.name}</strong>{' '}
              acenou para você{' '}
              <span className={styles.waveEmojiInline} aria-hidden="true">
                👋
              </span>
            </span>
          </div>
        </>
      );

    case 'top_track':
      return (
        <>
          {/* Album cover in the standardized 36px avatar slot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/single.png"
            alt=""
            className={styles.avatar}
            aria-hidden="true"
          />
          {/* Single-line layout to match every other notification
            * type. The artist-name subtitle was dropped — it was
            * always "Ana Castela" in this mock pool anyway, and
            * keeping the line meant the row was taller than the
            * standardized height. Audio bars sit inline next to
            * the text. */}
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.track.title}</strong>{' '}
              é a sua mais ouvida
            </span>
            <span className={styles.audioBars} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </div>
        </>
      );

    case 'ana_message':
      return (
        <>
          {/* Direct-from-the-artist DM notification per product
            * feedback. Avatar is the personal Ana Castela
            * headshot (/ana-castela.png), distinct from the
            * Central de Fãs brand portrait used by the
            * new_publication case so the two notification
            * types read as different surfaces. Strong name
            * shows the full "Ana Castela" instead of just
            * "Ana" — more recognizable across the platform. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela.png"
            alt=""
            className={styles.avatar}
            aria-hidden="true"
          />
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              <strong className={styles.strong}>Ana Castela</strong> te
              mandou uma mensagem
            </span>
          </div>
        </>
      );

    case 'new_publication':
      return (
        <>
          {/* New publication from the Central de Fãs account —
            * same Ana portrait the ana_message case uses since the
            * Central is the brand-level publisher for her hub. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/central-anacastela.png"
            alt=""
            className={styles.avatar}
            aria-hidden="true"
          />
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              <strong className={styles.strong}>Central de Fãs</strong> fez
              uma nova publicação
            </span>
          </div>
        </>
      );

    case 'top_20':
      return (
        <>
          {/* Crown glyph signals ranking — same icon family used
            * in the Fanpoints surface so the visual language ties
            * back to the existing rewards loop. Wrapped in a
            * `.glyphFestive` container that paints CSS-only
            * confetti particles around the crown — 8 small dots
            * popping outward in a celebration burst keyframe. */}
          <span
            className={`${styles.glyph} ${styles.glyphFestive}`}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
            </svg>
            {/* Confetti particles — 8 spans positioned around
              * the glyph via :nth-child rules in CSS. Each
              * particle has its own delay so the burst feels
              * staggered. */}
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
          </span>
          {/* Single-line variant per product feedback: the
            * "Continue ouvindo pra subir" subtitle was removed,
            * leaving just the ranking line + the festive crown
            * + confetti glyph. */}
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              Você está no{' '}
              <strong className={styles.strong}>TOP {toast.rank}</strong> de
              Superfãs!
            </span>
          </div>
        </>
      );
  }
}
