import type { Metadata } from 'next';

/**
 * Layout da página `/para-artistas`.
 *
 * Diferente do `/teste` (sandbox noindex), esta página É a peça
 * institucional pública pra empresários e artistas. Indexável,
 * com Open Graph completo pra que o link rode bem em WhatsApp /
 * Slack / LinkedIn — canais onde empresários compartilham.
 *
 * O design foi briefado como "totalmente disruptivo" — então
 * SEO é menos sobre keywords e mais sobre garantir que o
 * compartilhamento social não vire um card genérico.
 */
export const metadata: Metadata = {
  title: 'Para Artistas — Fanverse',
  description:
    'A infraestrutura que devolve aos artistas o que sempre foi deles: a relação com o fã. Sem intermediário, sem algoritmo, sem dependência.',
  openGraph: {
    title: 'Quem é o dono dos seus fãs?',
    description:
      'A indústria que vocês ajudaram a construir esqueceu de entregar a coisa mais valiosa.',
    type: 'website',
  },
};

export default function ParaArtistasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
