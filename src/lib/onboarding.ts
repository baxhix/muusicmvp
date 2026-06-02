/**
 * Onboarding tooltips — dados + helpers de localStorage.
 *
 * Implementação de P0.3 do roadmap de engajamento
 * (docs/engajamento-detalhe-p0.md): 3 tooltips sequenciais pós
 * welcome flyTo, explicando a gamificação reformulada
 * (Fanpoints, Chat/Comunidades, Ranking de Superfãs).
 *
 * Comportamento (per product feedback):
 *  - Dispara em TODA visita ATÉ o user completar OU pular
 *  - Sequencial 1 → 2 → 3 com botão "Pular tudo"
 *  - Mesmas 3 âncoras em mobile + desktop (posição via rect)
 */

/* Flag de "concluído" — true quando o user chega ao step 3 e
 * clica Concluir, OU clica Pular tudo em qualquer step. Se
 * pular sem completar não persistimos; volta na próxima sessão. */
export const ONBOARDING_DONE_KEY = 'app:onboarding-tooltips-done';

/* Anchor IDs — string consumida em ambos os lados:
 *  - JSX: data-onboarding-anchor="fanpoints" no elemento alvo
 *  - Controller: querySelector(`[data-onboarding-anchor="..."]`) */
export type AnchorId = 'fanpoints' | 'chat' | 'ranking';

/* Placement do tooltip relativo à âncora. O controller decide
 * automaticamente flip pra opposite se não couber na viewport. */
export type Placement = 'top' | 'bottom';

export interface OnboardingStep {
  id: string;
  /* Pequeno preface ("Passo 1 de 3"). */
  counter: string;
  /* Headline 1 linha. */
  title: string;
  /* 2-3 linhas de copy. */
  body: string;
  /* Elemento a apontar. */
  anchor: AnchorId;
  /* Preferência de posicionamento. */
  placement: Placement;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'fanpoints',
    counter: 'Passo 1 de 3',
    title: 'Cada ação rende Fanpoints',
    body: 'Ouvir música, curtir, conversar — tudo conta. Acumule pra desbloquear conquistas exclusivas da Boiadeira.',
    anchor: 'fanpoints',
    placement: 'bottom',
  },
  {
    id: 'chat',
    counter: 'Passo 2 de 3',
    title: 'Conecte com outros fãs',
    body: 'Use o Chat pra falar direto com alguém e Comunidades pra debater com a galera toda.',
    anchor: 'chat',
    placement: 'top',
  },
  {
    id: 'ranking',
    counter: 'Passo 3 de 3',
    title: 'Suba no ranking dos Superfãs',
    body: 'Quem acumula mais Fanpoints vira destaque na comunidade — com badges, posição no top e benefícios exclusivos.',
    anchor: 'ranking',
    placement: 'bottom',
  },
];

/** SSR-safe: localStorage só existe no browser. */
export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
  } catch {
    /* localStorage indisponível (modo privado, quota) — assume
     * concluído pra não bloquear UX. */
    return true;
  }
}

export function markOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_DONE_KEY, '1');
    /* Broadcast pra que toggles de "Refazer tour" em outras telas
     * (TopBar drawer) reflitam o estado novo na hora. */
    window.dispatchEvent(new CustomEvent('app:onboarding-done-changed'));
  } catch {
    /* silent — o usuário continua usando o app normalmente */
  }
}

/** Apaga o flag (usado pelo toggle "Refazer tour" em Configurações). */
export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ONBOARDING_DONE_KEY);
    window.dispatchEvent(new CustomEvent('app:onboarding-done-changed'));
  } catch {
    /* silent */
  }
}
