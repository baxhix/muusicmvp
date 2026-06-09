'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './FloatingAvatar.module.css';

/**
 * Avatar flutuante posicionado de forma absoluta na seção.
 *
 * Conceito: usuários "pousados" pelos cantos da hero (e em
 * outras seções), cada um mostrando o que está ouvindo. A
 * combinação avatar + label "Boiadeira - Ana Castela" comunica
 * o conceito do produto (descobrir o que outras pessoas
 * escutam) sem precisar de texto explicativo.
 *
 * Props:
 *   - `src` opcional: imagem do avatar. Sem src, renderiza um
 *     gradiente colorido + iniciais, igual ao Avatar do
 *     design system principal.
 *   - `name`: usado pra alt + iniciais quando sem src.
 *   - `label`: texto secundário ao lado/abaixo do avatar
 *     (ex.: "Boiadeira - Ana Castela").
 *   - `ring`: cor da borda circular. `'green'` = vivendo
 *     ativo; `'pink'` = destaque/favorito; `'none'` = sem
 *     borda colorida.
 *   - `size`: 'sm' (48px) | 'md' (72px) | 'lg' (96px).
 *   - `floatDelay`: offset (segundos) da animação idle de
 *     flutuação — diferente em cada instância pra que os
 *     avatares não respirem em sincronia (causaria efeito
 *     "estranho" de heartbeat coletivo).
 *   - `labelPosition`: onde o label aparece em relação ao
 *     avatar — 'right' (default) | 'below'.
 *   - `style`: posicionamento absoluto (top/left/right/bottom)
 *     vem por aqui pra que o consumer decida onde plantar cada
 *     avatar no canvas da seção.
 */

export interface FloatingAvatarProps {
  src?: string;
  name: string;
  /**
   * Label única (string) OU array que CICLA com fade suave
   * — pra mostrar diferentes tracks que aquele "usuário"
   * está escutando ao longo do tempo. Cycle a cada ~4s.
   */
  label?: string;
  labels?: string[];
  ring?: 'green' | 'pink' | 'none';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Quando `false` (default), o avatar começa invisível
   * (opacity 0) e ENTRA com fade. Usado pelos avatares
   * revelados via scroll na AvatarConstellation. Quando
   * `true`, está visível imediatamente.
   */
  revealed?: boolean;
  /**
   * Estilo "constellation circle" — usado em Section 4.
   * Avatar entra na cena radialmente (slide do exterior pro
   * círculo) + ganha drift sutil contínuo depois de revelado.
   */
  circling?: boolean;
  /**
   * Atraso pra começar o drift idle. Usado pra dessincronizar
   * avatares na circular constellation.
   */
  driftDelay?: number;
  labelPosition?: 'right' | 'below';
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Tamanhos em px. Default é `sm` (48px) per product feedback
 * "deixe no tamanho do usuário mocado JU, CA" — JU/CA eram os
 * sm da Section 2. */
const SIZE_PX: Record<NonNullable<FloatingAvatarProps['size']>, number> = {
  sm: 48,
  md: 56,
  lg: 64,
};

/** Iniciais a partir do nome completo. Max 2 caracteres. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hash determinístico → tom HSL pra fallback. Mesmo nome
 *  gera sempre o mesmo gradiente entre renders. */
function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

export default function FloatingAvatar({
  src,
  name,
  label,
  labels,
  ring = 'none',
  size = 'sm',
  revealed = true,
  circling = false,
  driftDelay = 0,
  labelPosition = 'right',
  style,
  className,
}: FloatingAvatarProps) {
  const px = SIZE_PX[size];
  const initials = useMemo(() => getInitials(name), [name]);

  /* Modo wireframe ativo per product feedback: rings coloridos
   * (green/pink) NÃO renderizam — todos os avatares saem como
   * placeholders cinza neutros. A prop `ring` continua aceita
   * pra back-compat futura mas não muda o visual no momento. */
  void ring;
  const ringClass = '';

  /**
   * Ciclo de labels com fade suave. Se `labels` for passado e
   * tiver mais de um item, o componente roteia entre eles a
   * cada 4 segundos. Fase de troca: 400ms fade-out → swap →
   * 400ms fade-in (~800ms total).
   *
   * Dessincronização per product feedback "não ficar todos
   * aparecendo e desaparecendo ao mesmo tempo": usamos um
   * `cycleStartOffset` derivado de hash do nome (estável,
   * sem random pra evitar hydration mismatch) que adia o
   * primeiro fade-out de 0-3.5s. Como os intervals duram
   * 4s, os avatares param em fases bem diferentes do ciclo
   * e nunca trocam de label ao mesmo tempo.
   *
   * Se só `label` (string) for passado, comportamento
   * legado: label fixo, sem ciclo.
   */
  const cycleList = labels && labels.length > 1 ? labels : null;
  const [labelIdx, setLabelIdx] = useState(0);
  const [labelVisible, setLabelVisible] = useState(true);

  const cycleStartOffset = useMemo(() => {
    // Hash do nome → offset em ms entre 0-3500 (cobre
    // praticamente o ciclo inteiro de 4000ms).
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = (h * 31 + name.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 3500;
  }, [name]);

  useEffect(() => {
    if (!cycleList) return;

    let outTimeout: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    function startCycle() {
      interval = setInterval(() => {
        setLabelVisible(false);
        outTimeout = setTimeout(() => {
          setLabelIdx((i) => (i + 1) % cycleList!.length);
          setLabelVisible(true);
        }, 400);
      }, 4000);
    }

    // Atraso inicial dessincroniza este avatar dos outros —
    // depois disso entra no ritmo de 4s. Cada avatar começa
    // em uma fase diferente do ciclo coletivo.
    const startTimer = setTimeout(startCycle, cycleStartOffset);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
      if (outTimeout) clearTimeout(outTimeout);
    };
  }, [cycleList, cycleStartOffset]);

  const currentLabel = cycleList ? cycleList[labelIdx] : label;

  /* Drift duration per avatar — derivado do hash do nome pra
   *  cada um respirar no próprio tempo (5.5s a 8.5s). Match com
   *  o que o CSS antigo fazia via --drift-duration. */
  const driftDuration = useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = (h * 31 + name.charCodeAt(i)) | 0;
    }
    return 5.5 + (Math.abs(h) % 30) / 10; // 5.5 → 8.5s
  }, [name]);

  /* Motion only kicks in pós-reveal pra evitar conflito com a
   *  CSS transition de opacity/y do estado hidden→revealed. */
  const driftAnim = revealed && circling
    ? {
        /* Trajetória "8-ish" — mesmo padrão do keyframe CSS
         *  (tloop-circle-drift) só que x/y desacoplados pra
         *  motion interpolar suave via keyframes array. */
        x: [0, 6, -3, -7, 4, 0],
        y: [0, -4, -8, 3, 7, 0],
      }
    : { x: 0, y: 0 };

  return (
    <motion.div
      className={[
        styles.wrap,
        labelPosition === 'below' ? styles.wrapColumn : styles.wrapRow,
        circling ? styles.circling : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      /* Reveal — opacity 0/8px → 1/0. y é a entrada sutil
       *  vinda de baixo. Spring suave pra não bater duro. */
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: revealed ? 1 : 0,
        y: revealed ? 0 : 8,
      }}
      transition={{
        opacity: { duration: revealed ? 0.7 : 0.4, ease: [0.22, 1, 0.36, 1] },
        y: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
      }}
      /* Hover — scale up sutil + ring brilho via filter. Não
       *  afeta o drift (motion compõe transforms). */
      whileHover={{ scale: 1.08 }}
    >
      {/* Drift wrapper — motion separado pro x/y oscilar em
       *  loop sem competir com o opacity/y do reveal. Aplicado
       *  só em modo .circling per spec original. */}
      <motion.div
        style={{ display: 'contents' }}
        animate={driftAnim}
        transition={{
          duration: driftDuration,
          repeat: revealed && circling ? Infinity : 0,
          ease: 'easeInOut',
          delay: driftDelay,
          times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        }}
      >
        <motion.div
          className={[
            styles.avatar,
            ringClass,
            !src ? styles.avatarFallback : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: px, height: px }}
          /* Tap feedback — pressiona o avatar levemente. */
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarInitials}>{initials}</span>
          )}
        </motion.div>

        {currentLabel && (
          <div className={styles.labelGroup}>
            {/* Ícone de "ouvindo" — 3 barras animadas via motion
             *  em vez de CSS keyframes. Cada barra com delay
             *  diferente pra dar o efeito de equalizer. */}
            <span className={styles.listeningIcon} aria-hidden="true">
              {[6, 11, 8].map((baseHeight, i) => (
                <motion.span
                  key={i}
                  style={{ height: baseHeight }}
                  animate={{
                    scaleY: [1, 0.4, 1, 0.7, 1],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.15,
                  }}
                />
              ))}
            </span>
            {/* AnimatePresence pra crossfade entre labels do
             *  cycleList — quando o currentLabel muda, o anterior
             *  exit (fade out) e o novo enter (fade in) sincros. */}
            <AnimatePresence mode="wait">
              <motion.span
                key={currentLabel}
                className={styles.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: labelVisible ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                {currentLabel}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
