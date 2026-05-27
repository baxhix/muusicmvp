'use client';

import Navbar from '@/components/teste/Navbar';
import HeroSection from '@/components/teste/HeroSection';
import SectionTwo from '@/components/teste/SectionTwo';
import SectionThree from '@/components/teste/SectionThree';
import SectionFour from '@/components/teste/SectionFour';
import SectionFive from '@/components/teste/SectionFive';
import SectionSix from '@/components/teste/SectionSix';
import AvatarConstellation from '@/components/teste/AvatarConstellation';
import Footer from '@/components/teste/Footer';
import GalaxyBackdrop from '@/components/teste/GalaxyBackdrop';
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
      {/* Galaxy backdrop — star field denso (estilo Mapbox
       *  star-intensity) + camada de nebulae que se desloca
       *  conforme o scroll. Setando --galaxy-scroll no
       *  documentElement, o pseudo `.page::before` também
       *  responde ao scroll (em page.module.css). */}
      <GalaxyBackdrop />
      <Navbar />
      {/* AvatarConstellation vive no nível da página: usa
       *  position: fixed pra ancorar ao viewport (não scrolla
       *  junto com o documento) e revela avatares novos via
       *  IntersectionObserver conforme cada section entra em
       *  cena. */}
      <AvatarConstellation />
      {/* Phones mockup agora vive DENTRO do HeroSection (180px
       *  abaixo do headline) — não tem mais section dedicada. */}
      <HeroSection />
      <SectionTwo />
      <SectionThree />
      {/* Section 4 — canvas vazio onde 12 avatares formam um
       *  círculo (no texto). Os avatares vivem na constellation
       *  page-level com `circling: true` (slide-in radial +
       *  drift sutil contínuo). */}
      <SectionFour />
      <SectionFive />
      <SectionSix />
      {/* O orbe FanverseCore 390×390 que vivia aqui foi removido
       *  per product feedback (e por motivos de performance —
       *  era a segunda instância de WebGL2 shader rodando em
       *  paralelo com o orb da navbar). A galáxia + nebulae
       *  scroll-driven do GalaxyBackdrop seguem como ambient
       *  visual da página. */}
      <Footer />
    </div>
  );
}
