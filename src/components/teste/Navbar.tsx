'use client';

import { useEffect, useRef, useState } from 'react';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './Navbar.module.css';

type Lang = 'PT' | 'EN';

interface Subitem {
  label: string;
  href: string;
}
interface MenuGroup {
  title: string;
  items: Subitem[];
}

/* 4 grupos principais do megamenu (sem numeração — removida
 * per product feedback). Cada grupo tem título em Borscha
 * + lista de subitens em Inter 14px regular.
 *
 * Lista expandida com mais entradas (algumas mockadas) per
 * product feedback "aumente para mais itens, mesmo mocados".
 * As entradas mockadas apontam pra âncoras sem destino real
 * — quando a página correspondente existir, o href é
 * substituído. */
const GROUPS: MenuGroup[] = [
  {
    title: 'Produto',
    items: [
      { label: 'O App',         href: '/teste' },
      { label: 'Para Artistas', href: '/para-artistas' },
      { label: 'Pre-save',      href: '#pre-save' },
      { label: 'Fanpoints',     href: '#fanpoints' },
      { label: 'Live',          href: '#live' },
      { label: 'Superchat',     href: '#superchat' },
      { label: 'Fire Arena',    href: '#fire-arena' },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { label: 'Blog',          href: '/blog' },
      { label: 'Imprensa',      href: '#imprensa' },
      { label: 'Newsletter',    href: '#newsletter' },
      { label: 'Manifesto',     href: '#manifesto' },
      { label: 'Time',          href: '#time' },
      { label: 'Eventos',       href: '#eventos' },
      { label: 'Podcast',       href: '#podcast' },
    ],
  },
  {
    title: 'Conta',
    items: [
      { label: 'Meu Fanverse',  href: '/auth' },
      { label: 'Criar conta',   href: '/auth' },
      { label: 'Suporte',       href: 'mailto:suporte@fanverse.com.br' },
      { label: 'Configurações', href: '#config' },
      { label: 'Privacidade',   href: '#privacidade' },
      { label: 'Termos de uso', href: '#termos' },
      { label: 'Status',        href: '#status' },
    ],
  },
  {
    title: 'Idioma',
    items: [
      // Idiomas aparecem aqui também como subitens. A
      // interação real (selecionar idioma) é tratada pelos
      // botões abaixo do nome do grupo via .langPills.
      { label: 'Português (BR)', href: '#lang-pt' },
      { label: 'English (US)',   href: '#lang-en' },
    ],
  },
];

/**
 * Navbar do experimento /teste.
 *
 * Estrutura visual permanece: brand SVG à esquerda + nav
 * (O App / Para Artistas / Meu Fanverse) no container 1200px
 * + botão hamburger absolute na borda direita da viewport.
 *
 * A grande mudança é o que o hamburger ABRE: antes era um
 * dropdown estreito com PT/EN; agora é um MEGAMENU EDITORIAL
 * que ocupa 70vh do topo, com 4 grupos grandes (Borscha bold
 * display) e seus subitens (Inter 14px). Per product feedback
 * "ao clicar no hamburguer da landing page, deve ser aberto
 * uma caixa que ocupe 70% da tela partindo de cima pra baixo
 * com 4 itens principais, grandes e subitens na font inter
 * 14px. Bem disruptivo e inovador".
 *
 * Decisões de a11y:
 *   - <dialog>-style: panel fixed top, overlay full viewport.
 *   - Outside-click / Escape fecham; foco volta pro trigger.
 *   - role=menu + role=menuitem nos subitens.
 *   - aria-expanded no trigger.
 */
export default function Navbar() {
  const [lang, setLang] = useState<Lang>('PT');
  const [menuOpen, setMenuOpen] = useState(false);
  /* scrolled: ativa o "frosted shelf" (bg escuro + backdrop blur)
   *  per spec atualizado. Toggle com hysteresis (entra @>24px,
   *  sai @<8px) + rAF throttle pra não disparar setState em
   *  cada frame de scroll inercial iOS. */
  const [scrolled, setScrolled] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setScrolled((prev) => {
          if (prev) return y > 8;
          return y > 24;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  /* Outside click + Escape fecham. Quando fecha, devolve o
   * foco pro trigger pra não deixar o usuário de teclado
   * "preso" no fim do DOM. Body scroll é trancado enquanto o
   * menu está aberto (overflow:hidden) pra evitar scroll
   * fantasma por baixo. */
  useEffect(() => {
    if (!menuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  function close() {
    setMenuOpen(false);
  }
  function pickLang(next: Lang) {
    setLang(next);
  }

  return (
    <>
      <header className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ''}`}>
        {/* Container 1200px com brand + nav nas pontas. */}
        <div className={styles.container}>
          <a href="/teste" className={styles.brand} aria-label="Fanverse — início">
            {/* Orb animado vai à ESQUERDA do wordmark — feedback de
             *  produto. FanverseCore renderiza num canvas WebGL2
             *  auto-contido (sem deps externas), com tamanho ditado
             *  pelo container. Aria-hidden porque é puramente
             *  decorativo — o aria-label do <a> já comunica
             *  "Fanverse" pra screen reader. */}
            <span className={styles.brandOrb} aria-hidden="true">
              <FanverseCore />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/teste/fanverse-logo.svg"
              alt="Fanverse"
              className={styles.brandLogo}
            />
          </a>

          <nav className={styles.nav} aria-label="Principal">
            <a href="#o-app"        className={styles.navLink}>O App</a>
            <a href="/para-artistas" className={styles.navLink}>Para Artistas</a>
            <a href="/blog"          className={styles.navLink}>Blog</a>
            <a href="#imprensa"      className={styles.navLink}>Imprensa</a>
            <a href="/auth" className={styles.ctaPill}>
              {/* Pill preto sólido + sombra gradient animada atrás
               *  (::before pseudo, ver Navbar.module.css). O orb
               *  interno foi removido — toda a energia visual fica
               *  na sombra que desliza atrás do botão. */}
              Meu Fanverse
            </a>
          </nav>
        </div>

        {/* Hamburger trigger — mesmo posicionamento que o lang
         *  toggle ocupava. Estado open inverte os traços num X. */}
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.menuTrigger} ${menuOpen ? styles.menuTriggerOpen : ''}`}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-controls="fanverse-megamenu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
      </header>

      {/* Overlay full-viewport — sob o panel, captura outside
       *  clicks. Click fecha. */}
      <div
        className={`${styles.megaOverlay} ${menuOpen ? styles.megaOverlayOpen : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Megamenu — fixed top, 70vh, slide-down from top.
       *  aria-hidden quando fechado evita que SR enxergue o
       *  conteúdo desligado.
       *
       *  Per product feedback: wordmark gigante "FANVERSE" do
       *  fundo + tagline "Navegar" + numeração 01-04 dos
       *  grupos foram TODOS removidos. Sobrou só o conteúdo
       *  (4 colunas de links) + um X grande no canto superior
       *  esquerdo pra fechar. */}
      <div
        id="fanverse-megamenu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        aria-hidden={!menuOpen}
        className={`${styles.megaPanel} ${menuOpen ? styles.megaPanelOpen : ''}`}
      >
        {/* Botão de fechar — X grande, sem rótulo "Fechar",
         *  absolute no canto superior ESQUERDO do panel per
         *  product feedback "deixe um X grande na parte
         *  superior esquerda". aria-label preserva a
         *  acessibilidade pra screen readers. */}
        <button
          type="button"
          className={styles.megaClose}
          onClick={close}
          aria-label="Fechar menu"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="20" y1="4" x2="4" y2="20" />
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        </button>

        <div className={styles.megaInner}>
          <ul className={styles.megaList} role="menu">
            {GROUPS.map((group, gi) => (
              <li
                key={group.title}
                className={styles.megaGroup}
                role="none"
                style={{ animationDelay: `${gi * 60 + 120}ms` }}
              >
                <div className={styles.megaGroupLeft}>
                  <h3 className={styles.megaGroupTitle}>{group.title}</h3>
                </div>

                <div className={styles.megaGroupRight}>
                  {group.title === 'Idioma' ? (
                    /* Idioma usa pills toggle direto — não é
                     *  navegação, é state. Visual disruptivo:
                     *  pills grandes coladas. */
                    <div className={styles.langPills} role="radiogroup" aria-label="Idioma">
                      {(['PT', 'EN'] as Lang[]).map((code) => {
                        const active = lang === code;
                        const longName = code === 'PT' ? 'Português (BR)' : 'English (US)';
                        const subtitle = code === 'PT' ? 'Padrão' : 'Em breve';
                        return (
                          <button
                            key={code}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`${styles.langPill} ${active ? styles.langPillActive : ''}`}
                            onClick={() => pickLang(code)}
                          >
                            <span className={styles.langPillCode}>{code}</span>
                            <span className={styles.langPillLabel}>
                              <span className={styles.langPillName}>{longName}</span>
                              <span className={styles.langPillSub}>{subtitle}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className={styles.megaSubList}>
                      {group.items.map((item) => (
                        <li key={item.label}>
                          <a
                            href={item.href}
                            role="menuitem"
                            className={styles.megaSubitem}
                            onClick={close}
                          >
                            {/* Label puro em Inter 14px regular per
                             *  product feedback. Hint + arrow
                             *  removidos do JSX (não havia mais
                             *  campo `hint` no MenuGroup). */}
                            <span className={styles.megaSubitemLabel}>{item.label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
