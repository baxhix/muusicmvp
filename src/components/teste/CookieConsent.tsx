'use client';

import { useEffect, useState } from 'react';
import LegalLink from '@/components/legal/LegalLink';
import styles from './CookieConsent.module.css';

const STORAGE_KEY = 'teste-cookie-consent';

/**
 * Barra-pílula de consentimento de cookies/termos da landing `/teste`.
 *
 * 740×66, totalmente arredondada (999px), fundo preto, texto 14px cinza
 * + dois botões (Rejeitar · Aceitar). Flutua no rodapé central e NÃO
 * bloqueia a página (cookie bar, não modal com véu).
 *
 * A escolha é persistida em localStorage pra não reaparecer. Em telas
 * estreitas (<820px) a pílula vira um card empilhado — 740px não cabe.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // localStorage só roda no client → server e 1º render do client
    // renderizam null (sem mismatch de hidratação); o effect decide.
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function decide(choice: 'accepted' | 'rejected') {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* modo privado / storage cheio — segue fechando mesmo assim */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      className={styles.wrap}
      role="dialog"
      aria-modal="false"
      aria-label="Aviso de cookies e termos de uso"
    >
      <p className={styles.text}>
        Usamos cookies para personalizar sua experiência. Ao continuar, você
        concorda com nossos{' '}
        <LegalLink kind="terms_of_use" surface="site" className={styles.link}>
          Termos de Uso
        </LegalLink>{' '}
        e a{' '}
        <LegalLink kind="privacy_policy" surface="site" className={styles.link}>
          Política de Privacidade
        </LegalLink>
        .
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.reject}
          onClick={() => decide('rejected')}
        >
          Rejeitar
        </button>
        <button
          type="button"
          className={styles.accept}
          onClick={() => decide('accepted')}
        >
          Aceitar
        </button>
      </div>
    </section>
  );
}
