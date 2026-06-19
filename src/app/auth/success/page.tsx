'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
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
 * Step 6 — Success. Salva o onboarding no backend, mostra a
 * tela "Preparando experiências" (fotos + barra de progresso
 * do Motion, 4s) e redireciona pro /app.
 *
 * Backend call: POST /api/auth/onboarding com displayName,
 * birthDate, age, isMinor, locationConsent, termsAcceptedAt. Se
 * o endpoint não existir ainda (404), trata como sucesso — o
 * store local mantém os dados pra retry futuro.
 */

const REDIRECT_DELAY_MS = 4000;

const PREP_IMAGES = ['/xp-01.jpg', '/xp-02.jpg'];

export default function SuccessPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const prefersReduced = useReducedMotion();

  const [status, setStatus] = useState<'preparing' | 'error'>('preparing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * Guard ref: garante que o efeito roda EXATAMENTE UMA VEZ por
   * mount. Sem isso, `await refresh()` mexe no AuthContext.user
   * (que está no deps do useEffect) e dispara re-execução,
   * deixando o usuário preso na tela.
   */
  const startedRef = useRef(false);
  // Timer fixo do redirect. Guardado em ref só pra o catch poder
  // cancelar em caso de erro real. NÃO retornamos cleanup do
  // efeito de propósito: a mudança de `user` (via refresh) faria o
  // React limpar o timer e nunca redirecionar (bug antigo).
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const stored = loadOnboarding();

    // Cronômetro fixo da tela de preparo: a barra de progresso
    // anima por 4s e, ao fim, leva pro app. O save roda em
    // paralelo e normalmente termina bem antes.
    redirectTimerRef.current = setTimeout(() => {
      router.replace('/app?welcome=1');
    }, REDIRECT_DELAY_MS);

    async function complete() {
      try {
        // Tenta persistir no backend. Interests removidos do
        // payload — step foi descontinuado do fluxo.
        await api.post<{ ok: true }>('/api/auth/onboarding', {
          displayName: stored.displayName,
          birthDate: stored.birthDate,
          age: stored.age,
          isMinor: stored.isMinor,
          locationConsent: stored.locationConsent,
          termsAcceptedAt: stored.termsAcceptedAt,
        });

        await refresh();
        clearOnboarding();
        track('onboarding_completed', { is_minor: stored.isMinor });
        track('account_created', { method: 'email_magic_link' });
      } catch (err) {
        // 404 = endpoint ainda não existe → segue o fluxo normal
        // (dados ficam no store local pra retry).
        if (err instanceof ApiError && err.status === 404) return;
        // Falha real — cancela o redirect e mostra erro.
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        setStatus('error');
        setErrorMsg('Algo deu errado ao finalizar. Tenta de novo?');
        track('auth_login_failed', { reason: 'onboarding_finalize' });
      }
    }

    complete();
  }, [user, authLoading, router, refresh]);

  return (
    <AuthShell back="hide" progress={5 / 5}>
      <div
        className={fields.fadeIn}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
      >
        {status === 'preparing' && (
          <div className={styles.prep}>
            <div className={styles.prepImages} aria-hidden="true">
              {PREP_IMAGES.map((src, i) => (
                <motion.div
                  key={src}
                  className={styles.prepCard}
                  initial={prefersReduced ? false : { opacity: 0, y: 18, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className={styles.prepImg} />
                </motion.div>
              ))}
            </div>

            <h1 className={fields.heading}>Preparando experiências</h1>

            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Preparando experiências"
            >
              <motion.div
                className={styles.progressFill}
                initial={{ width: prefersReduced ? '100%' : '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: prefersReduced ? 0 : 4, ease: 'easeInOut' }}
              />
            </div>
          </div>
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
