'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import {
  loadOnboarding,
  saveOnboarding,
  calculateAge,
} from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import fields from '@/components/auth/AuthFields.module.css';
import styles from './birth-date.module.css';

/**
 * Step 3 — Data de nascimento.
 *
 * Per spec: obrigatório por LGPD e age gating. Calcula idade,
 * identifica menor, persiste flags `is_minor`, `age`,
 * `birth_date_verified` no onboardingStore (depois sincroniza
 * com backend no /success).
 *
 * Aceite de termos obrigatório — exibe link pra políticas.
 *
 * UX: select-style (dia / mês / ano) em três inputs separados
 * pra não depender do native date picker (que varia muito
 * entre browsers/OS). Mais previsível e estilizável.
 */

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 110;
const MAX_YEAR = CURRENT_YEAR - 5; // 5 anos: lower bound legal arbitrário

export default function BirthDatePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Guard: redireciona se não chegou no fluxo correto.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    track('onboarding_started', { step: 'birth-date' });

    const stored = loadOnboarding();
    if (stored.birthDate) {
      const parts = stored.birthDate.split('-');
      setYear(parts[0] ?? '');
      setMonth(parts[1] ?? '');
      setDay(parts[2] ?? '');
      setAcceptedTerms(Boolean(stored.termsAcceptedAt));
    }
  }, [user, authLoading, router]);

  function validate(): string | null {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!d || d < 1 || d > 31) return 'Dia inválido.';
    if (!m || m < 1 || m > 12) return 'Mês inválido.';
    if (!y || y < MIN_YEAR || y > MAX_YEAR) {
      return `Ano deve estar entre ${MIN_YEAR} e ${MAX_YEAR}.`;
    }
    // Validação básica: data existe?
    const candidate = new Date(y, m - 1, d);
    if (
      candidate.getFullYear() !== y ||
      candidate.getMonth() !== m - 1 ||
      candidate.getDate() !== d
    ) {
      return 'Data inválida.';
    }
    if (!acceptedTerms) return 'É preciso aceitar os termos pra continuar.';
    return null;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);

    const isoDate = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const age = calculateAge(isoDate);
    const isMinor = age < 18;

    track('age_submitted', { age, is_minor: isMinor });
    if (isMinor) track('minor_flow_started', { age });

    saveOnboarding({
      birthDate: isoDate,
      age,
      isMinor,
      birthDateVerified: true,
      termsAcceptedAt: new Date().toISOString(),
      step: 'profile',
    });

    router.push('/auth/onboarding/profile');
  }

  return (
    <AuthShell back="/auth/verify" progress={3 / 6}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className={fields.heading}>Quando você nasceu?</h1>
        <p className={fields.subtitle}>
          Sua experiência na plataforma será adaptada à sua faixa etária.
        </p>

        <form onSubmit={onSubmit} className={fields.form} noValidate>
          <div className={styles.dateRow}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="DD"
              value={day}
              onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className={`${fields.input} ${styles.dateInput}`}
              aria-label="Dia"
              disabled={submitting}
              autoFocus
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="MM"
              value={month}
              onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className={`${fields.input} ${styles.dateInput}`}
              aria-label="Mês"
              disabled={submitting}
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="AAAA"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className={`${fields.input} ${styles.dateInputYear}`}
              aria-label="Ano"
              disabled={submitting}
            />
          </div>

          <label className={styles.termsRow}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className={styles.checkbox}
              disabled={submitting}
            />
            <span>
              Concordo com os{' '}
              <a href="#termos">Termos de Uso</a> e a{' '}
              <a href="#privacidade">Política de Privacidade</a>.
            </span>
          </label>

          {error && <div className={fields.error} role="alert">{error}</div>}

          <button
            type="submit"
            className={fields.btn}
            disabled={submitting || !day || !month || !year || !acceptedTerms}
          >
            {submitting ? 'Salvando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
