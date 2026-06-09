'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import styles from './ChatFeatureDemo.module.css';

/**
 * ChatFeatureDemo — primeira feature da Section 3 da landing
 * /teste. Demonstra o chat da plataforma com mensagens animadas
 * entrando uma a uma + indicador "escrevendo" antes da resposta.
 *
 * Mecânica:
 *  - Sequência scripted de N steps (sent/received com typing
 *    indicator entre eles). Cada step tem `delay` (espera antes
 *    de aparecer) — encadeados pra criar a sensação de
 *    conversa em tempo real.
 *  - useInView no container ancora o início do loop ao primeiro
 *    scroll que coloca a section em vista; uma vez disparado,
 *    a sequência roda completa e reseta após 8s pra repetir
 *    (loop ambient).
 *  - Bubbles entram com motion: spring scale + slide + opacity.
 *  - Typing indicator: 3 dots com animate scale loop.
 *  - Bubbles sent (próprio user) ficam à direita, gradient brand.
 *  - Bubbles received ficam à esquerda, glass dark.
 *
 * Visual: tela mock estilo iMessage com background ilustrativo
 * (a foto do casal usando celular do anexo do produto).
 */

type Step =
  | { kind: 'sent'; text: string }
  | { kind: 'received'; text: string }
  | { kind: 'typing'; side: 'left' | 'right'; duration: number };

/* Sequência roteirizada. Cada item dura ~1.6s na tela + typing
 *  precede recebidos. Total ~14s antes de resetar. */
const SCRIPT: Step[] = [
  { kind: 'sent', text: 'Oi! Você curte Ana Castela?' },
  { kind: 'typing', side: 'left', duration: 1800 },
  { kind: 'received', text: 'Curto demais 🤠 vi ela em Cuiabá!' },
  { kind: 'sent', text: 'Eu tô indo na Fire Arena dia 24/05' },
  { kind: 'typing', side: 'left', duration: 1500 },
  { kind: 'received', text: 'Sério?! Eu também! Vamos juntos?' },
  { kind: 'sent', text: 'Bora! Te chamo no chat 🔥' },
];

/* Delay entre steps (ms). Typing usa seu próprio duration; os
 *  outros usam STEP_DELAY base. */
const STEP_DELAY = 1300;
/* Pausa antes de resetar (depois do último step). */
const RESET_DELAY = 4000;

export default function ChatFeatureDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-20% 0px -20% 0px' });
  const [visibleSteps, setVisibleSteps] = useState<Step[]>([]);
  /* Index do próximo step a entrar. Reset volta pra 0. */
  const stepIdxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!inView) {
      /* Sai da vista: pausa o loop. */
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    /* Cada tick adiciona um step. Quando termina o SCRIPT, reset. */
    function advance() {
      const idx = stepIdxRef.current;
      if (idx >= SCRIPT.length) {
        /* Fim do script — pausa, depois reset. */
        timerRef.current = setTimeout(() => {
          setVisibleSteps([]);
          stepIdxRef.current = 0;
          advance();
        }, RESET_DELAY);
        return;
      }
      const step = SCRIPT[idx];

      if (step.kind === 'typing') {
        /* Typing: adiciona o indicator, agenda remoção após
         *  duration, depois next step. */
        setVisibleSteps((prev) => [...prev, step]);
        timerRef.current = setTimeout(() => {
          /* Remove o último step se for typing (substitui pelo
           *  próximo message). */
          setVisibleSteps((prev) =>
            prev.filter((s, i) => !(i === prev.length - 1 && s.kind === 'typing')),
          );
          stepIdxRef.current = idx + 1;
          advance();
        }, step.duration);
      } else {
        /* Sent/received: adiciona o bubble, agenda next step. */
        setVisibleSteps((prev) => [...prev, step]);
        timerRef.current = setTimeout(() => {
          stepIdxRef.current = idx + 1;
          advance();
        }, STEP_DELAY);
      }
    }

    advance();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inView]);

  return (
    <div ref={ref} className={styles.root}>
      {/* Per spec atualizado: headline em 1 linha centralizado
       *  (sem descrição, sem coluna de copy). Pattern alinhado
       *  com a CursorTrailGallery (Feature 02). */}
      <h3 className={styles.featureTitle}>Chat</h3>

      {/* Bubbles SOLTOS — sem mockup de celular, sem header,
       *  sem status bar. As caixas aparecem flutuando no canvas
       *  livre, layout = motion AnimatePresence. */}
      <div className={styles.stream} aria-label="Conversa">
        <AnimatePresence initial={false}>
          {visibleSteps.map((step, i) => {
            if (step.kind === 'typing') {
              return (
                <motion.div
                  key={`typing-${i}`}
                  layout
                  className={`${styles.bubbleRow} ${
                    step.side === 'right' ? styles.bubbleRowRight : ''
                  }`}
                  initial={{ opacity: 0, y: 12, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                >
                  <div className={`${styles.bubble} ${styles.bubbleReceived} ${styles.bubbleTyping}`}>
                    {[0, 1, 2].map((di) => (
                      <motion.span
                        key={di}
                        className={styles.typingDot}
                        animate={{
                          scale: [0.6, 1, 0.6],
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: di * 0.18,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            }
            const isSent = step.kind === 'sent';
            return (
              <motion.div
                key={`msg-${i}`}
                layout
                className={`${styles.bubbleRow} ${
                  isSent ? styles.bubbleRowRight : ''
                }`}
                initial={{
                  opacity: 0,
                  x: isSent ? 30 : -30,
                  y: 14,
                  scale: 0.88,
                }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.92,
                  transition: { duration: 0.22 },
                }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              >
                <div
                  className={`${styles.bubble} ${
                    isSent ? styles.bubbleSent : styles.bubbleReceived
                  }`}
                >
                  {step.text}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
