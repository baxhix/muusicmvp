'use client';

import ChatFeatureDemo from './ChatFeatureDemo';
import CursorTrailGallery from './CursorTrailGallery';
import styles from './SectionThree.module.css';

/**
 * Section 3 — features da plataforma. Abriga as features
 * animadas que mostram o que o usuário pode fazer dentro do
 * app. Feature 01: Chat (bubbles + typing). Feature 02:
 * Conteúdo exclusivo (cursor trail revelando fotos).
 *
 * Headline + phrase + CTA "Meu Fanverse" foram removidos per
 * spec atualizado — a section abre direto com a primeira
 * feature.
 */
export default function SectionThree() {
  return (
    <section
      id="section-3"
      data-section="3"
      className={styles.section}
    >
      <div className={styles.features}>
        {/* Per feedback "deixe a seção Chat depois da Conteúdo exclusivo":
         *  a ordem foi invertida — Conteúdo exclusivo primeiro, Chat depois. */}
        {/* Feature 01 — Conteúdo exclusivo. Cursor trail revela miniaturas
         *  de fotos exclusivas conforme o usuário move o mouse (ou scrolla,
         *  no mobile). */}
        <CursorTrailGallery />
        {/* Feature 02 — Chat com superfãs. Bubbles animados + indicador
         *  "escrevendo" entram em loop via motion. */}
        <ChatFeatureDemo />
      </div>
    </section>
  );
}
