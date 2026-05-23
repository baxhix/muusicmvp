'use client';

import Sparkles from '@/components/teste/Sparkles';
import styles from './ArtistsHero.module.css';

/**
 * Hero da página /para-artistas.
 *
 * Estratégia tipográfica disruptiva: rompe a regra "headline 1
 * palavra" do /teste de propósito. Aqui o headline É uma
 * pergunta confrontacional — a estrutura interrogativa é o
 * gatilho retórico. Borscha bold em tamanho display (gigante)
 * com gradient diagonal.
 *
 * Dois CTAs:
 *   - Primário (gradient pill, mesma identidade do navbar): leva
 *     ao mailto contato — o público alvo (empresário) quer
 *     conversa, não signup.
 *   - Secundário (ghost): leva ao /teste pra ver a landing
 *     do consumidor — entender o ecossistema antes da call.
 */
export default function ArtistsHero() {
  return (
    <section className={styles.hero}>
      <Sparkles count={32} seed={511} />

      <div className={styles.center}>
        <h1 className={styles.headline}>
          <span className={styles.headlineLine}>Quem é o dono</span>
          <span className={styles.headlineLineAccent}>dos seus fãs?</span>
        </h1>

        <p className={styles.lede}>
          A indústria que vocês ajudaram a construir esqueceu de entregar a coisa
          mais valiosa. Não os streams. Não os números. <strong>As pessoas.</strong>
        </p>

        <div className={styles.actions}>
          <a href="mailto:artistas@fanverse.com.br?subject=Conversa%20com%20o%20time" className={styles.ctaPrimary}>
            Conversar com o time
          </a>
          <a href="/teste" className={styles.ctaSecondary}>
            Ver o app
            <span className={styles.ctaArrow} aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      {/* Indicador sutil de scroll na base do hero. */}
      <div className={styles.scrollHint} aria-hidden="true">
        <span className={styles.scrollHintText}>Continuar</span>
        <span className={styles.scrollHintLine} />
      </div>
    </section>
  );
}
