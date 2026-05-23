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
 *   - Input de OTP 6 dígitos (backend agora envia código no
 *     mesmo email do magic link — usuário escolhe link ou
 *     código).
 *   - Botão "Reenviar" com cooldown de 30s pra evitar abuso.
 *   - Polling de /auth/me a cada 4s detecta o login pelo link.
 *
 * Backend: GET /api/auth/verify?token=... consome o link.
 * POST /api/auth/verify { email, code } consome o código.
 * Ambos marcam o mesmo registro como consumido.
 */

const COOLDOWN_SECONDS = 30;

export default function VerifyPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh, requestMagicLink } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
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
    // Usa user.isOnboarded (vem do backend) pra decidir o
    // próximo passo. Boolean(user.name) era falso positivo —
    // o backend seeda name=email-prefix em qualquer conta nova,
    // então essa flag não distinguia returning de new.
    if (user.isOnboarded) {
      track('login_success', { user_id: user.id });
      // ?welcome=back — usuário retornante. Triggera o globe
      // flyTo cinematográfico + reveal simultâneo de todos os
      // elementos após o globo settle (vs cascade pra novos).
      // Per product feedback "também para os usuários que já
      // possuem conta. Nesse caso específico, todos os
      // elementos surgem ao mesmo tempo com o fade após o
      // globo se posicionar".
      router.replace('/app?welcome=back');
    } else {
      saveOnboarding({ step: 'birth-date' });
      router.replace('/auth/onboarding/birth-date');
    }
  }, [user, authLoading, router]);

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
    if (ok) setCooldown(COOLDOWN_SECONDS);
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
        // Sucesso — sessão criada. refresh detecta o user e
        // o useEffect acima redireciona pra próxima etapa.
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
    <AuthShell back="/auth" progress={2 / 5}>
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
          Enviamos um link e um código pra<br />
          <strong className={styles.emailStrong}>{email}</strong>
        </p>

        <form onSubmit={handleOtpSubmit} className={fields.form} noValidate>
          <label className={fields.label} htmlFor="otp">
            Digite o código de 6 dígitos
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
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

        <div className={styles.divider}>
          <span>ou</span>
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
                : 'Reenviar link e código'}
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
          Não chegou?
          <br />
          Confere o spam. Link e código expiram em 15 minutos.
        </p>
      </div>
    </AuthShell>
  );
}
