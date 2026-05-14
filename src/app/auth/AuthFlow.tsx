'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import styles from './magicLink.module.css';

type Step = 'enter-email' | 'sent';

const EMAIL_REGEX = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export default function AuthFlow() {
  const router = useRouter();
  const { user, loading: authLoading, requestMagicLink } = useAuth();
  const [step, setStep] = useState<Step>('enter-email');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already logged in → go straight to /app
  useEffect(() => {
    if (!authLoading && user) router.replace('/app');
  }, [authLoading, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Esse e-mail não parece válido.');
      return;
    }
    setError(null);
    setSubmitting(true);
    track('auth_login_requested', { method: 'magic_link' });
    const ok = await requestMagicLink(trimmed);
    setSubmitting(false);
    if (!ok) {
      track('auth_login_failed', { reason: 'magic_link_request_failed' });
      setError('Não consegui enviar agora. Tenta de novo em alguns segundos.');
      return;
    }
    setStep('sent');
  };

  const reset = () => {
    setStep('enter-email');
    setError(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {step === 'enter-email' ? (
          <>
            <div className={styles.brand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-muusic.svg" alt="muusic" className={styles.logo} />
            </div>

            <h1 className={styles.title}>Entrar no muusic</h1>
            <p className={styles.subtitle}>
              Digita seu e-mail. A gente te manda um link mágico — sem senha.
            </p>

            <form onSubmit={onSubmit} className={styles.form} noValidate>
              <label htmlFor="email" className={styles.label}>E-mail</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className={styles.input}
                disabled={submitting}
              />

              {error && <div className={styles.error}>{error}</div>}

              <button
                type="submit"
                className={styles.btn}
                disabled={submitting || !email.trim()}
              >
                {submitting ? 'Enviando…' : 'Enviar link mágico'}
              </button>
            </form>

            <p className={styles.disclaimer}>
              Continuando, você concorda com nossos termos. Sem senhas, sem
              fricção. Você pode sair quando quiser.
            </p>
          </>
        ) : (
          <>
            <div className={styles.successIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 12l3.5 3.5L17 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className={styles.title}>Confira seu e-mail</h1>
            <p className={styles.subtitle}>
              Mandamos um link pra <strong>{email}</strong>. Clica nele pra entrar.
            </p>
            <p className={styles.hintSmall}>
              Não chegou em 1-2 minutos? Olha a caixa de spam. O link expira em
              15 minutos e só pode ser usado uma vez.
            </p>

            <button type="button" onClick={reset} className={styles.btnGhost}>
              Tentar outro e-mail
            </button>
          </>
        )}
      </div>
    </main>
  );
}
