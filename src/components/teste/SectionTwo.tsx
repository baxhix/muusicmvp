'use client';

import FloatingAvatar from './FloatingAvatar';
import Sparkles from './Sparkles';
import styles from './SectionTwo.module.css';

/**
 * Section 2 — mock pra avaliar o floating dos avatares.
 *
 * Conceito: a câmera "avança" — mais avatares aparecem,
 * espalhados por todo o canvas com tamanhos variados. Esse
 * arranjo serve pra validar:
 *   - Como o idle float lê quando há 6+ avatares ao mesmo
 *     tempo (sincronização? colisão visual?).
 *   - Equilíbrio de cores dos rings (green vs pink vs none).
 *   - Hierarquia entre avatares grandes e pequenos.
 *
 * Conteúdo textual minimalista per fixação do produto
 * (Peace Sans + Inter, white space generoso). A frase central
 * é um placeholder pra iterar.
 */
export default function SectionTwo() {
  return (
    <section className={styles.section}>
      <Sparkles count={36} seed={21} />

      <div className={styles.center}>
        <h2 className={styles.heading}>
          Cada música<br />leva você a alguém.
        </h2>
      </div>

      {/* 6 avatares distribuídos — mistura de tamanhos e
       *  posições pra estressar a animação. */}
      <FloatingAvatar
        name="Júlia"
        label="Boiadeira - Ana Castela"
        size="sm"
        floatDelay={0.2}
        style={{ top: '14%', left: '14%' }}
      />
      <FloatingAvatar
        name="Pedro"
        label="Pipoco - Ana Castela"
        size="md"
        ring="green"
        floatDelay={1.0}
        style={{ top: '22%', right: '12%' }}
      />
      <FloatingAvatar
        name="Camila"
        label="Tropa do Chapelão"
        size="sm"
        floatDelay={2.1}
        style={{ top: '48%', left: '10%' }}
      />
      <FloatingAvatar
        name="Heitor"
        label="Rodeio no Texas - Diplo"
        size="md"
        ring="pink"
        floatDelay={0.8}
        style={{ top: '54%', right: '20%' }}
      />
      <FloatingAvatar
        name="Lia"
        label="Boiadeira - Ana Castela"
        size="sm"
        floatDelay={3.2}
        style={{ bottom: '14%', left: '22%' }}
      />
      <FloatingAvatar
        name="Bruno"
        label="Solto - Ana Castela"
        size="md"
        ring="green"
        floatDelay={1.6}
        style={{ bottom: '18%', right: '8%' }}
      />
    </section>
  );
}
