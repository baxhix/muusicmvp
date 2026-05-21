'use client';

import Navbar from '@/components/teste/Navbar';
import HeroSection from '@/components/teste/HeroSection';
import SectionTwo from '@/components/teste/SectionTwo';
import SectionThree from '@/components/teste/SectionThree';
import styles from './page.module.css';

/**
 * `/teste` — sandbox de landing experimental.
 *
 * Section 1 (Hero "SUPERFÃS") montada. Próximas seções
 * planejadas:
 *   - Section 2: avatares convergem ao centro (scroll-driven).
 *   - Section 3: novos avatares surgem + se afastam.
 *   - Section 4+: TBD.
 *
 * Conceitos de design fixados com o produto:
 *   - Tipografia: Peace Sans (display) + Inter (body). O .woff2
 *     do Peace Sans ainda precisa ser carregado em /fonts/ —
 *     enquanto isso, fallback chain usa Inter weight 900.
 *   - White space generoso, poucos textos, micro-animações.
 *   - Avatares idle-floating com offsets dessincronizados pra
 *     não respirar todos juntos.
 *
 * Robots: noindex pelo layout pai. Promovê-la pra `/` depois
 * é só copiar conteúdo.
 */
export default function TestePage() {
  return (
    <div className={styles.page}>
      <Navbar />
      <HeroSection />
      {/* Sections 2 + 3 mockadas pra validar o comportamento
       *  do floating dos avatares em arranjos diferentes
       *  (densidade, posicionamento, tamanhos). Conteúdo
       *  textual é placeholder — vamos iterar conforme o
       *  feedback da motion. */}
      <SectionTwo />
      <SectionThree />
    </div>
  );
}
