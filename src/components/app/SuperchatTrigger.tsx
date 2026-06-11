'use client';

import { useRouter } from 'next/navigation';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import styles from './SuperchatTrigger.module.css';

/**
 * Trigger brainstorm-gated do Superchat. Pílula no left-rail da home
 * que abre a sala global de chat dos fãs (rota /app/superchat).
 *
 * Movido do menu do perfil pro Brainstorm (per product feedback
 * "deixe a funcionalidade de Superchat dentro do Brainstorm e remova
 * do perfil"). Gated por `flags.superchat` + pelo toggle "Recursos em
 * teste" (BrainstormGate, no layout). Self-contained: lê o flag e
 * navega sozinho — só montar uma vez no bloco BrainstormGate.
 */
export default function SuperchatTrigger() {
  const { flags } = useBrainstormFlags();
  const router = useRouter();

  if (!flags.superchat) return null;

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={() => router.push('/app/superchat')}
      aria-label="Entre no Superchat"
      title="Entre no Superchat"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        className={styles.icon}
      >
        <path d="M4 2.5v11l9-5.5z" />
      </svg>
      <span className={styles.label}>Entre no Superchat!</span>
    </button>
  );
}
