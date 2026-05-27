'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
 * UX (refinado):
 *   - UM ÚNICO input com auto-format DD/MM/AAAA. Usuário
 *     digita tudo seguido (sem mudar de campo). Per product
 *     feedback "deixe a data de nascimento de tal forma que
 *     dê pra digitar sem precisar mudar de campo".
 *   - Aviso amigável aparece DE FORMA REATIVA quando a idade
 *     calculada é menor que 18 — não precisa nem submeter pra
 *     ver o feedback. Per "ao colocar uma data com menos de
 *     18 anos, não apareceu os avisos".
 *   - Aceite de termos + privacidade obrigatório.
 *
 * Per spec: obrigatório por LGPD e age gating. Persiste flags
 * `is_minor`, `age`, `birth_date_verified` no onboardingStore
 * (depois sincroniza com backend no /success).
 */

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 110;
const MAX_YEAR = CURRENT_YEAR - 5;

/** Auto-formata digitos brutos em "DD/MM/AAAA". */
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let out = '';
  if (digits.length > 0) out = digits.slice(0, 2);
  if (digits.length > 2) out += '/' + digits.slice(2, 4);
  if (digits.length > 4) out += '/' + digits.slice(4, 8);
  return out;
}

/** Tenta extrair {day, month, year} de uma string formatada.
 *  Retorna null se não tiver os 8 dígitos completos. */
function parseDateInput(input: string): { d: number; m: number; y: number } | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return {
    d: parseInt(digits.slice(0, 2), 10),
    m: parseInt(digits.slice(2, 4), 10),
    y: parseInt(digits.slice(4, 8), 10),
  };
}

export default function BirthDatePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [dateInput, setDateInput] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      if (parts.length === 3) {
        // Reconstrói no formato DD/MM/AAAA pro input.
        setDateInput(`${parts[2]}/${parts[1]}/${parts[0]}`);
      }
      setAcceptedTerms(Boolean(stored.termsAcceptedAt));
    }
  }, [user, authLoading, router]);

  /**
   * Validação reativa: tenta parsear a data e calcular idade
   * a cada mudança. Se faltar dígito, retorna null e nenhum
   * aviso é mostrado.
   */
  const parsed = useMemo(() => {
    const p = parseDateInput(dateInput);
    if (!p) return null;
    if (p.d < 1 || p.d > 31 || p.m < 1 || p.m > 12) return null;
    if (p.y < MIN_YEAR || p.y > MAX_YEAR) return null;
    const candidate = new Date(p.y, p.m - 1, p.d);
    if (
      candidate.getFullYear() !== p.y ||
      candidate.getMonth() !== p.m - 1 ||
      candidate.getDate() !== p.d
    ) {
      return null;
    }
    const isoDate = `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    const age = calculateAge(isoDate);
    return { isoDate, age, isMinor: age < 18 };
  }, [dateInput]);

  const canSubmit = !!parsed && acceptedTerms && !submitting;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) {
      setSubmitError('Data inválida. Confere o formato DD/MM/AAAA.');
      return;
    }
    if (!acceptedTerms) {
      setSubmitError('É preciso aceitar os termos pra continuar.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    track('age_submitted', { age: parsed.age, is_minor: parsed.isMinor });
    if (parsed.isMinor) track('minor_flow_started', { age: parsed.age });

    saveOnboarding({
      birthDate: parsed.isoDate,
      age: parsed.age,
      isMinor: parsed.isMinor,
      birthDateVerified: true,
      termsAcceptedAt: new Date().toISOString(),
      step: 'profile',
    });

    router.push('/auth/onboarding/profile');
  }

  return (
    <AuthShell back="/auth/verify" progress={3 / 5}>
      <div className={fields.fadeIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className={fields.heading}>Quando você nasceu?</h1>
        <p className={fields.subtitle}>
          Sua experiência na plataforma será adaptada à sua faixa etária.
        </p>

        <form onSubmit={onSubmit} className={fields.form} noValidate>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="DD/MM/AAAA"
            value={dateInput}
            onChange={(e) => {
              setDateInput(formatDateInput(e.target.value));
              if (submitError) setSubmitError(null);
            }}
            maxLength={10}
            className={`${fields.input} ${styles.dateInput}`}
            aria-label="Data de nascimento"
            disabled={submitting}
            autoFocus
          />

          {/* Aviso reativo pra menor de idade — aparece assim
           *  que os 8 dígitos formam uma data válida abaixo
           *  de 18 anos. */}
          {parsed?.isMinor && (
            <div className={styles.minorNotice} role="status">
              <strong>Você tem {parsed.age} anos.</strong>
              <br />
              Sua experiência na plataforma será adaptada
              para sua faixa etária.
            </div>
          )}

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
              <a href="/termos" target="_blank" rel="noopener noreferrer">
                Termos de Uso
              </a>{' '}
              e a{' '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                Política de Privacidade
              </a>
              .
            </span>
          </label>

          {submitError && <div className={fields.error} role="alert">{submitError}</div>}

          <button
            type="submit"
            className={fields.btn}
            disabled={!canSubmit}
          >
            {submitting ? 'Salvando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
