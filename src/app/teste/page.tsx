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
import {
  TickerTextHover,
  ScrollTextLines,
  SplitText,
  RevealText,
  MotionTextDemoSection,
} from '@/components/teste/MotionTextDemos';
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

      {/* ── Motion text effects DEMO sections ─────────────────
       *  4 efeitos pra cliente avaliar o comportamento antes
       *  de trocar o conteúdo real. Cada um vive numa
       *  MotionTextDemoSection com label "DEMO Nº — Effect".
       *  Pra substituir, troque o `text` / `lines` prop pelo
       *  conteúdo definitivo. */}
      <MotionTextDemoSection
        label="Demo 01"
        effectName="Ticker — Text hover effect"
      >
        <TickerTextHover text="Passe o cursor aqui" />
        <p
          style={{
            fontSize: 14,
            color: 'rgba(245, 245, 247, 0.5)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Cada letra rola pra cima e revela uma cópia em gradient brand.
        </p>
      </MotionTextDemoSection>

      <MotionTextDemoSection
        label="Demo 02"
        effectName="Scroll text lines"
      >
        <ScrollTextLines
          lines={[
            'Cada linha aparece quando entra no viewport.',
            'A próxima sobe com 80ms de atraso em cascata.',
            'Tipografia editorial, ritmo Apple Newsroom.',
            'Role pra baixo pra revelar o restante do bloco.',
          ]}
        />
      </MotionTextDemoSection>

      <MotionTextDemoSection
        label="Demo 03"
        effectName="Split text"
      >
        <SplitText text="Cada caractere entra com stagger." />
        <p
          style={{
            fontSize: 14,
            color: 'rgba(245, 245, 247, 0.5)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Cascade ao entrar no viewport — 25ms por caractere.
        </p>
      </MotionTextDemoSection>

      <MotionTextDemoSection
        label="Demo 04"
        effectName="Reveal text effect"
      >
        <RevealText text="Olá." />
        <p
          style={{
            fontSize: 14,
            color: 'rgba(245, 245, 247, 0.5)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Mask de gradient wipa conforme o scroll progride pela section.
        </p>
      </MotionTextDemoSection>
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
