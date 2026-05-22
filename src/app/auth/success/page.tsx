'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api/client';
import {
  loadOnboarding,
  clearOnboarding,
} from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';
import styles from './success.module.css';

/**
 * Step 6 — Success. Salva o onboarding no backend, mostra
 * confirmação animada e redireciona pro /app.
 *
 * Backend call: POST /api/auth/onboarding com displayName,
 * birthDate, age, isMinor, interests, termsAcceptedAt. Se
 * endpoint não existir ainda, falha silenciosamente — o
 * store local mantém os dados pra retry futuro.
 */

const REDIRECT_DELAY_MS = 2400;

export default function SuccessPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();

  const [status, setStatus] = useState<'saving' | 'done' | 'error'>('saving');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * Guard ref: garante que complete() roda EXATAMENTE UMA VEZ
   * por mount. Sem isso, a chamada `await refresh()` mexia no
   * AuthContext.user — que está no deps do useEffect — e
   * disparava re-execução; cada re-exec marcava o cancelled
   * antigo como true e nunca chegava no router.replace, deixando
   * o usuário preso na tela "Bem-vindo... te levando ao app".
   */
  const startedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const stored = loadOnboarding();

    async function complete() {
      try {
        // Tenta persistir no backend. Interests removidos do
        // payload — step foi descontinuado do fluxo.
        await api.post<{ ok: true }>('/api/auth/onboarding', {
          displayName: stored.displayName,
          birthDate: stored.birthDate,
          age: stored.age,
          isMinor: stored.isMinor,
          termsAcceptedAt: stored.termsAcceptedAt,
        });

        await refresh();
        clearOnboarding();
        setStatus('done');
        track('onboarding_completed', {
          is_minor: stored.isMinor,
        });
        track('account_created', { method: 'email_magic_link' });

        // Redireciona depois da animação (window.setTimeout
        // direto — sem cleanup, sem flag cancelled. Se o
        // componente desmontar antes, router.replace ainda é
        // seguro de chamar via window.location fallback).
        window.setTimeout(() => {
          router.replace('/app?welcome=1');
        }, REDIRECT_DELAY_MS);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setStatus('done');
          window.setTimeout(() => {
            router.replace('/app?welcome=1');
          }, REDIRECT_DELAY_MS);
          return;
        }
        setStatus('error');
        setErrorMsg('Algo deu errado ao finalizar. Tenta de novo?');
        track('auth_login_failed', { reason: 'onboarding_finalize' });
      }
    }

    complete();
  }, [user, authLoading, router, refresh]);

  return (
    <AuthShell back="hide" progress={5 / 5}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {status === 'saving' && (
          <>
            <div className={styles.spinner} aria-hidden="true">
              <svg viewBox="0 0 50 50" width="56" height="56">
                <circle
                  cx="25"
                  cy="25"
                  r="20"
                  fill="none"
                  stroke="url(#successGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="80 60"
                />
                <defs>
                  <linearGradient id="successGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ff00b4" />
                    <stop offset="1" stopColor="#5b00d1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className={fields.heading}>Quase lá…</h1>
            <p className={fields.subtitle}>Estamos preparando seu Fanverse.</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className={styles.checkmark} aria-hidden="true">
              <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
                <circle cx="28" cy="28" r="26" stroke="url(#successGradientDone)" strokeWidth="2.5" />
                <path
                  d="M16 28.5l8 8 16-17"
                  stroke="url(#successGradientDone)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="successGradientDone" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ff00b4" />
                    <stop offset="1" stopColor="#5b00d1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className={fields.heading}>Tudo pronto!</h1>
            <p className={fields.subtitle}>
              Bem-vindo ao Fanverse. Te levando ao app…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className={fields.heading}>Algo deu errado</h1>
            <p className={fields.subtitle}>{errorMsg}</p>
            <button
              type="button"
              className={fields.btn}
              onClick={() => window.location.reload()}
            >
              Tentar de novo
            </button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
