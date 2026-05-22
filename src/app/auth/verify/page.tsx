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
 *   - Input de OTP de 6 dígitos como FALLBACK pra quando o
 *     magic link não chega (spam/delay). O OTP é o mesmo
 *     token do magic link só que digitado manualmente — o
 *     usuário pega no email se ver "Seu código: ABC123".
 *   - Botão "Reenviar" com cooldown de 30s pra evitar abuso.
 *   - "Trocar e-mail" pra voltar pro step 1.
 *
 * Quando o usuário clica no magic link, o backend define a
 * cookie de sessão e redireciona pra próxima etapa (que
 * detectamos via AuthContext.user → continua onboarding).
 *
 * No flow normal o usuário sai DESSE step abrindo o link em
 * outra aba. Esta tela fica esperando — refresh periódico
 * de `user` detecta quando o auth completou e redireciona
 * pra próxima etapa do onboarding.
 */

const COOLDOWN_SECONDS = 30;

export default function VerifyPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh, requestMagicLink } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  /** Refresh periódico pra detectar quando o magic link foi
   *  consumido em outra aba. */
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = loadOnboarding();
    if (!stored.email) {
      // Sem email no store, volta pra entrada.
      router.replace('/auth');
      return;
    }
    setEmail(stored.email);

    // Polling: a cada 4s, refresh do /auth/me. Quando o user
    // aparecer (magic link foi clicado em outra aba), avança.
    refreshIntervalRef.current = setInterval(() => {
      refresh();
    }, 4000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [router, refresh]);

  // User autenticado → continua o onboarding. Se já é "old
  // user" (já tem profile), vai pro /app; senão, segue pro
  // birth-date step.
  useEffect(() => {
    if (authLoading || !user) return;
    track('verification_completed', { method: 'magic_link' });
    // Detecta se a conta já tem perfil completo. ApiUser.name
    // sendo non-null indica que o usuário já passou pelo
    // onboarding antes — é login retornante.
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

  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || otpSubmitting) return;
    setOtpSubmitting(true);
    setOtpError(null);
    track('otp_requested', {});
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });
      if (!res.ok) {
        setOtpError('Código inválido ou expirado.');
        track('otp_failed', { reason: res.status });
      } else {
        // Sucesso — o cookie foi setado. Refresh disparara o
        // useEffect acima e redireciona.
        await refresh();
      }
    } catch {
      setOtpError('Não conseguimos validar agora. Tenta de novo.');
    } finally {
      setOtpSubmitting(false);
    }
  }, [otp, otpSubmitting, email, refresh]);

  const changeEmail = () => {
    saveOnboarding({ step: 'email' });
    router.push('/auth');
  };

  return (
    <AuthShell back="/auth" progress={2 / 6}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className={styles.envelope} aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <rect x="6" y="14" width="52" height="36" rx="6" stroke="currentColor" strokeWidth="2.5" />
            <path d="m8 18 24 18 24-18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className={fields.heading}>Confira seu e-mail</h1>
        <p className={fields.subtitle}>
          Mandamos um link de acesso pra<br />
          <strong className={styles.emailStrong}>{email}</strong>
        </p>

        <form onSubmit={handleOtpSubmit} className={fields.form} noValidate>
          <label className={fields.label} htmlFor="otp">
            Ou digite o código de 6 dígitos
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="000000"
            value={otp}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(v);
              if (otpError) setOtpError(null);
            }}
            className={`${fields.input} ${styles.otpInput}`}
            disabled={otpSubmitting}
            aria-label="Código de verificação"
          />

          {otpError && <div className={fields.error} role="alert">{otpError}</div>}

          <button
            type="submit"
            className={fields.btn}
            disabled={otp.length !== 6 || otpSubmitting}
          >
            {otpSubmitting ? 'Verificando…' : 'Entrar com código'}
          </button>
        </form>

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
