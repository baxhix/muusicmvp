'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import {
  loadOnboarding,
  saveOnboarding,
  clearOnboarding,
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
  const searchParams = useSearchParams();
  const { user, loading: authLoading, requestMagicLink } = useAuth();

  /* Banner "sessão expirada" — quando o AuthContext redireciona
   * pra /auth?expired=1 depois de detectar 401 mid-session
   * numa rota privada. Sem isso o user voltava sem entender o
   * que tinha acontecido (bug reportado: "perdeu meus dados,
   * foi substituído por outro user sem aviso"). */
  const sessionExpired = searchParams.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Já autenticado → vai direto pro app (não passa pelo flow).
  useEffect(() => {
    if (!authLoading && user) router.replace('/app');
  }, [authLoading, user, router]);

  // Restore do email + retoma onboarding em andamento.
  // Só redireciona pra step paths SE o usuário ainda tiver
  // sessão ativa (authLoading=false + user existe). Sem
  // essa guarda, um logout deixava o localStorage com step
  // antigo e o EmailStep mandava pra /auth/onboarding/...
  // que (sem sessão) bounceava de volta pra /auth → loop
  // infinito ("tela tremendo").
  useEffect(() => {
    if (authLoading) return; // espera AuthContext resolver

    const stored = loadOnboarding();
    if (stored.email && !email) setEmail(stored.email);

    if (stored.step !== 'email') {
      if (user) {
        // Sessão ativa + step em andamento → retoma.
        router.replace(STEP_PATHS[stored.step]);
      } else {
        // Sem sessão + step stale → limpa o store pra evitar
        // loops e fica no email step.
        clearOnboarding();
      }
    }
    track('auth_started', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

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
    <AuthShell back="/" progress={1 / 5}>
      {/* flex: 1 + flex column → permite empurrar o `.hint`
       *  (Termos) pro fim da tela em mobile via margin-top:
       *  auto. Em desktop o hint segue logo abaixo do botão
       *  (não há espaço suficiente pra "empurrar"). */}
      <div
        className={fields.fadeIn}
        style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Banner contextual quando o user chega aqui via redirect
         *  de sessão expirada (?expired=1 setado pelo AuthContext).
         *  Tom âmbar/warning, não-bloqueante — explica o que
         *  aconteceu sem assustar quem só esquece de logar. */}
        {sessionExpired && (
          <div className={fields.banner} role="status" aria-live="polite">
            <span className={fields.bannerIcon} aria-hidden="true">!</span>
            <span className={fields.bannerText}>
              <strong>Sua sessão expirou</strong>
              Faça login novamente pra continuar de onde parou.
            </span>
          </div>
        )}

        <h1 className={fields.heading}>Bem-vindo ao Fanverse</h1>
        <p className={fields.subtitle}>
          Digita seu e-mail pra entrar ou criar sua conta.
          <br />
          Sem senhas.
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
          Continuando, você concorda com nossos
          <br />
          <a href="#termos">Termos</a> e{' '}
          <a href="#privacidade">Política de Privacidade</a>.
        </p>
      </div>
    </AuthShell>
  );
}
