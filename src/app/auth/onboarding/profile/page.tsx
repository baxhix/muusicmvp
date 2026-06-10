'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import { loadOnboarding, saveOnboarding } from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';
import styles from './profile.module.css';

/**
 * Step 4 — Profile. Nome de exibição + consentimento de localização
 * (LGPD). SEM senha (login via magic link/OTP/social futuramente). */

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  // Consentimento LGPD de localização — default OFF (opt-in afirmativo).
  const [locationConsent, setLocationConsent] = useState(false);
  // Menores nunca compartilham localização: o toggle some e o valor é
  // forçado false no submit (e de novo no servidor).
  const [isMinor, setIsMinor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    const stored = loadOnboarding();
    if (!stored.birthDate) {
      // Pulou birth-date → manda de volta.
      router.replace('/auth/onboarding/birth-date');
      return;
    }
    if (stored.displayName) setDisplayName(stored.displayName);
    setIsMinor(Boolean(stored.isMinor));
    if (typeof stored.locationConsent === 'boolean') {
      setLocationConsent(stored.locationConsent);
    }
  }, [user, authLoading, router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setError('Nome muito curto.');
      return;
    }
    if (trimmed.length > 40) {
      setError('Nome muito longo (máx 40 caracteres).');
      return;
    }
    setError(null);
    setSubmitting(true);

    track('profile_name_submitted', { length: trimmed.length });

    // Menores nunca consentem (LGPD); o servidor reforça isso.
    const consent = isMinor ? false : locationConsent;
    track(consent ? 'location_consent_granted' : 'location_consent_denied', {
      surface: 'onboarding',
    });

    // Interests step removido — vai direto pro success/finalize.
    saveOnboarding({
      displayName: trimmed,
      locationConsent: consent,
      step: 'success',
    });
    router.push('/auth/success');
  }

  return (
    <AuthShell back="/auth/onboarding/birth-date" progress={4 / 5}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className={fields.heading}>Como devemos te chamar?</h1>
        <p className={fields.subtitle}>
          Esse é o nome que outros usuários verão quando você comentar, curtir
          ou enviar mensagens.
        </p>

        <form onSubmit={onSubmit} className={fields.form} noValidate>
          <input
            type="text"
            autoComplete="name"
            autoFocus
            placeholder="Seu nome"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (error) setError(null);
            }}
            className={fields.input}
            disabled={submitting}
            maxLength={40}
            aria-label="Nome de exibição"
          />

          {isMinor ? (
            <p className={styles.minorNote}>
              O compartilhamento de localização não está disponível para
              menores de 18 anos.
            </p>
          ) : (
            <label className={styles.consentRow}>
              <input
                type="checkbox"
                checked={locationConsent}
                onChange={(e) => setLocationConsent(e.target.checked)}
                className={styles.checkbox}
                disabled={submitting}
              />
              <span>
                Quero aparecer no mapa para outros fãs (localização aproximada
                — nunca exata). Você pode mudar isso quando quiser nas{' '}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                  configurações de privacidade
                </a>
                .
              </span>
            </label>
          )}

          {error && <div className={fields.error} role="alert">{error}</div>}

          <button
            type="submit"
            className={fields.btn}
            disabled={submitting || displayName.trim().length < 2}
          >
            {submitting ? 'Salvando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
