/**
 * onboardingStore — persistência client-side do progresso do
 * fluxo de auth/onboarding. Cobre o requisito "Se o usuário
 * fechar aba/app/atualizar página, ao retornar continua
 * exatamente de onde parou".
 *
 * Estratégia: localStorage por key 'fanverse.onboarding'.
 * Quando a conta é confirmada server-side, este store é
 * limpo (a única fonte de verdade vira o backend).
 *
 * Não armazena nada sensível — apenas state UI:
 *   - email digitado
 *   - step atual
 *   - birth date (se preenchido)
 *   - nome de exibição
 *   - interesses selecionados
 *   - timestamps pra detectar progresso obsoleto.
 */

export type OnboardingStep =
  | 'email'
  | 'verify'
  | 'birth-date'
  | 'profile'
  | 'success';

export interface OnboardingState {
  email?: string;
  step: OnboardingStep;
  /** ISO date string YYYY-MM-DD. */
  birthDate?: string;
  /** Calculado no submit do birth-date step. */
  age?: number;
  isMinor?: boolean;
  birthDateVerified?: boolean;
  termsAcceptedAt?: string;
  displayName?: string;
  interests?: string[];
  /** ms — pra invalidar progresso > 7 dias. */
  updatedAt: number;
}

const STORAGE_KEY = 'fanverse.onboarding';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function emptyState(): OnboardingState {
  return { step: 'email', updatedAt: Date.now() };
}

export function loadOnboarding(): OnboardingState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as OnboardingState;
    // Invalida se muito antigo — usuário voltou após semanas,
    // melhor recomeçar.
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return emptyState();
    }
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveOnboarding(patch: Partial<OnboardingState>): OnboardingState {
  const current = loadOnboarding();
  const next: OnboardingState = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage cheio / disabled — silent. */
    }
  }
  return next;
}

export function clearOnboarding() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silent */
  }
}

/** Routes mapping pra navegação direta. */
export const STEP_PATHS: Record<OnboardingStep, string> = {
  email: '/auth',
  verify: '/auth/verify',
  'birth-date': '/auth/onboarding/birth-date',
  profile: '/auth/onboarding/profile',
  success: '/auth/success',
};

/** Helper: calcula idade a partir de YYYY-MM-DD. */
export function calculateAge(birthDateISO: string): number {
  const [y, m, d] = birthDateISO.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}
