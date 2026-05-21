'use client';

import FloatingAvatar from './FloatingAvatar';
import Sparkles from './Sparkles';
import styles from './HeroSection.module.css';

/* PhoneStack removido per product feedback — slot reservado pra
 * mockups reais de smartphones (com screenshots do app) que
 * entrarão na seção em uma iteração futura. */

/**
 * Section 1 — hero da landing experimental.
 *
 * Per wireframe:
 *   - Big headline "SUPERFÃS" centralizado (Peace Sans com
 *     fallback pra Inter 900).
 *   - Subtitle "O lugar certo para criar conexões" abaixo,
 *     leve, em texto-mute.
 *   - 3 avatares flutuantes nos cantos + meio-canto, cada um
 *     com label "ouvindo: Boiadeira - Ana Castela".
 *   - Sparkles (~24 pontos brancos) espalhados pelo bg.
 *   - 3 phone mockups cortados na base — sugerindo o app sem
 *     entregar a UI ainda.
 *
 * Concept de animação:
 *   - Cada avatar tem seu próprio idle float loop (delay
 *     diferente pra dessincronizar).
 *   - Sparkles pulsam com timing variável.
 *   - A convergência ao centro (próxima seção) é
 *     implementada como uma animação scroll-driven separada,
 *     fora do escopo deste componente.
 */
export default function HeroSection() {
  return (
    <section className={styles.hero}>
      <Sparkles count={28} seed={9} />

      <div className={styles.center}>
        <h1 className={styles.headline}>SUPERFÃS</h1>
        <p className={styles.subtitle}>
          O lugar certo para criar conexões
        </p>
      </div>

      {/* Decorative orb na direita (per wireframe) — esfera
       *  preta com leve gradient, sugere um planeta/universo. */}
      <div className={styles.orb} aria-hidden="true" />

      {/* Avatares plantados em pontos específicos. Os
       *  offsets (top/left/right) foram escolhidos pra que
       *  cada um pouse no quadrante que ele ocupa na
       *  referência visual. */}
      <FloatingAvatar
        name="Marina"
        label="Boiadeira - Ana Castela"
        size="sm"
        ring="none"
        floatDelay={0}
        style={{ top: '14%', left: '8%' }}
      />
      <FloatingAvatar
        name="Rafael"
        label="Boiadeira - Ana Castela"
        size="md"
        ring="green"
        labelPosition="right"
        floatDelay={1.4}
        style={{ bottom: '20%', left: '6%' }}
      />
      <FloatingAvatar
        name="Clara"
        label="Ana Castela · Olha o Pipoco"
        size="md"
        ring="pink"
        floatDelay={2.6}
        style={{ bottom: '20%', right: '6%' }}
      />
    </section>
  );
}
