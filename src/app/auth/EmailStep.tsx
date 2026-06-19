'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { track } from '@/lib/analytics';
import {
  loadOnboarding,
  saveOnboarding,
  clearOnboarding,
  STEP_PATHS,
} from '@/lib/auth/onboardingStore';
import AuthShell from '@/components/auth/AuthShell';
import AuthSessionLoading from '@/components/auth/AuthSessionLoading';
import AuthStateButton from '@/components/auth/AuthStateButton';
import FanverseCore from '@/components/animations/FanverseCore';
import fields from '@/components/auth/AuthFields.module.css';

/**
 * useKeyboardInset — altura (px) que o teclado virtual ocupa, via
 * visualViewport. 0 quando fechado. Usado pra "ancorar" o botão de
 * continuar logo acima do teclado no mobile. Ignora deltas pequenos
 * (barra de endereço) com um threshold.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(kb > 90 ? kb : 0);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

/* Tempo mínimo (ms) que o splash de "Retomando sua sessão" fica
 * visível mesmo se o /api/auth/me responder rápido. Garante que
 * usuário com sessão válida nunca veja a tela de login piscando
 * antes do redirect pra /app — e dá uma sensação de transição
 * intencional pra quem está sem sessão (vê o splash, depois cai
 * suave no form). */
const SESSION_PROBE_MIN_MS = 1500;

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

  // Altura do teclado virtual (mobile) — ancora o CTA logo acima dele.
  const kbInset = useKeyboardInset();
  // Orbe (FanverseCore/WebGL) só monta no mobile — evita rodar canvas
  // no desktop, onde ele fica escondido.
  const isMobile = useIsMobile();

  /* Splash de validação de sessão — fica visível enquanto o
   * AuthContext consulta /api/auth/me E enquanto o min-hold timer
   * (SESSION_PROBE_MIN_MS) não expirou, para que o usuário NUNCA
   * veja o form de email antes de saber se já tem sessão.
   *
   * - authLoading true                 → ainda consultando backend
   * - minHoldElapsed false             → backend respondeu rápido,
   *                                      seguramos o splash
   * - user existe (post-load)          → vamos redirecionar pra /app,
   *                                      mantemos splash até navegar
   * - sem sessão + minHold cumprido    → mostra o form normalmente */
  const [minHoldElapsed, setMinHoldElapsed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMinHoldElapsed(true), SESSION_PROBE_MIN_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Já autenticado → vai direto pro app (não passa pelo flow).
  useEffect(() => {
    if (!authLoading && user) router.replace('/app');
  }, [authLoading, user, router]);

  /* Critério final de exibir splash. user!=null cobre o intervalo
   * entre detectar sessão e o router.replace concretizar. */
  const showSessionSplash = authLoading || user != null || !minHoldElapsed;

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

  /* Enquanto validamos sessão, NUNCA renderizamos o AuthShell+form.
   * Isso impede o "flash" do login pra quem já está logado e cria
   * uma transição contínua (splash → /app) per spec. */
  if (showSessionSplash) {
    return <AuthSessionLoading />;
  }

  return (
    <AuthShell back="/" progress={1 / 5} hideLogoMobile>
      {/* Orbe (mobile) — substitui o logotipo no topo, alinhado à
       *  esquerda em 120x120. Só monta no mobile (WebGL). */}
      {isMobile && (
        <div className={fields.mobileOrb} aria-hidden="true">
          <FanverseCore />
        </div>
      )}

      <div
        className={`${fields.fadeIn} ${fields.emailBlock}`}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
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

        <h1 className={`${fields.heading} ${fields.headingTight}`}>Bem-vindo ao<br />Fanverse Ana Castela</h1>
        <p className={fields.subtitle}>Digite seu e-mail para continuar</p>

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
            className={`${fields.input} ${fields.inputSm}`}
            disabled={submitting}
            aria-label="E-mail"
          />

          {error && <div className={fields.error} role="alert">{error}</div>}

          {/* Dock do CTA — no mobile, quando o teclado abre, o botão
           *  vira fixed logo acima dele (kbInset via visualViewport).
           *  Sem teclado/desktop: fluxo normal. */}
          <div
            className={fields.submitDock}
            style={
              kbInset > 0
                ? { position: 'fixed', left: 20, right: 20, bottom: kbInset + 14, zIndex: 60 }
                : undefined
            }
          >
            <AuthStateButton
              type="submit"
              state={submitting ? 'pending' : 'idle'}
              idleLabel="Continuar"
              pendingLabel="Enviando…"
              disabled={!email.trim()}
            />
          </div>
        </form>
      </div>

      {/* Login social — logo acima dos termos (rodapé). Discreto e
       *  DESABILITADO (visual apenas). */}
      <div className={fields.social}>
          <div className={fields.socialRow}>
            <button type="button" className={fields.socialBtn} disabled aria-label="Entrar com Google">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.5-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 16 3 9.1 7.6 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 36.3 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9 40.3 16 45 24 45z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36 44 30.6 44 24c0-1.3-.1-2.5-.4-3.5z" />
              </svg>
            </button>
            <button type="button" className={fields.socialBtn} disabled aria-label="Entrar com Apple">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#fff" d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13l.04-.01zM14.46 4.5c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.46z" />
              </svg>
            </button>
            <button type="button" className={fields.socialBtn} disabled aria-label="Entrar com Facebook">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#1877F2" d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" />
              </svg>
            </button>
          </div>
          <p className={fields.socialNote}>Login social desabilitado</p>
        </div>

      {/* Disclaimer de Termos — rodapé da página. No desktop fica
       *  ancorado no fundo do form pane (fora do bloco centralizado);
       *  no mobile/tablet o wrapper flex empurra pro fim da tela. */}
      <p className={`${fields.hint} ${fields.hintFooter}`}>
        Continuando, você concorda com nossos
        <br />
        <a href="/termos" target="_blank" rel="noopener noreferrer">Termos</a>{' '}
        e{' '}
        <a href="/privacidade" target="_blank" rel="noopener noreferrer">
          Política de Privacidade
        </a>
        .
      </p>
    </AuthShell>
  );
}
