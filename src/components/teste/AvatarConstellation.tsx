'use client';

import { useEffect, useState } from 'react';
import FloatingAvatar from './FloatingAvatar';

/**
 * Constellation — todos os avatares do /teste num só lugar, com
 * posicionamento fixo na viewport.
 *
 * Mecânica per product feedback:
 *   - Cada avatar tem um `revealAt` (1, 2 ou 3) — o índice da
 *     section em que ele entra em cena via fade-in.
 *   - Avatares revelados ficam visíveis até o fim do scroll
 *     ("permanecerem fixos conforme o scroll acontece, pode
 *     surgir novos, com fade in, mas devem ser fixos").
 *   - IntersectionObserver assiste cada `<section>` (id
 *     "section-1", "section-2", "section-3") e empurra o
 *     `maxReached` adiante. Nunca volta.
 *   - position: fixed (configurado em FloatingAvatar.module.css)
 *     ancora ao viewport — eles NÃO scrollam com o documento.
 *
 * A lista de avatares + posições é declarativa abaixo. Pra
 * ajustar arranjos, só editar o array — sem mexer no
 * controlador de scroll.
 */

interface AvatarSlot {
  name: string;
  label: string;
  ring?: 'green' | 'pink' | 'none';
  revealAt: 1 | 2 | 3;
  /** Posicionamento fixed via CSS top/left/right/bottom. */
  style: React.CSSProperties;
}

const AVATARS: AvatarSlot[] = [
  // ── Section 1 (3) — abertura ─────────────────────────────
  {
    name: 'Marina',
    label: 'Boiadeira - Ana Castela',
    revealAt: 1,
    style: { top: '14%', left: '6%' },
  },
  {
    name: 'Rafael',
    label: 'Boiadeira - Ana Castela',
    ring: 'green',
    revealAt: 1,
    style: { bottom: '20%', left: '4%' },
  },
  {
    name: 'Clara',
    label: 'Pipoco - Ana Castela',
    ring: 'pink',
    revealAt: 1,
    style: { bottom: '20%', right: '4%' },
  },

  // ── Section 2 (3) — adensa o tecido ──────────────────────
  {
    name: 'Júlia',
    label: 'Solto - Ana Castela',
    revealAt: 2,
    style: { top: '38%', left: '10%' },
  },
  {
    name: 'Pedro',
    label: 'Pipoco - Ana Castela',
    ring: 'green',
    revealAt: 2,
    style: { top: '22%', right: '8%' },
  },
  {
    name: 'Camila',
    label: 'Tropa do Chapelão',
    revealAt: 2,
    style: { top: '54%', right: '14%' },
  },

  // ── Section 3 (3) — fecha a constelação ──────────────────
  {
    name: 'Heitor',
    label: 'Rodeio no Texas',
    ring: 'pink',
    revealAt: 3,
    style: { top: '50%', left: '20%' },
  },
  {
    name: 'Lia',
    label: 'Boiadeira - Ana Castela',
    ring: 'green',
    revealAt: 3,
    style: { bottom: '32%', left: '32%' },
  },
  {
    name: 'Bruno',
    label: 'Solto - Ana Castela',
    revealAt: 3,
    style: { bottom: '30%', right: '24%' },
  },
];

export default function AvatarConstellation() {
  /** Maior section já alcançada pelo scroll. Começa em 1
   *  pra revelar a constelação inicial assim que a página
   *  monta. */
  const [maxReached, setMaxReached] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    /**
     * Detecta a section "ativa" pelo scroll: a section cujo
     * range vertical contém o CENTRO da viewport. Mais
     * confiável que IntersectionObserver em alguns ambientes
     * (preview iframes, etc.) e mais explícito sobre quando
     * o trigger acontece — o usuário precisa rolar metade da
     * seção pra revelar a próxima rodada de avatares.
     *
     * Listener com `{ passive: true }` pra não bloquear o
     * scroll do navegador. requestAnimationFrame throttle
     * pra evitar dezenas de setState por frame durante um
     * scroll rápido.
     */
    let raf = 0;
    function checkActiveSection() {
      const center = window.innerHeight * 0.5;
      let active: 1 | 2 | 3 = 1;
      for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`section-${i}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= center && r.bottom >= center) {
          active = i as 1 | 2 | 3;
          break;
        }
      }
      setMaxReached((prev) => (active > prev ? active : prev));
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        checkActiveSection();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Check inicial — caso o usuário aterrisse já scrollado.
    checkActiveSection();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {AVATARS.map((a) => (
        <FloatingAvatar
          key={a.name}
          name={a.name}
          label={a.label}
          ring={a.ring}
          size="sm"
          revealed={maxReached >= a.revealAt}
          style={a.style}
        />
      ))}
    </>
  );
}
