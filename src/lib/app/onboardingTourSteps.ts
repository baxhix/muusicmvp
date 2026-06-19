/**
 * Configuração do tour de onboarding in-app (deck animado de cards).
 *
 * Adaptado do protótipo HTML "Redesign do onboarding modal". Esta
 * config é a fonte única dos passos — a UI (`OnboardingTourView`) só
 * a renderiza. Mantê-la tipada + isolada aqui prepara a Fase 2:
 * gerir os passos pelo painel admin (schema + API), substituindo
 * `DEFAULT_ONBOARDING_TOUR` por dados vindos do servidor sem tocar
 * no componente.
 */

export interface OnboardingTourStep {
  /** Slug estável (analytics + key de render). */
  id: string;
  /** Eyebrow ("PASSO 1 DE 4"). Se omitido, é calculado a partir do índice. */
  label?: string;
  /** Emoji exibido acima do título. Vazio = sem emoji. */
  emoji?: string;
  /** Título — suporta \n pra quebra de linha. */
  title: string;
  /** Corpo — suporta \n. */
  body: string;
  /** Texto do botão primário. */
  cta: string;
  /** Decoração de bolhas flutuantes (passo "globo"). */
  decor?: 'globe';
  /**
   * RESERVADO (Fase 2 / spotlight): chave `data-onboarding-anchor` de
   * um elemento real pra destacar com holofote + seta. Hoje sem efeito
   * — o deck é centralizado. Será consumido quando ligarmos o
   * spotlight ancorado nos elementos reais do /app.
   */
  anchor?: string;
}

export interface OnboardingTourConfig {
  steps: OnboardingTourStep[];
  /** Cor de acento (dots de progresso). */
  accent: string;
  /** Fundo do botão CTA (gradient). */
  ctaGradient: string;
  /** Blur (px) do scrim sobre o app. */
  blurAmount: number;
  /** Tela final de celebração. */
  done: {
    emoji: string;
    title: string;
    body: string;
    cta: string;
    /** Link secundário pra rever o tour. */
    replayLabel: string;
  };
}

export const DEFAULT_ONBOARDING_TOUR: OnboardingTourConfig = {
  accent: '#9d7bff',
  ctaGradient: 'linear-gradient(90deg, #7d3aa8 0%, #b23978 58%, #cf406b 100%)',
  blurAmount: 8,
  steps: [
    {
      id: 'fanpoints',
      emoji: '🪙',
      title: 'Cada ação rende\nFanpoints',
      body: 'Ouvir música, curtir, conversar — tudo conta. Acumule pra desbloquear conquistas exclusivas da Boiadeira.',
      cta: 'Próximo',
      anchor: 'fanpoints',
    },
    {
      id: 'connect',
      emoji: '🔮',
      title: 'Conecte com\noutros fãs',
      body: 'Use o Chat pra falar direto com alguém e Comunidades pra debater com a galera toda.',
      cta: 'Próximo',
      anchor: 'chat',
    },
    {
      id: 'globe',
      title: 'Encontre fãs\npelo mundo',
      body: 'Cada ponto no globo é um fã ao vivo. Gire, explore e descubra quem tá ouvindo a Boiadeira com você agora.',
      cta: 'Próximo',
      decor: 'globe',
      anchor: 'globe',
    },
    {
      id: 'ranking',
      emoji: '👑',
      title: 'Suba no ranking\ndos Superfãs',
      body: 'Quem acumula mais Fanpoints vira destaque na comunidade — com badges, posição no top e benefícios exclusivos.',
      cta: 'Concluir',
      anchor: 'ranking',
    },
  ],
  done: {
    emoji: '🎉',
    title: 'Bem-vindo à\nFanverse!',
    body: 'Você já sabe o essencial.\nAgora é só interagir e ver seus Fanpoints subirem.',
    cta: 'Começar a explorar',
    replayLabel: 'Rever tour',
  },
};
