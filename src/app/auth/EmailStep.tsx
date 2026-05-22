'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import {
  loadOnboarding,
  saveOnboarding,
  STEP_PATHS,
} from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';

/**
 * Step 1 — Email entry. Single field + Continuar.
 *
 * Comportamento per spec:
 *   - O sistema decide automaticamente entre "criar conta" e
 *     "entrar" — não pergunta. O magic link enviado pelo
 *     backend já cobre os dois casos: se usuário existe →
 *     login passwordless; se não → backend cria stub e
 *     onboarding continua.
 *   - Email persistido em onboardingStore pra que reload na
 *     /auth/verify mostre "Enviamos pra <email>".
 */

const EMAIL_REGEX = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export default function EmailStep() {
  const router = useRouter();
  const { user, loading: authLoading, requestMagicLink } = useAuth();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Já autenticado → vai direto pro app (não passa pelo flow).
  useEffect(() => {
    if (!authLoading && user) router.replace('/app');
  }, [authLoading, user, router]);

  // Restore do email se o usuário fechou e voltou.
  useEffect(() => {
    const stored = loadOnboarding();
    if (stored.email && !email) setEmail(stored.email);
    // Se o store já está num step além de 'email', envia o
    // usuário direto pra onde parou — preserva continuidade.
    if (stored.step !== 'email') {
      router.replace(STEP_PATHS[stored.step]);
    }
    track('auth_started', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Esse e-mail não parece válido.');
      return;
    }
    setError(null);
    setSubmitting(true);

    track('email_submitted', { email_domain: trimmed.split('@')[1] });

    const ok = await requestMagicLink(trimmed);
    setSubmitting(false);

    if (!ok) {
      track('auth_login_failed', { reason: 'magic_link_request_failed' });
      setError('Não consegui enviar agora. Tenta de novo em alguns segundos.');
      return;
    }

    track('magic_link_sent', { email_domain: trimmed.split('@')[1] });
    saveOnboarding({ email: trimmed, step: 'verify' });
    router.push('/auth/verify');
  }

  return (
    <AuthShell back="hide" progress={1 / 6}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className={fields.heading}>Bem-vindo ao Fanverse</h1>
        <p className={fields.subtitle}>
          Digita seu e-mail pra entrar ou criar sua conta. Sem senhas.
        </p>

        <form onSubmit={onSubmit} className={fields.form} noValidate>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className={fields.input}
            disabled={submitting}
            aria-label="E-mail"
          />

          {error && <div className={fields.error} role="alert">{error}</div>}

          <button
            type="submit"
            className={fields.btn}
            disabled={submitting || !email.trim()}
          >
            {submitting ? 'Enviando…' : 'Continuar'}
          </button>
        </form>

        <p className={fields.hint}>
          Continuando, você concorda com nossos{' '}
          <a href="#termos">Termos</a> e{' '}
          <a href="#privacidade">Política de Privacidade</a>.
        </p>
      </div>
    </AuthShell>
  );
}
