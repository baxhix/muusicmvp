'use client';

import { useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform } from 'motion/react';

/**
 * MotionTextDemos — 4 efeitos de texto do motion/react renderizados
 * como seções da landing /teste, pro cliente avaliar o
 * comportamento de cada um antes de substituir o conteúdo real.
 *
 * Cada efeito é um componente isolado:
 *  1. TickerTextHover   — Ticker: Text hover effect
 *  2. ScrollTextLines   — linhas aparecem line-by-line com scroll
 *  3. SplitText         — caracteres animam em cascade no entrar
 *  4. RevealText        — mask de gradient wipa pra revelar texto
 *
 * Conteúdo: mock textual genérico (Lorem-ish em PT-BR mantendo
 * a vibe do app). Trocar o `text` prop substitui sem mexer
 * na animação.
 */

/* ============================================================
 * 1. TICKER: TEXT HOVER EFFECT
 * Cada caractere é uma "rodinha" — no hover, ele rola pra cima
 * e uma cópia colorida assume o lugar. Visual estilo split-flap
 * board / departure airport.
 * ============================================================ */
export function TickerTextHover({ text }: { text: string }) {
  return (
    <h2
      style={{
        fontFamily: "'Borscha', Inter, sans-serif",
        fontSize: 'clamp(48px, 8vw, 92px)',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.05,
        textAlign: 'center',
        margin: 0,
        color: 'rgba(245, 245, 247, 0.92)',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {text.split('').map((char, i) => (
        <TickerChar key={`${char}-${i}`} char={char} index={i} />
      ))}
    </h2>
  );
}

function TickerChar({ char, index }: { char: string; index: number }) {
  if (char === ' ') return <span>&nbsp;</span>;
  return (
    <motion.span
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        verticalAlign: 'top',
        lineHeight: 1,
      }}
      whileHover="hover"
      initial="idle"
    >
      {/* Top layer — caractere original. Translate Y pra cima
       *  no hover, revelando a cópia colorida embaixo. */}
      <motion.span
        style={{ display: 'inline-block' }}
        variants={{
          idle: { y: 0 },
          hover: { y: '-100%' },
        }}
        transition={{
          duration: 0.34,
          ease: [0.22, 1, 0.36, 1],
          delay: index * 0.015,
        }}
      >
        {char}
      </motion.span>
      {/* Bottom layer — cópia colorida (gradient brand). Sobe
       *  pra ocupar o lugar do original. position absolute pra
       *  ficar no mesmo slot vertical. */}
      <motion.span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          position: 'absolute',
          top: '100%',
          left: 0,
          background: 'linear-gradient(135deg, #ec4899 0%, #9333ea 60%, #6366f1 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
        variants={{
          idle: { y: 0 },
          hover: { y: '-100%' },
        }}
        transition={{
          duration: 0.34,
          ease: [0.22, 1, 0.36, 1],
          delay: index * 0.015,
        }}
      >
        {char}
      </motion.span>
    </motion.span>
  );
}

/* ============================================================
 * 2. SCROLL TEXT LINES
 * As linhas fadeam + sobem em sequência conforme o user scrolla
 * pela section. useInView por linha pra disparar individualmente.
 * Visual: tipografia editorial estilo Apple Newsroom.
 * ============================================================ */
export function ScrollTextLines({ lines }: { lines: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxWidth: 880,
        margin: '0 auto',
        padding: '0 24px',
      }}
    >
      {lines.map((line, i) => (
        <ScrollLine key={i} text={line} index={i} />
      ))}
    </div>
  );
}

function ScrollLine({ text, index }: { text: string; index: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  /* once: true — uma vez visível, fica visível pra sempre.
   *  margin: -10% — começa a animação quando a linha ainda
   *  está 10% antes de entrar no viewport, pra fluir natural. */
  const inView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' });
  return (
    <motion.p
      ref={ref}
      style={{
        fontFamily: "'Borscha', Inter, sans-serif",
        fontSize: 'clamp(28px, 4vw, 48px)',
        fontWeight: 400,
        letterSpacing: '-0.015em',
        lineHeight: 1.2,
        margin: 0,
        color: 'rgba(245, 245, 247, 0.88)',
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.08,
      }}
    >
      {text}
    </motion.p>
  );
}

/* ============================================================
 * 3. SPLIT TEXT
 * Cada caractere entra com stagger (y 24 → 0, opacity 0 → 1).
 * Quando a section entra no viewport, dispara a cascade.
 * Visual: classic "type-in" tipo Awwwards landing.
 * ============================================================ */
export function SplitText({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const chars = text.split('');
  return (
    <h2
      ref={ref}
      style={{
        fontFamily: "'Borscha', Inter, sans-serif",
        fontSize: 'clamp(40px, 7vw, 80px)',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.08,
        textAlign: 'center',
        margin: 0,
        color: '#fff',
        overflow: 'hidden',
      }}
      aria-label={text}
    >
      {chars.map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
          }}
          initial={{ opacity: 0, y: 24, rotate: -3 }}
          animate={
            inView
              ? { opacity: 1, y: 0, rotate: 0 }
              : { opacity: 0, y: 24, rotate: -3 }
          }
          transition={{
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
            delay: i * 0.025,
          }}
        >
          {char === ' ' ? ' ' : char}
        </motion.span>
      ))}
    </h2>
  );
}

/* ============================================================
 * 4. REVEAL TEXT EFFECT
 * Mask de gradient horizontal wipa do lado esquerdo pro direito
 * conforme o user scrolla — texto branco aparece "atrás" da
 * cortina. useScroll + useTransform mapeia scroll progress pra
 * background-position do mask.
 * Visual: estilo Apple "Hello." reveal / cinematic intro.
 * ============================================================ */
export function RevealText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  /* useScroll com offset ['start end', 'end start']:
   *   - 0 = topo da section toca a base do viewport (entrando)
   *   - 1 = base da section toca o topo do viewport (saindo)
   *  Mapeia o range util [0.2, 0.7] do scroll pra 0→100%
   *  do reveal — assim a animação completa ANTES da section
   *  sair, sem ficar congelada no meio. */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const maskPosition = useTransform(
    scrollYProgress,
    [0.2, 0.7],
    ['0% 0%', '100% 0%'],
  );
  /* maskSize fica fixa em 200% 100% — usado pra o wipe ser
   *  largo (a parte "revelada" do mask cobre 1× a largura,
   *  o resto fica do lado, deslizando via background-position). */

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      <motion.h2
        style={{
          fontFamily: "'Borscha', Inter, sans-serif",
          fontSize: 'clamp(56px, 10vw, 140px)',
          fontWeight: 700,
          letterSpacing: '-0.025em',
          lineHeight: 1,
          textAlign: 'center',
          margin: 0,
          /* Gradient horizontal: lado esquerdo branco puro,
           *  lado direito cinza-escuro (quase invisível no bg).
           *  Conforme background-position desliza pra esquerda,
           *  o branco aparece "vindo da direita pra esquerda". */
          background:
            'linear-gradient(90deg, rgba(245, 245, 247, 0.96) 0%, rgba(245, 245, 247, 0.96) 50%, rgba(245, 245, 247, 0.15) 50%, rgba(245, 245, 247, 0.15) 100%)',
          backgroundSize: '200% 100%',
          backgroundPosition: maskPosition,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {text}
      </motion.h2>
    </div>
  );
}

/* ============================================================
 * Section wrapper — padding + label "DEMO Nº — Effect name"
 * pra o cliente identificar qual efeito está vendo. Background
 * sutil pra separar das outras sections.
 * ============================================================ */
export function MotionTextDemoSection({
  label,
  effectName,
  children,
}: {
  label: string;
  effectName: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <section
      style={{
        position: 'relative',
        padding: '120px 24px',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 48,
        zIndex: 2,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Caption pill no topo da section. */}
      <motion.div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(245, 245, 247, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        animate={{ scale: hovered ? 1.04 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <span style={{ opacity: 0.5 }}>{label}</span>
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '999px',
            background:
              'linear-gradient(135deg, #ec4899 0%, #9333ea 100%)',
          }}
        />
        <span>{effectName}</span>
      </motion.div>
      {children}
    </section>
  );
}
