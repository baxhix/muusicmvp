'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import { loadOnboarding, saveOnboarding } from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';
import styles from './verify.module.css';

/**
 * Step 2 — Verify. Após digitar email, usuário cai aqui.
 *
 * Mostra:
 *   - Confirmação de "enviado pra <email>".
 *   - Botão "Reenviar" com cooldown de 30s pra evitar abuso.
 *   - "Trocar e-mail" pra voltar pro step 1.
 *
 * NOTA sobre OTP: a tela de OTP fallback foi removida porque
 * o backend atual SÓ envia magic link — não há código de 6
 * dígitos no email. Quando o backend suportar OTP, basta
 * reintroduzir o form (commit anterior tem o código).
 *
 * Quando o usuário clica no magic link, o backend define a
 * cookie de sessão. Polling a cada 4s de /auth/me detecta o
 * login e redireciona pra próxima etapa do onboarding.
 */

const COOLDOWN_SECONDS = 30;

export default function VerifyPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh, requestMagicLink } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = loadOnboarding();
    if (!stored.email) {
      router.replace('/auth');
      return;
    }
    setEmail(stored.email);

    // Polling: detecta quando o link foi clicado em outra aba.
    refreshIntervalRef.current = setInterval(() => {
      refresh();
    }, 4000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [router, refresh]);

  useEffect(() => {
    if (authLoading || !user) return;
    track('verification_completed', { method: 'magic_link' });
    const isReturning = Boolean(user.name);
    if (isReturning) {
      track('login_success', { user_id: user.id });
      router.replace('/app');
    } else {
      saveOnboarding({ step: 'birth-date' });
      router.replace('/auth/onboarding/birth-date');
    }
  }, [user, authLoading, router]);

  // Cooldown ticker pro botão de reenviar.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    track('magic_link_resent', {});
    const ok = await requestMagicLink(email);
    setResending(false);
    if (ok) {
      setCooldown(COOLDOWN_SECONDS);
    }
  }, [email, resending, cooldown, requestMagicLink]);

  const changeEmail = () => {
    saveOnboarding({ step: 'email' });
    router.push('/auth');
  };

  return (
    <AuthShell back="/auth" progress={2 / 6}>
      <div
        className={fields.fadeIn}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className={styles.envelope} aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <rect x="6" y="14" width="52" height="36" rx="6" stroke="currentColor" strokeWidth="2.5" />
            <path d="m8 18 24 18 24-18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className={fields.heading}>Confira seu e-mail</h1>
        <p className={fields.subtitle}>
          Enviamos um link de acesso para<br />
          <strong className={styles.emailStrong}>{email}</strong>
          <br />
          Clique no link para entrar.
        </p>

        <div className={styles.statusBox}>
          <div className={styles.spinnerDot} aria-hidden="true" />
          <span>Aguardando você clicar no link…</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleResend}
            className={fields.btnGhost}
            disabled={resending || cooldown > 0}
          >
            {cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : resending
                ? 'Reenviando…'
                : 'Reenviar link'}
          </button>

          <button
            type="button"
            onClick={changeEmail}
            className={fields.btnGhost}
          >
            Usar outro e-mail
          </button>
        </div>

        <p className={fields.hint}>
          Não chegou? Confere a caixa de spam. O link expira em 15 minutos.
        </p>
      </div>
    </AuthShell>
  );
}
