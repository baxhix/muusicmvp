import Link from 'next/link';
import styles from './SectionCTA.module.css';

/**
 * SectionCTA — pill arredondado com gradient magenta→indigo
 * animado, idêntico ao CTA "Meu Fanverse" da navbar. Pensado
 * pra ser usado abaixo do subtítulo de cada section da
 * landing /teste, dando uma porta de entrada pro auth flow
 * em cada surface do scroll.
 *
 * Props:
 *   - `href` default `/auth` (fluxo unificado de
 *     autenticação). Aceita override pra casos específicos
 *     (ex: link interno pra outra section).
 *   - `children` define o texto do botão. Default "Meu
 *     Fanverse".
 */

export interface SectionCTAProps {
  href?: string;
  children?: React.ReactNode;
}

export default function SectionCTA({
  href = '/auth',
  children = 'Meu Fanverse',
}: SectionCTAProps) {
  return (
    <Link href={href} className={styles.cta}>
      {children}
    </Link>
  );
}
