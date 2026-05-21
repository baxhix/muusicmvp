import type { Metadata } from 'next';

/**
 * Layout do sandbox de testes em `/teste`.
 *
 * Marcado como `noindex, nofollow` pra que crawlers (Google,
 * Bing, GPTBot, etc.) não levem essa rota pros índices —
 * experimentos não devem aparecer em busca. Quando o
 * experimento for promovido pra landing oficial, basta apagar
 * essa metadata ou mover o conteúdo pra `/`.
 *
 * O layout em si só passa `children` adiante; herda providers
 * (Auth, Universe, Analytics) do root layout naturalmente.
 */
export const metadata: Metadata = {
  title: 'muusic — sandbox',
  description:
    'Sandbox de experimentos de landing. Não indexado.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function TesteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
