'use client';

import { useMemo } from 'react';
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
  label?: string;
  ring?: 'green' | 'pink' | 'none';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Quando `false` (default), o avatar começa invisível
   * (opacity 0) e ENTRA com fade. Usado pelos avatares
   * revelados via scroll na AvatarConstellation. Quando
   * `true`, está visível imediatamente.
   */
  revealed?: boolean;
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
  ring = 'none',
  size = 'sm',
  revealed = true,
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

  return (
    <div
      className={[
        styles.wrap,
        labelPosition === 'below' ? styles.wrapColumn : styles.wrapRow,
        revealed ? styles.revealed : styles.hidden,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <div
        className={[styles.avatar, ringClass].filter(Boolean).join(' ')}
        style={{
          width: px,
          height: px,
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarInitials}>{initials}</span>
        )}
      </div>

      {label && (
        <div className={styles.labelGroup}>
          {/* Ícone de "ouvindo" — pequena barra de chart verde
           *  que aparece à esquerda do label per wireframe. */}
          <span className={styles.listeningIcon} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className={styles.label}>{label}</span>
        </div>
      )}
    </div>
  );
}
