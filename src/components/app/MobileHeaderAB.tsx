'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileHomeChrome from './MobileHomeChrome';
import MobileFanverseHeader from './MobileFanverseHeader';
import styles from './MobileHeaderAB.module.css';

type Variant = 'option1' | 'option2';
const STORAGE_KEY = 'fanverse:mobile-header-variant';

/**
 * Switch A/B do header MOBILE da home (/app).
 *
 * Renderiza a Opção 1 (header atual = MobileHomeChrome) ou a Opção 2
 * (novo header = MobileFanverseHeader) + um controle logo abaixo do
 * header pra alternar e comparar. A escolha persiste no localStorage
 * pra sobreviver ao reload durante a avaliação.
 *
 * Só mobile — no desktop os filhos já retornam null, mas saímos cedo
 * pra não montar o controle.
 */
export default function MobileHeaderAB() {
  const isMobile = useIsMobile();
  const [variant, setVariant] = useState<Variant>('option1');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'option1' || saved === 'option2') setVariant(saved);
    } catch {
      /* localStorage indisponível */
    }
  }, []);

  const choose = (v: Variant) => {
    setVariant(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  if (!isMobile) return null;

  return (
    <>
      {variant === 'option1' ? <MobileHomeChrome /> : <MobileFanverseHeader />}

      {/* Controle de comparação — logo abaixo do header. */}
      <div
        className={`${styles.toggle} ${variant === 'option2' ? styles.toggleLow : ''}`}
        role="tablist"
        aria-label="Variação do header (comparação)"
      >
        <button
          type="button"
          role="tab"
          aria-selected={variant === 'option1'}
          className={`${styles.seg} ${variant === 'option1' ? styles.segActive : ''}`}
          onClick={() => choose('option1')}
        >
          Opção 1
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={variant === 'option2'}
          className={`${styles.seg} ${variant === 'option2' ? styles.segActive : ''}`}
          onClick={() => choose('option2')}
        >
          Opção 2
        </button>
      </div>
    </>
  );
}
