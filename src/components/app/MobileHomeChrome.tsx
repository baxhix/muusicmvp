'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileHomeChrome.module.css';

/**
 * Mobile-only solid background + secondary info bar for the
 * /app home view.
 *
 * Renders three stacked horizontal strips at the very top of
 * the viewport:
 *
 *   - Header background (y:0 → 68): solid black band that
 *     sits behind the right-rail Notif/Send cluster, so the
 *     two icons share a continuous surface instead of looking
 *     like loose floating chrome. ArtistBox is hidden on
 *     mobile (see ArtistBox.module.css) — its Fanpoints chip
 *     moved into the info bar below.
 *   - Gray divider (1px) at y:68.
 *   - Info bar (y:69 → 105): the user's Fanpoints with the
 *     amber crown icon on the left, secondary live state
 *     (online-fan count) on the right.
 *
 * Unmounts on desktop and on every non-home route.
 */
export default function MobileHomeChrome() {
  const isMobile = useIsMobile();
  /* router/useAuth/useUserProfile foram retirados quando o info-bar
   * (greeting + fanpoints chip) saiu do JSX. O componente agora só
   * desenha o chrome de fundo + brand + orbe — nenhuma data layer
   * é necessária. */

  if (!isMobile) return null;

  return (
    <div className={styles.chrome} aria-hidden="false">
      <div className={styles.headerBg} aria-hidden="true" />
      {/* Orb decorativo da marca — vive ao lado ESQUERDO do
       *  header mobile per product feedback "No mobile, dobre o
       *  tamanho do orbe e posicione no header à esquerda. Vai
       *  ficar Orbe, Logotipo Ana Castela e Icone de mensagens".
       *  Layout horizontal resultante: [orb] [logo Ana Castela
       *  centralizado] [ícone de mensagens à direita].
       *
       *  Tamanho 88×88 = 2× o orb antigo do canto inferior
       *  esquerdo (44×44), que foi suprimido em mobile via
       *  app/app/layout.module.css. O canvas WebGL2 do
       *  FanverseCore auto-redimensiona via ResizeObserver pro
       *  novo tamanho. aria-hidden + pointer-events:none porque
       *  é puramente decorativo. */}
      <span className={styles.headerOrb} aria-hidden="true">
        <FanverseCore />
      </span>
      <div className={styles.brand} aria-hidden="false">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-ana.png"
          alt="Ana Castela"
          className={styles.logo}
        />
        {/* Reverted to the small "FANVERSE" text wordmark per
            product feedback "O logotipo Fanverse não deve ficar
            na home do mobile, apenas na Hero Section da landing
            page. Remova o logotipo e volte a palavra pequena
            Fanverse". The Fanverse SVG brand mark that briefly
            lived here now appears only on the landing-page
            HeroSection. */}
        <span className={styles.brandLabel} aria-label="Fanverse">
          FANVERSE
        </span>
      </div>
      {/* Info bar (greeting "Olá, X" + Fanpoints chip) REMOVIDA per
       *  product feedback. O chrome encolheu -42px e o logo + ícone
       *  de mensagens + orbe subiram pra reocupar o espaço. CSS
       *  antigo (.infoBar/.greetingBtn/.fanpointsChip) mantido
       *  como dead code — sem efeito visual sem o JSX. */}
    </div>
  );
}
