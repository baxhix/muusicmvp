'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import VerifiedBadge from './VerifiedBadge';
import { globeStore } from '@/lib/globeStore';
import {
  SUPERLIVE_FANS,
  SUPERLIVE_MESSAGES,
  type SuperliveFan,
} from '@/lib/superliveFakeData';
import styles from './ShowLiveStage.module.css';

/* Arena Fonte Nova — Salvador, BA. Coordenadas + zoom + pitch
 * que produzem o ângulo de "câmera baixa olhando pro palco"
 * referência do álbum Fire Arena. */
const ARENA_FONTE_NOVA = {
  center: [-38.5042, -12.9789] as [number, number],
  zoom: 16,
  pitch: 65,
  bearing: -12,
  duration: 2400,
};

/* Vídeo de teste embed YouTube. nocookie domain pra cumprir o
 * CSP report-only definido em next.config.ts. autoplay+mute pra
 * evitar block do browser; loop via playlist=ID (workaround
 * conhecido pra um único vídeo). */
const YOUTUBE_EMBED_URL =
  'https://www.youtube-nocookie.com/embed/SMXOwEe0gP0' +
  '?autoplay=1&mute=1&controls=0&loop=1&playlist=SMXOwEe0gP0' +
  '&modestbranding=1&playsinline=1&rel=0&showinfo=0';

/* ==============================================================
 * SHOW AO VIVO — brainstorm stage experience
 *
 * Full-screen overlay que transforma o mapa em "palco":
 *
 *   - Vinheta dark cobre TODA a viewport (rgba 0.85), com um
 *     buraco circular no centro horizontal/vertical que revela
 *     o mapa por baixo (a Arena Fonte Nova quando o user navegou
 *     pra lá).
 *   - Luzes de palco animadas — anéis rosa/magenta pulsantes
 *     em volta do buraco, evocando o objeto do braço de luzes
 *     que dá nome ao álbum Fire Arena.
 *   - Frame de transmissão ACIMA do buraco (top-center) — mock
 *     visual com badge AO VIVO pulsante + Fire Arena lettering
 *     + contador de espectadores. Sem player real — fica como
 *     placeholder até integrar fonte.
 *   - Chat ao LADO (right) — mock scrolling igual ao
 *     SuperliveModal (reaproveita SUPERLIVE_FANS + MESSAGES).
 *   - Header label "Arena Fonte Nova · Salvador, BA"
 *     contextualizando o ponto no mapa.
 *   - Botão de fechar (×) no canto superior direito.
 *
 * Esc também fecha. Tap no backdrop NÃO fecha — o backdrop é
 * a vinheta e o user pode querer interagir com o mapa por
 * baixo (drag/zoom). Único caminho de saída é o × ou Esc.
 *
 * Mounted in /app/page.tsx via ShowLiveTrigger; o trigger
 * controla open/closed e o flag gate (brainstorm).
 * ============================================================ */

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ChatLine {
  id: number;
  fan: SuperliveFan;
  body: string;
}

const MAX_VISIBLE_MESSAGES = 50;
const VIEWER_BASE = 48_213;
const VIEWER_DRIFT = 520;
const MIN_TICK_MS = 1000;
const MAX_TICK_MS = 2400;

export default function ShowLiveStage({ open, onClose }: Props) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [viewers, setViewers] = useState(VIEWER_BASE);
  const [draft, setDraft] = useState('');
  const counterRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fanCursorRef = useRef(0);
  const msgCursorRef = useRef(0);

  /* Seed inicial — algumas mensagens pra abrir cheio (chat já
   * "rolando" quando o user entra). Determinístico por cursor
   * pra que reabrir mostre a mesma sequência inicial. */
  const initialLines = useMemo<ChatLine[]>(() => {
    const seed: ChatLine[] = [];
    for (let i = 0; i < 6; i++) {
      const fan = SUPERLIVE_FANS[(i * 3) % SUPERLIVE_FANS.length];
      const body = SUPERLIVE_MESSAGES[(i * 5) % SUPERLIVE_MESSAGES.length];
      seed.push({ id: -1 - i, fan, body });
    }
    return seed;
  }, []);

  // Reset on (re)open pra que o estado fique fresco.
  useEffect(() => {
    if (!open) {
      setLines([]);
      setDraft('');
      counterRef.current = 0;
      fanCursorRef.current = 0;
      msgCursorRef.current = 0;
      return;
    }
    setLines(initialLines);
    setViewers(VIEWER_BASE);
  }, [open, initialLines]);

  // Chat tick — append fake message com delay variável.
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const fanIdx = fanCursorRef.current % SUPERLIVE_FANS.length;
      const msgIdx = msgCursorRef.current % SUPERLIVE_MESSAGES.length;
      fanCursorRef.current += 7;
      msgCursorRef.current += 11;
      counterRef.current += 1;
      const next: ChatLine = {
        id: counterRef.current,
        fan: SUPERLIVE_FANS[fanIdx],
        body: SUPERLIVE_MESSAGES[msgIdx],
      };
      setLines((curr) => {
        const merged = [...curr, next];
        return merged.length > MAX_VISIBLE_MESSAGES
          ? merged.slice(merged.length - MAX_VISIBLE_MESSAGES)
          : merged;
      });
      const delay =
        MIN_TICK_MS + Math.floor(Math.random() * (MAX_TICK_MS - MIN_TICK_MS));
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 700);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // Viewer count drift.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setViewers((curr) => {
        const delta = Math.floor((Math.random() - 0.4) * VIEWER_DRIFT);
        return Math.max(VIEWER_BASE - 2000, curr + delta);
      });
    }, 3000);
    return () => clearInterval(id);
  }, [open]);

  // Auto-scroll do chat (bail se user scrolou pra cima manualmente).
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Esc fecha.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Inclina o mapa pra Arena Fonte Nova quando o stage abre.
   *  Globe salva o view atual antes de mover; ao fechar, exit
   *  restaura 1:1 (mesmo center/zoom/pitch/bearing que o user
   *  tinha antes de entrar no palco). Reentradas mantém o
   *  snapshot original. */
  useEffect(() => {
    if (!open) return;
    globeStore.enterCinematic(ARENA_FONTE_NOVA);
    return () => {
      globeStore.exitCinematic();
    };
  }, [open]);

  /* Anuncia o estado "show ao vivo" pro DOM via data-attribute
   *  no <html>. Outros componentes (ArtistBox, TopBar, banner,
   *  triggers de brainstorm) escutam via CSS selector
   *  `html[data-showlive="true"] .root` e fazem display:none.
   *  Mantém TODOS os outros chrome floaters do /app fora da
   *  cena enquanto o palco está aberto — único caminho de
   *  saída é o × ou Esc. */
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.showlive = 'true';
    return () => {
      delete document.documentElement.dataset.showlive;
    };
  }, [open]);

  /* Textbox de "mande pro telão" — local-only mock; só feedback
   * visual ao "enviar" mensagem mocks (gate de Top 10 Superfãs
   * mostrado abaixo). */
  const [stageMsg, setStageMsg] = useState('');
  const [stageMsgFlash, setStageMsgFlash] = useState(false);
  const handleStageMsgSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageMsg.trim()) return;
    setStageMsg('');
    setStageMsgFlash(true);
    window.setTimeout(() => setStageMsgFlash(false), 1400);
  };

  if (!open) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    counterRef.current += 1;
    const next: ChatLine = {
      id: counterRef.current,
      fan: {
        name: 'Você',
        avatar: '/avatar-placeholder.svg',
        tier: 'superfan',
      },
      body,
    };
    setLines((curr) =>
      [...curr, next].slice(-MAX_VISIBLE_MESSAGES),
    );
    setDraft('');
  };

  return (
    <div
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label="Show ao vivo — Arena Fonte Nova"
    >
      {/* ── Vinheta com buraco central ─────────────────────────
       *   SVG mask cria um círculo transparente no centro pelo
       *   qual o mapa por baixo aparece. O restante da viewport
       *   fica coberto pela vinheta escura (rgba 0.85).
       *   pointer-events-none pra que drag/zoom no mapa abaixo
       *   continue funcionando — só o cartão do vídeo, chat e
       *   close button capturam input. */}
      <div className={styles.vignette} aria-hidden="true">
        {/* Anéis de luz de palco — pulsam pra evocar o objeto
         *  do braço de luzes do álbum Fire Arena. Posicionados
         *  exatamente em cima do buraco da vinheta. */}
        <div className={styles.stageRing} />
        <div className={`${styles.stageRing} ${styles.stageRingDelay}`} />
        <div className={`${styles.stageRing} ${styles.stageRingFar}`} />
        {/* Luzes laterais — "spots" rosa apontando pro palco
         *  vindos dos cantos pra dar sensação de iluminação
         *  cênica vinda de cima. */}
        <div className={styles.stageSpotLeft} />
        <div className={styles.stageSpotRight} />
      </div>

      {/* ── Header label ───────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLabel}>
          <span className={styles.headerLive}>
            <span className={styles.liveDot} aria-hidden="true" />
            AO VIVO
          </span>
          <span className={styles.headerVenue}>
            Transmissão ao vivo Ana Castela
            <span className={styles.headerCity}> | Fire Arena</span>
          </span>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Sair do show"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Sponsor pill (oferecimento) ─────────────────────────
       *   Pílula preta arredondada abaixo do header com 3 logos
       *   reais via <img>. Arquivos SVG em /public/sponsors/ —
       *   trocar pelo asset oficial sem mudar nada de código.
       *   Cada slot tem largura máxima de 96px conforme spec. */}
      <div className={styles.sponsorPill}>
        <span className={styles.sponsorLabel}>um oferecimento</span>
        <span className={styles.sponsorLogos}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sponsors/brahma.svg"
            alt="Brahma"
            className={styles.sponsorLogo}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sponsors/vivo.svg"
            alt="Vivo"
            className={styles.sponsorLogo}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sponsors/ballantines.svg"
            alt="Ballantine's"
            className={styles.sponsorLogo}
          />
        </span>
      </div>

      {/* ── Frame de transmissão (central) ──────────────────────
       *   Substituiu o mock estático por um YouTube iframe real
       *   (autoplay muted loop) com overlays de chrome em cima
       *   (badge AO VIVO + viewer count + caption Fire Arena).
       *   Posição central na tela pra ser o foco da experiência;
       *   chat + map ficam ao redor. */}
      <div className={styles.broadcastFrame}>
        <div className={styles.broadcastInner}>
          {/* Anéis SVG decorativos por TRÁS do vídeo — agora em
           * rotateX 60deg (plano) pra parecer arena vista de
           * câmera baixa, igual ao objeto Fire Arena do álbum. */}
          <svg
            className={styles.broadcastRings}
            viewBox="0 0 200 60"
            fill="none"
            aria-hidden="true"
          >
            <ellipse cx="100" cy="30" rx="80" ry="10" stroke="currentColor" strokeWidth="2" />
            <ellipse cx="100" cy="30" rx="60" ry="7" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
            <ellipse cx="100" cy="30" rx="40" ry="4.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          </svg>

          <div className={styles.broadcastVideo}>
            <iframe
              src={YOUTUBE_EMBED_URL}
              title="Show ao vivo — Fire Arena"
              allow="autoplay; encrypted-media; picture-in-picture"
              className={styles.broadcastVideoIframe}
              loading="lazy"
            />
            {/* Chrome overlays — AO VIVO badge top-left,
             * viewers count top-right. Posicionados ABSOLUTE
             * sobre o iframe pra que o vídeo continue
             * controlando pixel-perfect. */}
            <div className={styles.broadcastVideoTopBar}>
              <span className={styles.broadcastLive}>
                <span className={styles.liveDot} aria-hidden="true" />
                AO VIVO
              </span>
              <span className={styles.broadcastViewers}>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {viewers.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Texto "FIRE ARENA" + "Ana Castela · Show de lançamento
           *  ao vivo" removidos per feedback — frame agora é só vídeo
           *  + anéis + chrome AO VIVO/viewers, sem caption redundante. */}
        </div>
      </div>

      {/* ── Caixa "Mande pro telão" ─────────────────────────────
       *   Textbox de 420×76 que mocka o envio de mensagem pro
       *   telão do estádio. Warning permanente sinalizando que a
       *   feature é gated em Top 10 Superfãs — o submit ainda
       *   funciona (mock) com flash visual, mas o aviso deixa
       *   claro que em prod só os top fans efetivamente vão pro
       *   telão. */}
      <form
        className={`${styles.stageMsgBox} ${stageMsgFlash ? styles.stageMsgFlash : ''}`}
        onSubmit={handleStageMsgSend}
      >
        <div className={styles.stageMsgHeader}>
          <span className={styles.stageMsgTitle}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M8 22h8M12 18v4" />
            </svg>
            Mande pro telão
          </span>
          <span className={styles.stageMsgLock}>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 1 1 8 0v4" />
            </svg>
            Top 10 Superfãs
          </span>
        </div>
        <div className={styles.stageMsgRow}>
          <input
            type="text"
            className={styles.stageMsgInput}
            placeholder={
              stageMsgFlash
                ? 'Mensagem enviada — apareceu no telão!'
                : 'Sua mensagem aparece no estádio…'
            }
            value={stageMsg}
            onChange={(e) => setStageMsg(e.target.value)}
            maxLength={80}
          />
          <button
            type="submit"
            className={styles.stageMsgSend}
            disabled={!stageMsg.trim()}
            aria-label="Mandar mensagem pro telão"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* ── Chat ao lado direito ───────────────────────────── */}
      <div className={styles.chatPanel}>
        <div className={styles.chatHeader}>
          <span className={styles.chatTitle}>Chat ao vivo</span>
          <span className={styles.chatCount}>
            {viewers.toLocaleString('pt-BR')} assistindo
          </span>
        </div>
        <div className={styles.chatStream} ref={chatScrollRef}>
          {lines.map((line) => (
            <div
              key={line.id}
              className={`${styles.chatLine} ${
                line.fan.tier === 'mod'
                  ? styles.chatLineMod
                  : line.fan.tier === 'superfan'
                    ? styles.chatLineSuperfan
                    : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.fan.avatar}
                alt=""
                className={styles.chatAvatar}
                aria-hidden="true"
              />
              <div className={styles.chatBody}>
                <span className={styles.chatName}>
                  {line.fan.name}
                  {line.fan.verified && <VerifiedBadge size={11} />}
                  {line.fan.tier === 'mod' && (
                    <span className={styles.chatTierBadge}>MOD</span>
                  )}
                  {line.fan.tier === 'superfan' && (
                    <span className={styles.chatTierBadge}>SUPERFÃ</span>
                  )}
                </span>
                <span className={styles.chatMessage}>{line.body}</span>
              </div>
            </div>
          ))}
        </div>
        <form className={styles.composer} onSubmit={handleSend}>
          <input
            type="text"
            className={styles.composerField}
            placeholder="Mande sua mensagem…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
          />
          <button
            type="submit"
            className={styles.composerSend}
            disabled={!draft.trim()}
            aria-label="Enviar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
