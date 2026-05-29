'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
const ROTATION: MockToast[] = [
  { kind: 'listening_together', count: 455 },
  { kind: 'ana_message' },
  { kind: 'message_sent', user: MOCK_USERS[0] },
  { kind: 'waved', user: MOCK_USERS[2] },
  { kind: 'listening_together', count: 482 },
  { kind: 'new_publication' },
  { kind: 'top_track', track: MOCK_TRACKS[0] },
  { kind: 'message_sent', user: MOCK_USERS[1] },
  { kind: 'top_20', rank: 18 },
  { kind: 'listening_together', count: 471 },
  { kind: 'ana_message' },
  { kind: 'waved', user: MOCK_USERS[4] },
  { kind: 'top_track', track: MOCK_TRACKS[1] },
  { kind: 'message_sent', user: MOCK_USERS[3] },
  { kind: 'listening_together', count: 493 },
  { kind: 'new_publication' },
  { kind: 'top_20', rank: 12 },
  { kind: 'waved', user: MOCK_USERS[5] },
  { kind: 'top_track', track: MOCK_TRACKS[2] },
];

/** ms each toast holds visible before exiting. */
const HOLD_MS = 5200;
/** ms for the exit animation — must match `.toastExit` keyframe duration. */
const EXIT_MS = 400;
/** ms of empty space between one toast leaving and the next entering. */
const GAP_MS = 1100;
/** ms for the enter animation — must match `.toastEnter` keyframe. */
const ENTER_MS = 420;

type Phase = 'enter' | 'hold' | 'exit' | 'gap';

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
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('enter');
  /* Fila FIFO de mensagens REAIS que entraram via socket. Quando
   * o cycling avança (gap → enter), se essa fila tem item, ele
   * é desenfileirado e renderizado em vez do mock; senão segue o
   * ROTATION padrão. Limite de 8 itens evita acúmulo em explosão
   * de msgs (raro mas defensivo — o último ainda aparece).
   *
   * Per product feedback "deixe dinâmica o tipo de notificação
   * que aparece logo acima da bottombar quando o usuário manda
   * mensagem no Chat" — chat agora é a única "linha" do rotator
   * que reflete atividade real; outros tipos seguem mockados. */
  const realQueueRef = useRef<RealChatToastDetail[]>([]);
  const [currentReal, setCurrentReal] = useState<RealChatToastDetail | null>(null);

  /* Listener do evento global. Enfileira + DÁ PRIORIDADE: per
   * product feedback "notificações reais devem ter prioridade
   * sobre as notificações mocadas", se um mock está em hold/enter
   * no momento, corta pra `exit` imediatamente — assim a real
   * entra logo no próximo gap (sub-segundo de espera). Mock que
   * ia rodar fica perdido no ciclo (próxima volta da ROTATION
   * pega ele de novo, ou não — é demo, perda OK). */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RealChatToastDetail>).detail;
      if (!detail?.senderName) return;
      const q = realQueueRef.current;
      // Dedupe consecutivos do mesmo sender com mesmo snippet
      // (defensivo contra echo do socket no caso ímpar).
      const last = q[q.length - 1];
      if (
        last &&
        last.senderName === detail.senderName &&
        last.snippet === detail.snippet
      ) {
        return;
      }
      if (q.length >= 8) q.shift(); // drop o mais antigo
      q.push(detail);
      /* Prioridade: força o toast atual a iniciar saída agora se
       * estiver em hold/enter. NÃO interrompe um exit em progresso
       * (já está saindo). NÃO interrompe um currentReal (deixa
       * uma real anterior terminar antes da próxima). */
      setPhase((p) => {
        if (p === 'hold' || p === 'enter') {
          // Só se NÃO for já um real em exibição — preserva o
          // FIFO da fila pra reais consecutivas.
          if (currentRealRef.current) return p;
          return 'exit';
        }
        return p;
      });
    };
    window.addEventListener('app:chat-message-toast', handler);
    return () => {
      window.removeEventListener('app:chat-message-toast', handler);
    };
  }, []);

  /* Ref espelha o state pro listener acima conseguir checar sem
   * recriar o handler a cada mudança de currentReal. */
  const currentRealRef = useRef<RealChatToastDetail | null>(null);
  useEffect(() => {
    currentRealRef.current = currentReal;
  }, [currentReal]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'enter') {
      t = setTimeout(() => setPhase('hold'), ENTER_MS);
    } else if (phase === 'hold') {
      t = setTimeout(() => setPhase('exit'), HOLD_MS);
    } else if (phase === 'exit') {
      t = setTimeout(() => setPhase('gap'), EXIT_MS);
    } else {
      t = setTimeout(() => {
        // Próximo toast: consome a fila real primeiro, senão
        // avança no ROTATION mock.
        const next = realQueueRef.current.shift();
        if (next) {
          setCurrentReal(next);
        } else {
          setCurrentReal(null);
          setIdx((i) => (i + 1) % ROTATION.length);
        }
        setPhase('enter');
      }, GAP_MS);
    }
    return () => clearTimeout(t);
  }, [phase]);

  // Side-effects bound to specific notification types as they
  // enter the screen. Each runs ONCE per toast appearance via
  // the `phase === 'enter'` gate; the toast then proceeds through
  // its normal hold/exit phases.
  useEffect(() => {
    if (phase !== 'enter') return;
    // Real toasts não têm side effects (sem confetti, sem cascata).
    if (currentReal) return;
    const current = ROTATION[idx];
    if (current.kind === 'top_20') {
      // Confetti em rank-up DESATIVADO per product feedback
      // "Estão ocorrendo muitas e eram pra ser poucas" (opção B
      // Equilibrado). O toast textual "Você está no TOP 20!"
      // continua aparecendo, só não vem mais com burst de
      // canvas-confetti. fireRankConfetti() permanece definido
      // pra ser fácil religar gated num futuro marco específico.
      // fireRankConfetti();
    } else if (current.kind === 'waved') {
      // Falling 👋 cascade — fires the global overlay (mounted
      // in app/app/layout.tsx) with `icon: 'hand'` in the
      // detail so HeartsCascade swaps the flat red heart SVG
      // for a 👋 emoji glyph on each particle. Per product
      // feedback "Nas notificação mocada que determinado
      // usuário Acenou, use os emojis em cascata da mão e não
      // de coração." Real socket-driven wave-send events
      // (handled in `useNotificationsLive`) still default to
      // the heart cascade for the receiver's love confirmation.
      window.dispatchEvent(
        new CustomEvent('app:hearts-cascade', {
          detail: { icon: 'hand' },
        }),
      );
    }
  }, [phase, idx]);

  // During the gap, the pill is fully off-screen — render nothing
  // so even the empty container can't intercept pointer events.
  if (phase === 'gap') return null;

  /* Decide a entry visível: se há um real_message ativo, ele
   * roda neste ciclo; senão usa o mock indexado pelo idx. */
  const current: MockToast = currentReal
    ? { kind: 'real_message', data: currentReal }
    : ROTATION[idx];
  const exiting = phase === 'exit';
  /* Pílulas de real_message são clicáveis — levam direto pra
   * conversa que acabou de receber a mensagem. Mocks ficam
   * decorativos (sem ação ao clique). */
  const clickable = current.kind === 'real_message';

  return (
    <div className={styles.root} aria-live="polite">
      {clickable ? (
        <ClickableToast
          conversationId={(current as { kind: 'real_message'; data: RealChatToastDetail }).data.conversationId}
          exiting={exiting}
        >
          <ToastBody toast={current} />
        </ClickableToast>
      ) : (
        <div
          className={`${styles.toast} ${exiting ? styles.toastExit : styles.toastEnter}`}
          role="status"
        >
          <ToastBody toast={current} />
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper interativo pra toasts reais — ao clicar, abre a conv
 * que originou a mensagem. `chat.open(id)` carrega messages +
 * marca read; `router.push('/app/chat')` leva o user pra surface
 * de detalhe. Funciona em desktop (chat panel desliza) e mobile
 * (rota /app/chat renderiza o painel full-screen).
 *
 * Componente separado pra que o `useAppShell` + `useRouter` só
 * sejam invocados no caminho clicável (mocks não precisam).
 * `pointer-events: auto` no CSS sobrescreve o `.root` que tem
 * pointer-events:none por default (pra que o pill mock não
 * intercepte cliques no mapa abaixo).
 */
function ClickableToast({
  conversationId,
  exiting,
  children,
}: {
  conversationId: string;
  exiting: boolean;
  children: React.ReactNode;
}) {
  const { chat } = useAppShell();
  const router = useRouter();
  const handleClick = () => {
    chat.open(conversationId);
    router.push('/app/chat');
  };
  return (
    <button
      type="button"
      className={`${styles.toast} ${styles.toastClickable} ${exiting ? styles.toastExit : styles.toastEnter}`}
      onClick={handleClick}
      aria-label="Abrir conversa"
    >
      {children}
    </button>
  );
}

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
