'use client';

import { useEffect, useRef, useState } from 'react';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './Navbar.module.css';

type Lang = 'PT' | 'EN';

interface Subitem {
  label: string;
  hint?: string;
  href: string;
}
interface MenuGroup {
  index: string;
  title: string;
  items: Subitem[];
}

/* 4 grupos principais do megamenu, definidos top-level pra
 * facilitar revisão de copy. Cada grupo tem um número display
 * (01-04), título em ALL CAPS (Borscha bold gigante) e uma
 * lista de subitens (Inter 14px). */
const GROUPS: MenuGroup[] = [
  {
    index: '01',
    title: 'Produto',
    items: [
      { label: 'O App',           hint: 'Como funciona',    href: '/teste' },
      { label: 'Para Artistas',   hint: 'Operação + dados', href: '/para-artistas' },
      { label: 'Pre-save',        hint: 'Lançamentos',      href: '/teste#section-5' },
    ],
  },
  {
    index: '02',
    title: 'Conteúdo',
    items: [
      { label: 'Blog',            hint: 'Notas + ensaios',  href: '/blog' },
      { label: 'Imprensa',        hint: 'Press kit',        href: '#imprensa' },
      { label: 'Newsletter',      hint: 'Quinzenal',        href: '#newsletter' },
    ],
  },
  {
    index: '03',
    title: 'Conta',
    items: [
      { label: 'Meu Fanverse',    hint: 'Entrar',           href: '/auth' },
      { label: 'Criar conta',     hint: 'Email-first',      href: '/auth' },
      { label: 'Suporte',         hint: 'Time humano',      href: 'mailto:suporte@fanverse.com.br' },
    ],
  },
  {
    index: '04',
    title: 'Idioma',
    items: [
      // Idiomas aparecem aqui também como subitens. A
      // interação real (selecionar idioma) é tratada pelos
      // botões abaixo do nome do grupo via .langPills.
      { label: 'Português (BR)',  hint: 'Padrão',           href: '#lang-pt' },
      { label: 'English (US)',    hint: 'Em breve',         href: '#lang-en' },
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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
      <header className={styles.navbar}>
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
            <a href="/auth"  className={styles.ctaPill}>
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
       *  conteúdo desligado. */}
      <div
        id="fanverse-megamenu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        aria-hidden={!menuOpen}
        className={`${styles.megaPanel} ${menuOpen ? styles.megaPanelOpen : ''}`}
      >
        {/* Wordmark gigante decorativo ao fundo — efeito
         *  editorial estilo "cabeçalho de revista". */}
        <div className={styles.megaWordmark} aria-hidden="true">FANVERSE</div>

        <div className={styles.megaInner}>
          <div className={styles.megaHeader}>
            <span className={styles.megaTagline}>Navegar</span>
            <button
              type="button"
              className={styles.megaClose}
              onClick={close}
              aria-label="Fechar menu"
            >
              <span>Fechar</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <ul className={styles.megaList} role="menu">
            {GROUPS.map((group, gi) => (
              <li
                key={group.index}
                className={styles.megaGroup}
                role="none"
                style={{ animationDelay: `${gi * 60 + 120}ms` }}
              >
                <div className={styles.megaGroupLeft}>
                  <span className={styles.megaGroupIndex}>{group.index}</span>
                  <h3 className={styles.megaGroupTitle}>{group.title}</h3>
                </div>

                <div className={styles.megaGroupRight}>
                  {group.index === '04' ? (
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
                            <span className={styles.megaSubitemLabel}>{item.label}</span>
                            {item.hint && (
                              <span className={styles.megaSubitemHint}>{item.hint}</span>
                            )}
                            <span className={styles.megaSubitemArrow} aria-hidden="true">→</span>
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
