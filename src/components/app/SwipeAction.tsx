'use client';

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'motion/react';
import styles from './SwipeAction.module.css';

/**
 * SwipeAction — wrapper iOS-style: swipe left no conteúdo revela
 * um botão destrutivo (geralmente "Apagar") atrás. Drag horizontal
 * só pra esquerda (constraints { left: -actionWidth, right: 0 }),
 * com snap em 2 estados: 0 (fechado) ou -actionWidth (aberto).
 *
 * Pattern motion:
 *   - useMotionValue(x) controla o transform do foreground.
 *   - useTransform(x → opacity/scale) escala/revela o botão
 *     enquanto o user arrasta.
 *   - Velocity threshold + offset threshold determinam o snap final
 *     (mesma heurística do iOS).
 *
 * Click no botão dispara `onAction()` e fecha automaticamente.
 * Tap no foreground enquanto aberto também fecha (gate via
 * onClickCapture preveniu propagação pra child onClick).
 */
interface SwipeActionProps {
  /** Conteúdo principal (a row do chat, por ex). */
  children: React.ReactNode;
  /** Label do botão revelado. */
  actionLabel: string;
  /** Handler quando o user toca o botão. Recebe close() pra UI
   *  controlar o fechamento (ou pra fechar antes do API call). */
  onAction: () => void;
  /** Largura do slot do botão. Default 80px — toque confortável
   *  + label cabe ("Apagar" / "Arquivar"). */
  actionWidth?: number;
  /** Aria-label do botão pra screen readers. */
  actionAriaLabel?: string;
  /** Classe extra no wrapper (ex: pra herdar background do parent). */
  className?: string;
}

export default function SwipeAction({
  children,
  actionLabel,
  onAction,
  actionWidth = 80,
  actionAriaLabel,
  className,
}: SwipeActionProps) {
  const x = useMotionValue(0);
  /* Opacity do botão cresce de 0 a 1 conforme o drag avança até
   *  -actionWidth. Dá feedback visual antes do snap completar. */
  const actionOpacity = useTransform(x, [-actionWidth, -actionWidth / 2, 0], [1, 0.6, 0]);
  /* Background do foreground ligado ao drag: TRANSPARENTE em repouso
   *  (pro card herdar a cor translúcida do filho — ex: .row do chat
   *  com rgba branco, igual aos cards de Comunidades) e OPACO assim
   *  que o swipe começa, pra mascarar o botão "Apagar" vermelho atrás.
   *  Em repouso o .action já está em opacity 0, então não vaza. */
  const foregroundBg = useTransform(x, [-6, 0], ['#0a0a0e', 'rgba(10, 10, 14, 0)']);
  /* Captura ref pro acesso programático no onAction (fechar). */
  const isOpenRef = useRef(false);

  const close = () => {
    isOpenRef.current = false;
    x.set(0);
  };

  const open = () => {
    isOpenRef.current = true;
    x.set(-actionWidth);
  };

  const handleDragEnd = (_: PointerEvent, info: PanInfo) => {
    /* Snap rules iOS:
     *   - velocity esquerda forte (>500) → abre
     *   - velocity direita forte (>500) → fecha
     *   - else: snap pela posição (passou metade do actionWidth?) */
    const dragged = info.offset.x;
    const v = info.velocity.x;
    if (v < -500 || (v < 0 && dragged < -actionWidth / 2)) {
      open();
    } else if (v > 500 || dragged > -actionWidth / 2) {
      close();
    } else {
      open();
    }
  };

  const handleActionClick = () => {
    onAction();
    close();
  };

  /* Click no foreground fecha quando aberto, sem propagar (pra
   *  que o click não dispare o handler do child como "open row"). */
  const handleForegroundClickCapture = (e: React.MouseEvent) => {
    if (isOpenRef.current) {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* Background com botão revelado — fica atrás do foreground. */}
      <motion.button
        type="button"
        className={styles.action}
        style={{ width: actionWidth, opacity: actionOpacity }}
        onClick={handleActionClick}
        aria-label={actionAriaLabel ?? actionLabel}
        tabIndex={isOpenRef.current ? 0 : -1}
      >
        {actionLabel}
      </motion.button>

      {/* Foreground — o conteúdo "deslizável". touch-action pan-y
       *  permite scroll vertical da lista coexistir com swipe
       *  horizontal aqui. */}
      <motion.div
        className={styles.foreground}
        drag="x"
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        style={{ x, touchAction: 'pan-y', background: foregroundBg }}
        onDragEnd={handleDragEnd}
        onClickCapture={handleForegroundClickCapture}
      >
        {children}
      </motion.div>
    </div>
  );
}
