import Navbar from '@/components/teste/Navbar';
import Footer from '@/components/teste/Footer';
import ArtistsHero from '@/components/para-artistas/ArtistsHero';
import Diagnostico from '@/components/para-artistas/Diagnostico';
import Inversao from '@/components/para-artistas/Inversao';
import Infraestrutura from '@/components/para-artistas/Infraestrutura';
import ContatoCTA from '@/components/para-artistas/ContatoCTA';
import styles from './page.module.css';

/**
 * `/para-artistas` — página institucional pra empresários de
 * artistas consolidados.
 *
 * Composição em 5 movimentos editoriais:
 *   1. Hero — pergunta confrontacional ("Quem é o dono dos
 *      seus fãs?") + 2 CTAs (conversar, ver demonstração).
 *   2. Diagnóstico — manifesto sobre o problema atual +
 *      tabela de contraste Hoje vs Fanverse.
 *   3. Inversão — 3 pilares (relação direta, dados próprios,
 *      receita recorrente) em cards numerados.
 *   4. Infraestrutura — grid de 6 capabilities concretas.
 *   5. Contato — CTA final tipográfico + email do time.
 *
 * Reusa Navbar e Footer do /teste pra manter consistência
 * de marca; o conteúdo entre os dois é a parte disruptiva. */
export default function ParaArtistasPage() {
  return (
    <div className={styles.page}>
      <Navbar />
      <ArtistsHero />
      <Diagnostico />
      <Inversao />
      <Infraestrutura />
      <ContatoCTA />
      <Footer />
    </div>
  );
}
