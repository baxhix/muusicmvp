'use client';

import FanverseCore from '@/components/animations/FanverseCore';
import styles from './AuthSessionLoading.module.css';

/**
 * AuthSessionLoading — splash full-screen exibido enquanto o
 * AuthContext valida se há sessão ativa.
 *
 * Per spec "Fluxo de autenticação e transição de telas":
 *   - Eliminar piscada da tela de login quando já existe sessão.
 *   - Enquanto valida → mostrar loading dedicado.
 *   - Loading mínimo de 1-2s pra transição parecer intencional.
 *   - Se sessão existe → /app; senão → tela de login.
 *
 * O componente em si só renderiza o splash; o controle de quando
 * exibí-lo é responsabilidade do consumidor (EmailStep).
 */
export default function AuthSessionLoading({
  caption = 'Retomando sua sessão',
}: {
  caption?: string;
}) {
  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      aria-label={caption}
    >
      <div className={styles.orbWrap} aria-hidden="true">
        <FanverseCore />
      </div>
      <div className={styles.caption}>{caption}</div>
    </div>
  );
}
