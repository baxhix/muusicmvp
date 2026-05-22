import styles from './PhonesSection.module.css';

/**
 * PhonesSection — section logo após a Hero do /teste.
 *
 * Mostra um mockup de 3 smartphones (1 central frontal + 2
 * laterais angulados). O asset fica em
 * `/public/teste/phones-mockup.png` — quando o produto
 * substituir por uma versão com screenshots do app, basta
 * trocar o arquivo no mesmo path.
 *
 * Layout: full-bleed dark, imagem centralizada em max-width
 * 1000px. Em mobile a imagem encolhe naturalmente. Pequena
 * micro-animação de fade-up quando a section entra em view
 * (CSS-only via `animation` no mount — bom o suficiente, sem
 * IntersectionObserver pra evitar overhead).
 */
export default function PhonesSection() {
  return (
    <section className={styles.section} aria-label="Mockup do app Fanverse">
      <div className={styles.imgWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/teste/phones-mockup.png"
          alt="Três smartphones mostrando o app Fanverse — um central frontal e dois laterais angulados"
          className={styles.img}
          loading="lazy"
        />
      </div>
    </section>
  );
}
