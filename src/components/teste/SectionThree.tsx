'use client';

import FloatingAvatar from './FloatingAvatar';
import Sparkles from './Sparkles';
import styles from './SectionThree.module.css';

/**
 * Section 3 — mock pra avaliar o floating dos avatares.
 *
 * Conceito: layout em diagonal — avatares formam uma
 * trajetória do top-left ao bottom-right, sugerindo uma
 * passagem/transição entre estados. Útil pra observar:
 *   - Se o idle float lê bem quando os avatares estão
 *     visualmente "alinhados" em diagonal (parecem flutuar
 *     em correnteza?).
 *   - Como o eye-tracking segue o headline curto à direita.
 *
 * Quantidade de avatares (7) propositalmente acima da Hero
 * pra testar o limite antes de ter performance/visual issues.
 */
export default function SectionThree() {
  return (
    <section className={styles.section}>
      <Sparkles count={32} seed={42} />

      <div className={styles.center}>
        <h2 className={styles.heading}>
          Descubra.<br />
          Conecte.<br />
          <span className={styles.headingAccent}>Pertença.</span>
        </h2>
      </div>

      {/* Diagonal top-left → bottom-right, 7 avatares
       *  variando tamanho/ring. */}
      <FloatingAvatar
        name="Aline"
        label="Boiadeira - Ana Castela"
        size="sm"
        floatDelay={0.4}
        style={{ top: '12%', left: '8%' }}
      />
      <FloatingAvatar
        name="Renato"
        label="Pipoco - Ana Castela"
        size="md"
        ring="green"
        floatDelay={1.2}
        style={{ top: '24%', left: '24%' }}
      />
      <FloatingAvatar
        name="Sofia"
        label="Solto - Ana Castela"
        size="md"
        ring="pink"
        floatDelay={2.0}
        style={{ top: '38%', left: '36%' }}
      />
      <FloatingAvatar
        name="Caio"
        label="Tropa do Chapelão"
        size="lg"
        ring="green"
        floatDelay={0.0}
        style={{ top: '46%', left: '50%' }}
      />
      <FloatingAvatar
        name="Bia"
        label="Rodeio no Texas - Diplo"
        size="md"
        ring="pink"
        floatDelay={2.8}
        style={{ top: '60%', right: '28%' }}
      />
      <FloatingAvatar
        name="Felipe"
        label="Boiadeira - Ana Castela"
        size="sm"
        floatDelay={1.6}
        style={{ bottom: '20%', right: '16%' }}
      />
      <FloatingAvatar
        name="Manu"
        label="Pipoco - Ana Castela"
        size="sm"
        ring="green"
        floatDelay={3.0}
        style={{ bottom: '10%', right: '6%' }}
      />
    </section>
  );
}
