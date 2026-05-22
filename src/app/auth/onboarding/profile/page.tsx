'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import { loadOnboarding, saveOnboarding } from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';

/**
 * Step 4 — Profile. Nome de exibição. SEM senha (login via
 * magic link/OTP/social futuramente). */

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
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

    saveOnboarding({ displayName: trimmed, step: 'interests' });
    router.push('/auth/onboarding/interests');
  }

  return (
    <AuthShell back="/auth/onboarding/birth-date" progress={4 / 6}>
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
