'use client';

import { motion, useReducedMotion } from 'motion/react';
import styles from './MediaBlinds.module.css';

/**
 * MediaBlinds — efeito "curtains / blinds" (motion.dev/examples/js-curtains-blinds)
 * aplicado sobre a imagem do media pane da auth (desktop). Vários slats
 * verticais cobrem a foto e "abrem" no mount, em cascata, revelando a
 * imagem por trás — origem alternada (topo/baixo) dá o ar de persiana.
 *
 * Decorativo (aria-hidden). Respeita prefers-reduced-motion: sem reveal,
 * a foto já aparece direto. Só é visível no desktop porque o `.mediaPane`
 * é display:none no mobile.
 */

const STRIPS = 7;

export default function MediaBlinds() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className={styles.blinds} aria-hidden="true">
      {Array.from({ length: STRIPS }).map((_, i) => (
        <motion.span
          key={i}
          className={styles.strip}
          style={{ transformOrigin: i % 2 === 0 ? 'top' : 'bottom' }}
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{
            duration: 0.72,
            delay: 0.12 + i * 0.085,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </div>
  );
}
