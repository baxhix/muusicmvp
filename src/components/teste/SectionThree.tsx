'use client';

import SectionCTA from './SectionCTA';
import ChatFeatureDemo from './ChatFeatureDemo';
import styles from './SectionThree.module.css';

/**
 * Section 3 — features da plataforma. Per spec atualizado,
 * essa section abriga as features animadas que mostram o que
 * o usuário pode fazer dentro do app. Primeira feature: Chat —
 * bubbles animados entrando + indicador "escrevendo" (estilo
 * iMessage).
 *
 * Próximas features (lugar reservado): playlist colaborativa,
 * notifications stack, fanpoints celebration, etc — cada uma
 * vai virar uma feature demo dentro dessa section.
 *
 * Headline + phrase + CTA continuam no topo pra ancorar a
 * narrativa; o ChatFeatureDemo aparece logo abaixo.
 */
export default function SectionThree() {
  return (
    <section
      id="section-3"
      data-section="3"
      className={styles.section}
    >
      <div className={styles.center}>
        <h2 className={styles.headline}>Pertencer</h2>
        <p className={styles.phrase}>
          Descubra, conecte e pertença a uma comunidade
        </p>
        <SectionCTA />
      </div>

      {/* Feature 01 — Chat com superfãs. Bubbles animados +
       *  indicador "escrevendo" entram em loop via motion. */}
      <div className={styles.features}>
        <ChatFeatureDemo />
      </div>
    </section>
  );
}
