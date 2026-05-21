import type { BlogPost } from '@/types/blog';
import { MOCK_BLOG_AUTHORS } from './authors';
import { MOCK_BLOG_CATEGORIES } from './categories';
import { MOCK_BLOG_TAGS } from './tags';

/**
 * Helper local pra hidratar referências — em produção o servidor
 * faz isso via JOIN. Aqui simulamos pra que o frontend já receba
 * o payload "completo" como será da API.
 */
const a = (id: string) => MOCK_BLOG_AUTHORS.find((x) => x.id === id)!;
const c = (id: string) => MOCK_BLOG_CATEGORIES.find((x) => x.id === id)!;
const t = (ids: string[]) =>
  ids
    .map((id) => MOCK_BLOG_TAGS.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

/**
 * Dataset cobre os 4 estados do enum (draft, scheduled,
 * published, archived) + variações de SEO preenchido vs. vazio,
 * com/sem cover, com/sem subtítulo. Suficiente pra validar
 * todos os caminhos da UI.
 */
export const MOCK_BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-rodeio-no-texas-feat-diplo',
    title: 'Como "Rodeio no Texas" com Diplo redesenhou a Boiadeira global',
    subtitle:
      'A colaboração que misturou eletrônica e sertanejo abriu portas para palcos internacionais.',
    slug: 'rodeio-no-texas-com-diplo',
    coverImageUrl: 'https://picsum.photos/seed/rodeio-no-texas/480/320',
    coverImageAlt: 'Capa do single "Rodeio no Texas" com Ana Castela e Diplo',
    excerpt:
      'A faixa cruzou 50 milhões de streams em 30 dias e abriu turnês nos EUA. Como a parceria surgiu, o que a produção musical mudou na carreira da Ana, e o que vem a seguir.',
    bodyHtml: `<p class="lede">Quando Ana Castela e Diplo anunciaram <em>Rodeio no Texas</em>, ninguém esperava que uma colaboração tão improvável virasse o single mais escutado do verão. Esse texto destrincha como ela aconteceu.</p>
<h2>A faísca da colaboração</h2>
<p>Em meados de 2025, Diplo postou em suas redes um vídeo dele dançando <em>Tropa do Chapelão</em> num bar em Austin. O clipe viralizou; em menos de uma semana, os agentes das duas pontas estavam conversando.</p>
<h2>O processo de produção</h2>
<p>A faixa foi gravada em três sessões intensas em Los Angeles. O resultado: uma produção que mantém a viola caipira como espinha dorsal mas embute beats eletrônicos no refrão — um híbrido que ninguém tinha tentado antes nessa escala.</p>
<blockquote>Foi como costurar dois mundos. A Ana entrou no estúdio com uma maleta cheia de violões e saiu com uma faixa que toca em Coachella e em rodeio de Barretos. — produtor</blockquote>
<h3>Recepção e impacto comercial</h3>
<p>Em 30 dias, o single passou de 50 milhões de streams. Mais importante: abriu agendas internacionais — Reino Unido, EUA e festivais europeus já confirmaram datas para 2026.</p>`,
    authorId: a('aut-marina-vieira').id,
    authorName: a('aut-marina-vieira').name,
    authorAvatarUrl: a('aut-marina-vieira').avatarUrl,
    categoryId: c('cat-lancamentos').id,
    categoryName: c('cat-lancamentos').name,
    categorySlug: c('cat-lancamentos').slug,
    tags: t(['tag-ana-castela', 'tag-lancamento', 'tag-cultura-pop', 'tag-sertanejo']),
    status: 'published',
    publishedAt: '2026-05-15T12:00:00.000Z',
    seo: {
      metaTitle: 'Como "Rodeio no Texas" com Diplo redesenhou a Boiadeira | Fanverse',
      metaDescription:
        'A parceria entre Ana Castela e Diplo cruzou 50 milhões de streams em 30 dias. Veja como a colaboração nasceu e o que ela representa.',
      focusKeywords: ['ana castela', 'diplo', 'rodeio no texas', 'sertanejo eletrônico'],
      ogImageUrl: '/albuns/lets-go-rodeo.jpg',
      canonicalUrl: '',
    },
    createdAt: '2026-05-10T08:30:00.000Z',
    updatedAt: '2026-05-15T12:00:00.000Z',
    revisionCount: 4,
    readingTimeMinutes: 6,
  },
  {
    id: 'post-bastidores-linlithgow',
    title: 'Bastidores: o palco em Linlithgow Palace foi um ensaio de 3 meses',
    subtitle: 'Reportagem exclusiva da preparação para o primeiro show no Reino Unido.',
    slug: 'bastidores-show-linlithgow-palace',
    coverImageUrl: 'https://picsum.photos/seed/linlithgow-bastidores/480/320',
    coverImageAlt: 'Ana Castela em ensaio para o show em Linlithgow Palace',
    excerpt:
      'Acompanhamos a equipe nas três semanas que antecederam o show internacional. Logística de palco, escolha de figurino, e como adaptar repertório pra plateia bilíngue.',
    bodyHtml: `<p class="lede">O show em Linlithgow Palace é o primeiro internacional fora dos EUA. A equipe inteira mudou pra Escócia 21 dias antes. Aqui vai o que aprendemos.</p>
<h2>A logística do palco</h2>
<p>Trazer uma estrutura de rodeio pra dentro de um palácio histórico do século XV exigiu coordenação com o National Trust escocês. Spoiler: zero pregos, zero adesivos no chão de pedra.</p>
<h2>Adaptação de repertório</h2>
<p>Setlist precisou ser reorganizado pra incluir três faixas com refrão em inglês, mas mantendo o DNA caipira. <strong>Tropa do Chapelão</strong> abriu o show; o público escocês sabia a letra.</p>`,
    authorId: a('aut-rafael-tavares').id,
    authorName: a('aut-rafael-tavares').name,
    authorAvatarUrl: a('aut-rafael-tavares').avatarUrl,
    categoryId: c('cat-bastidores').id,
    categoryName: c('cat-bastidores').name,
    categorySlug: c('cat-bastidores').slug,
    tags: t(['tag-bastidores', 'tag-turne-internacional', 'tag-ana-castela']),
    status: 'published',
    publishedAt: '2026-05-08T09:00:00.000Z',
    seo: {
      metaTitle: 'Bastidores do show em Linlithgow Palace | Fanverse',
      metaDescription:
        'Como a equipe da Ana Castela preparou o primeiro show internacional fora dos EUA durante 3 meses.',
      focusKeywords: ['linlithgow palace', 'turnê internacional', 'bastidores ana castela'],
    },
    createdAt: '2026-04-30T14:00:00.000Z',
    updatedAt: '2026-05-08T09:00:00.000Z',
    revisionCount: 3,
    readingTimeMinutes: 5,
  },
  {
    id: 'post-festival-rodeio-barretos',
    title: 'Festival Rodeio de Barretos 2026: agenda, atrações e como ir',
    subtitle: undefined,
    slug: 'rodeio-barretos-2026-agenda',
    coverImageUrl: 'https://picsum.photos/seed/rodeio-barretos-2026/480/320',
    coverImageAlt: 'Festival do Peão de Barretos 2026 — palco principal iluminado',
    excerpt:
      'O guia completo do Festival do Peão de Barretos 2026 — dia da Ana Castela, esquema de mobilidade, ingressos.',
    bodyHtml: `<p>O Festival de Barretos é o maior evento sertanejo do país. Em 2026 a Ana sobe no palco no segundo final de semana.</p>
<h2>Datas e shows</h2>
<p>De 18 a 26 de agosto. Ana Castela no palco principal dia 23, 22h.</p>`,
    authorId: a('aut-rafael-tavares').id,
    authorName: a('aut-rafael-tavares').name,
    authorAvatarUrl: a('aut-rafael-tavares').avatarUrl,
    categoryId: c('cat-shows-eventos').id,
    categoryName: c('cat-shows-eventos').name,
    categorySlug: c('cat-shows-eventos').slug,
    tags: t(['tag-festival', 'tag-sertanejo']),
    status: 'scheduled',
    publishedAt: '2026-08-01T08:00:00.000Z',
    seo: {
      metaTitle: '',
      metaDescription: '',
    },
    createdAt: '2026-05-20T11:00:00.000Z',
    updatedAt: '2026-05-20T16:30:00.000Z',
    revisionCount: 2,
    readingTimeMinutes: 3,
  },
  {
    id: 'post-cultura-boiadeira-historia',
    title: 'A história da boiadeira: das tropas reais ao palco de hoje',
    slug: 'historia-da-boiadeira',
    coverImageUrl: 'https://picsum.photos/seed/historia-boiadeira/480/320',
    coverImageAlt: 'Imagem ilustrativa de tropeiros do século XIX',
    excerpt:
      'De Goiás do século XIX ao streaming de 2026 — uma análise etnomusicológica de como a figura da mulher boiadeira ressignificou o sertanejo.',
    bodyHtml: `<p class="lede">A boiadeira não nasceu com a Ana Castela — mas a Ana deu a ela uma voz pop. Esse texto reconstrói a linhagem.</p>
<h2>Origens no século XIX</h2>
<p>O termo "boiadeira" aparece em registros do interior de Goiás...</p>`,
    authorId: a('aut-clara-mendonca').id,
    authorName: a('aut-clara-mendonca').name,
    authorAvatarUrl: a('aut-clara-mendonca').avatarUrl,
    categoryId: c('cat-cultura-sertaneja').id,
    categoryName: c('cat-cultura-sertaneja').name,
    categorySlug: c('cat-cultura-sertaneja').slug,
    tags: t(['tag-boiadeira', 'tag-cultura-pop']),
    status: 'draft',
    publishedAt: null,
    seo: {
      metaTitle: '',
      metaDescription:
        'Análise etnomusicológica da figura da boiadeira no sertanejo brasileiro.',
      focusKeywords: ['boiadeira', 'história do sertanejo', 'etnomusicologia'],
    },
    createdAt: '2026-05-18T10:00:00.000Z',
    updatedAt: '2026-05-21T08:15:00.000Z',
    revisionCount: 7,
    readingTimeMinutes: 12,
  },
  {
    id: 'post-fanverse-tutorial-superchat',
    title: 'Guia rápido: como entrar no Superchat e participar',
    slug: 'como-usar-superchat',
    coverImageUrl: 'https://picsum.photos/seed/superchat-tutorial/480/320',
    coverImageAlt: 'Tela do Superchat com mensagens chegando em tempo real',
    excerpt:
      'O Superchat é o canal de chat coletivo do Fanverse, onde fãs trocam mensagens em tempo real durante os shows. Veja como entrar.',
    bodyHtml: `<p>O Superchat é um chat coletivo em tempo real...</p>`,
    authorId: a('aut-pedro-monteiro').id,
    authorName: a('aut-pedro-monteiro').name,
    authorAvatarUrl: a('aut-pedro-monteiro').avatarUrl,
    categoryId: c('cat-comunidade').id,
    categoryName: c('cat-comunidade').name,
    categorySlug: c('cat-comunidade').slug,
    tags: t([]),
    status: 'archived',
    publishedAt: '2026-03-10T15:00:00.000Z',
    seo: {
      metaTitle: 'Como usar o Superchat do Fanverse',
      metaDescription: 'Passo a passo pra entrar no Superchat e participar do chat coletivo.',
    },
    createdAt: '2026-03-05T13:00:00.000Z',
    updatedAt: '2026-04-12T09:00:00.000Z',
    revisionCount: 2,
    readingTimeMinutes: 2,
  },
];

export function loadMockBlogPosts(): BlogPost[] {
  return [...MOCK_BLOG_POSTS];
}
