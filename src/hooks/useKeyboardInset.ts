'use client';

import { useEffect, useState } from 'react';

/**
 * useKeyboardInset — altura (px) que o teclado virtual ocupa na parte
 * de baixo da viewport, via `visualViewport`. Retorna 0 quando o
 * teclado está fechado.
 *
 * Usado nos steps de auth pra "ancorar" o CTA logo acima do teclado
 * no mobile (botão vira `position: fixed; bottom: inset`). Ignora
 * deltas pequenos (ex: barra de endereço sumindo) com um threshold,
 * pra não disparar fora do teclado.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(kb > 90 ? kb : 0);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
