'use client';

import Sparkles from '@/components/teste/Sparkles';
import styles from './ContatoCTA.module.css';

/**
 * Section 5 — Contato CTA.
 *
 * Cinematic close. Headline gigante "Vamos conversar." +
 * promessa explícita do que será a conversa ("não é demo, é
 * diagnóstico") + 1 CTA principal (mailto direto) e o email
 * em texto pra quem prefere copiar.
 *
 * Mantém o sparkles do hero pra moldurar — abre e fecha a
 * página com o mesmo dispositivo visual, dando a sensação de
 * "uma peça única" e não "uma sequência de sections". */
export default function ContatoCTA() {
  return (
    <section className={styles.section}>
      <Sparkles count={28} seed={777} />

      <div className={styles.inner}>
        <span className={styles.eyebrow}>
          <span className={styles.eyebrowIndex}>04</span>
          <span className={styles.eyebrowLabel}>Próximo passo</span>
        </span>

        <h2 className={styles.title}>
          Vamos conversar.
        </h2>

        <p className={styles.lede}>
          <strong>Não é demo. É diagnóstico.</strong>
          <br />
          Marque uma conversa de 30 minutos com o time de produto. Sem deck. Sem
          roteiro. Com mapa concreto do que a operação ganha em 60 dias.
        </p>

        <div className={styles.actions}>
          <a
            href="mailto:artistas@fanverse.com.br?subject=Diagn%C3%B3stico%20%E2%80%94%20Fanverse"
            className={styles.cta}
          >
            Marcar conversa
          </a>
          <a
            href="mailto:artistas@fanverse.com.br"
            className={styles.email}
          >
            artistas@fanverse.com.br
          </a>
        </div>
      </div>
    </section>
  );
}
