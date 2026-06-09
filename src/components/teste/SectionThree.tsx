'use client';

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
 * Headline "Pertencer" + phrase + CTA "Meu Fanverse" foram
 * removidos per spec atualizado — a section agora abre direto
 * com o ChatFeatureDemo, sem o bloco introdutório no topo.
 */
export default function SectionThree() {
  return (
    <section
      id="section-3"
      data-section="3"
      className={styles.section}
    >
      {/* Feature 01 — Chat com superfãs. Bubbles animados +
       *  indicador "escrevendo" entram em loop via motion. */}
      <div className={styles.features}>
        <ChatFeatureDemo />
      </div>
    </section>
  );
}
