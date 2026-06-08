'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useTransform, motion } from 'motion/react';

/**
 * NumberTicker — número que interpola do valor anterior pro novo
 * via `animate()` do motion. Diferente de mudar o text content
 * direto, isso dá efeito de "subir o contador" quando Fanpoints
 * incrementa, unread badge muda, member count cresce.
 *
 * Pattern motion: useMotionValue + animate() retornando controles;
 * useTransform mapeia valor → string formatada (pt-BR com pontos).
 *
 * Render: motion.span com `aria-live="polite"` pra screen readers
 * narrarem a mudança final (não cada frame intermediário).
 */
interface NumberTickerProps {
  value: number;
  /** Duração da interpolação em ms. Default 600. */
  durationMs?: number;
  /** Locale string pra formatar — default 'pt-BR' (com pontos). */
  locale?: string;
  /** Sufixo opcional (ex: " FP", "%"). */
  suffix?: string;
  /** Prefixo opcional (ex: "+", "R$"). */
  prefix?: string;
  className?: string;
}

export default function NumberTicker({
  value,
  durationMs = 600,
  locale = 'pt-BR',
  suffix = '',
  prefix = '',
  className,
}: NumberTickerProps) {
  const motionValue = useMotionValue(value);
  /* useTransform produz string formatada toda vez que motionValue
   *  muda — o motion.span re-renderiza só esse text node. */
  const display = useTransform(motionValue, (latest) => {
    return `${prefix}${Math.round(latest).toLocaleString(locale)}${suffix}`;
  });
  const [, setRender] = useState(0);
  const subscribedRef = useRef(false);

  /* useTransform alone não força re-render do React — precisamos
   *  do `.on('change')` subscription. Usamos um state minimal pra
   *  re-render. Alternativa seria <motion.span>{display}</motion.span>
   *  mas motion v12 requer wrapping pra texto reativo. */
  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;
    const unsub = display.on('change', () => setRender((n) => n + 1));
    return () => unsub();
  }, [display]);

  /* Anima sempre que `value` prop muda. animate() retorna controls
   *  pra cancelar se um novo value chega antes do anterior terminar. */
  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, durationMs, motionValue]);

  return (
    <motion.span className={className} aria-live="polite">
      {display.get()}
    </motion.span>
  );
}
