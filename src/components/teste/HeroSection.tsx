'use client';

import { useState } from 'react';
import styles from './HeroSection.module.css';

/* TTL do cookie de convite — 30 dias, igual ao cravado pelo
 *  /i/[code]. */
const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Section 1 — hero.
 *
 * Conteúdo per typography rules fixadas com o produto:
 *   - Headline: 1 palavra, ALL CAPS, 80px, Peace Sans, centro.
 *   - Frase (>2 palavras): Inter 16px, cinza.
 *
 * Os avatares NÃO vivem mais aqui — foram lifted pra
 * <AvatarConstellation /> no nível da page, com position: fixed
 * e reveal via scroll. A section fica responsável apenas pelo
 * conteúdo textual + sparkles próprio + servir de target pro
 * IntersectionObserver.
 */
export default function HeroSection() {
  /* "Entrar com código" — revela um input inline. No submit,
   *  cravamos o cookie `fanverse_invite` (o MESMO que o /i/[code]
   *  seta; httpOnly:false permite set via JS) e mandamos pro
   *  /auth. O signup lê o cookie e atribui o referral — reusa
   *  toda a infra do loop viral. Código inválido vira no-op no
   *  signup (resolveReferralCode retorna null). */
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 4) return;
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; secure'
        : '';
    document.cookie = `fanverse_invite=${normalized}; path=/; max-age=${INVITE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
    window.location.href = '/auth';
  }

  return (
    <section
      id="section-1"
      data-section="1"
      className={styles.hero}
    >
      {/* Sparkles removido — substituído pelo star field global em
       *  <GalaxyBackdrop /> (canvas único, mesma densidade visual). */}

      {/* Grid 3 rows: headline (row 1) — gap fixo de 180px
       *  (row 2, com a frase de apoio sobreposta no topo) —
       *  mockup de phones (row 3). Assim o TOPO do mockup
       *  fica exatamente 180px abaixo da BASE do headline,
       *  independente do tamanho do texto da frase. */}
      <div className={styles.center}>
        {/* Per spec atualizado:
         *   linha 1: "Universo do"
         *   linha 2: "Superfã" (mesma fonte/peso, fica
         *            inline-block como uma 2ª linha do headline,
         *            não um caption à parte). */}
        <h1 className={styles.headline}>
          Universo do<br />Superfã
        </h1>
        {/* Lead: frase de apoio + CTA "Entrar com código". Wrapper
         *  ocupa a row 2 do grid (align-start), preservando o Y
         *  dos phones na row 3. */}
        <div className={styles.heroLead}>
          <p className={styles.phrase}>
            O lugar perfeito de conexão entre o Artista e o Fã
          </p>
          {!showCode ? (
            <button
              type="button"
              className={styles.heroCodeBtn}
              onClick={() => setShowCode(true)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              Entrar com código
            </button>
          ) : (
            <form className={styles.heroCodeForm} onSubmit={submitCode}>
              <input
                className={styles.heroCodeInput}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Seu código de convite"
                aria-label="Código de convite"
                autoFocus
                maxLength={16}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className={styles.heroCodeSubmit}>
                Continuar
              </button>
            </form>
          )}
        </div>
        {/* CTA mobile — só aparece em mobile per spec atualizado
         *  "No mobile, deixe esse CTA abaixo do headline Superfãs".
         *  No desktop o CTA vive na Navbar; no mobile a navbar
         *  esconde o CTA e mostramos aqui. Lux estática atrás
         *  (só muda cor, não posição) — mesmo padrão do Navbar. */}
        <a href="/auth" className={styles.heroMobileCta}>
          Meu Fanverse
        </a>
        <div className={styles.phonesWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teste/phones-mockup.png"
            alt="Três smartphones mostrando o app Fanverse"
            className={styles.phonesImg}
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
