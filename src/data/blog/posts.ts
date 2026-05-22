/**
 * Blog — mock catalog do FRONTEND PÚBLICO.
 *
 * Espelha o mock do admin (data/mock/blog/posts.ts) mas filtrado
 * pra `status === 'published'` e narrowed pro shape público.
 * Quando a API real subir, esses mocks somem e a fetch substitui.
 *
 * Mantemos textos longos pra dar conteúdo "real" pro reading-flow
 * do blog público — o leitor sente o ritmo de um post de verdade
 * (lede, headings, parágrafos, citação, listas, imagem inline).
 */

import type { BlogPost, BlogPostListItem } from '@/types/blog';

const POSTS: BlogPost[] = [
  {
    id: 'post-rodeio-no-texas-feat-diplo',
    title:
      'Como "Rodeio no Texas" com Diplo redesenhou a Boiadeira global',
    subtitle:
      'A colaboração que misturou eletrônica e sertanejo abriu portas para palcos internacionais.',
    slug: 'rodeio-no-texas-com-diplo',
    coverImageUrl: 'https://picsum.photos/seed/rodeio-no-texas/1280/720',
    coverImageAlt:
      'Capa do single "Rodeio no Texas" com Ana Castela e Diplo',
    excerpt:
      'A faixa cruzou 50 milhões de streams em 30 dias e abriu turnês nos EUA. Como a parceria surgiu, o que a produção musical mudou na carreira da Ana, e o que vem a seguir.',
    bodyHtml: `<p class="lede">Quando Ana Castela e Diplo anunciaram <em>Rodeio no Texas</em>, ninguém esperava que uma colaboração tão improvável virasse o single mais escutado do verão. Esse texto destrincha como ela aconteceu.</p>
<h2>A faísca da colaboração</h2>
<p>Em meados de 2025, Diplo postou em suas redes um vídeo dele dançando <em>Tropa do Chapelão</em> num bar em Austin. O clipe viralizou; em menos de uma semana, os agentes das duas pontas estavam conversando.</p>
<p>A primeira sessão aconteceu por chamada de vídeo. Diplo mandou um beat, Ana mandou uma melodia gravada do celular. Em 48 horas o esqueleto da faixa estava de pé — sem que os dois tivessem se encontrado pessoalmente.</p>
<h2>O processo de produção</h2>
<p>A faixa foi gravada em três sessões intensas em Los Angeles. O resultado: uma produção que mantém a viola caipira como espinha dorsal mas embute beats eletrônicos no refrão — um híbrido que ninguém tinha tentado antes nessa escala.</p>
<blockquote>Foi como costurar dois mundos. A Ana entrou no estúdio com uma maleta cheia de violões e saiu com uma faixa que toca em Coachella e em rodeio de Barretos. — produtor</blockquote>
<h3>Recepção e impacto comercial</h3>
<p>Em 30 dias, o single passou de 50 milhões de streams. Mais importante: abriu agendas internacionais — Reino Unido, EUA e festivais europeus já confirmaram datas para 2026.</p>
<ul>
<li>50M+ streams em 30 dias no Spotify.</li>
<li>Top 5 global em Apple Music por 3 semanas.</li>
<li>3 datas confirmadas no Coachella 2026.</li>
</ul>
<p>O caminho que se abre agora vai além das métricas. A Ana entrou de vez no circuito internacional, e o sertanejo brasileiro ganha um capítulo novo na sua história global.</p>`,
    authorId: 'aut-marina-vieira',
    authorName: 'Marina Vieira',
    authorAvatarUrl: 'https://i.pravatar.cc/200?img=47',
    authorSlug: 'marina-vieira',
    authorBio:
      'Jornalista de música, cobre o mercado da música pop brasileira há 8 anos. Editora-chefe do blog Fanverse.',
    categoryId: 'cat-lancamentos',
    categoryName: 'Lançamentos',
    categorySlug: 'lancamentos',
    tags: [
      { id: 'tag-ana-castela', name: 'Ana Castela', slug: 'ana-castela' },
      { id: 'tag-lancamento', name: 'Lançamento', slug: 'lancamento' },
      { id: 'tag-cultura-pop', name: 'Cultura Pop', slug: 'cultura-pop' },
      { id: 'tag-sertanejo', name: 'Sertanejo', slug: 'sertanejo' },
    ],
    publishedAt: '2026-05-15T12:00:00.000Z',
    seo: {
      metaTitle:
        'Como "Rodeio no Texas" com Diplo redesenhou a Boiadeira | Fanverse',
      metaDescription:
        'A parceria entre Ana Castela e Diplo cruzou 50 milhões de streams em 30 dias. Veja como a colaboração nasceu e o que ela representa.',
      focusKeywords: [
        'ana castela',
        'diplo',
        'rodeio no texas',
        'sertanejo eletrônico',
      ],
    },
    readingTimeMinutes: 6,
  },
  {
    id: 'post-bastidores-linlithgow',
    title:
      'Bastidores: o palco em Linlithgow Palace foi um ensaio de 3 meses',
    subtitle:
      'Reportagem exclusiva da preparação para o primeiro show no Reino Unido.',
    slug: 'bastidores-show-linlithgow-palace',
    coverImageUrl:
      'https://picsum.photos/seed/linlithgow-bastidores/1280/720',
    coverImageAlt: 'Ana Castela em ensaio para o show em Linlithgow Palace',
    excerpt:
      'Acompanhamos a equipe nas três semanas que antecederam o show internacional. Logística de palco, escolha de figurino, e como adaptar repertório pra plateia bilíngue.',
    bodyHtml: `<p class="lede">O show em Linlithgow Palace é o primeiro internacional fora dos EUA. A equipe inteira mudou pra Escócia 21 dias antes. Aqui vai o que aprendemos.</p>
<h2>A logística do palco</h2>
<p>Trazer uma estrutura de rodeio pra dentro de um palácio histórico do século XV exigiu coordenação com o National Trust escocês. Spoiler: zero pregos, zero adesivos no chão de pedra.</p>
<p>O time de produção desenhou uma estrutura modular que se apoia em si mesma — quatro toneladas de equipamento sustentadas por compressão lateral, sem nenhuma fixação na arquitetura original.</p>
<h2>Adaptação de repertório</h2>
<p>Setlist precisou ser reorganizado pra incluir três faixas com refrão em inglês, mas mantendo o DNA caipira. <strong>Tropa do Chapelão</strong> abriu o show; o público escocês sabia a letra.</p>
<blockquote>A galera de gaita escocesa pediu pra cantar com a gente no encerramento. Foi inesperado e lindo. — Ana Castela</blockquote>
<h3>O que vem a seguir</h3>
<p>Com a temporada europeia destravada, mais três cidades entraram no roteiro: Berlim, Lisboa e Amsterdã. Datas saem em junho.</p>`,
    authorId: 'aut-rafael-tavares',
    authorName: 'Rafael Tavares',
    authorAvatarUrl: 'https://i.pravatar.cc/200?img=11',
    authorSlug: 'rafael-tavares',
    authorBio:
      'Repórter cultural com foco em eventos ao vivo e turnês internacionais.',
    categoryId: 'cat-bastidores',
    categoryName: 'Bastidores',
    categorySlug: 'bastidores',
    tags: [
      { id: 'tag-bastidores', name: 'Bastidores', slug: 'bastidores' },
      {
        id: 'tag-turne-internacional',
        name: 'Turnê Internacional',
        slug: 'turne-internacional',
      },
      { id: 'tag-ana-castela', name: 'Ana Castela', slug: 'ana-castela' },
    ],
    publishedAt: '2026-05-08T09:00:00.000Z',
    seo: {
      metaTitle: 'Bastidores do show em Linlithgow Palace | Fanverse',
      metaDescription:
        'Como a equipe da Ana Castela preparou o primeiro show internacional fora dos EUA durante 3 meses.',
      focusKeywords: [
        'linlithgow palace',
        'turnê internacional',
        'bastidores ana castela',
      ],
    },
    readingTimeMinutes: 5,
  },
  {
    id: 'post-fanverse-tutorial-superchat',
    title: 'Guia rápido: como entrar no Superchat e participar',
    subtitle:
      'Tudo que você precisa saber pra trocar mensagens em tempo real com outros fãs.',
    slug: 'como-usar-superchat',
    coverImageUrl: 'https://picsum.photos/seed/superchat-tutorial/1280/720',
    coverImageAlt:
      'Tela do Superchat com mensagens chegando em tempo real',
    excerpt:
      'O Superchat é o canal de chat coletivo do Fanverse, onde fãs trocam mensagens em tempo real durante os shows. Veja como entrar.',
    bodyHtml: `<p class="lede">O Superchat é um chat coletivo em tempo real do Fanverse. Funciona durante lives, shows ao vivo e em momentos especiais.</p>
<h2>Como acessar</h2>
<p>Abra o app, toque no ícone de chat na barra inferior e selecione "Superchat". Ele é aberto pra todos os fãs cadastrados.</p>
<h2>Regras básicas</h2>
<ul>
<li>Trate todo mundo com respeito.</li>
<li>Sem spam ou propaganda.</li>
<li>Sem links de fora — apenas conteúdo do app.</li>
</ul>
<h3>Recursos</h3>
<p>Você pode reagir com emojis, mencionar outros fãs e fixar mensagens importantes. Durante lives, comentários da artista aparecem em destaque.</p>`,
    authorId: 'aut-pedro-monteiro',
    authorName: 'Pedro Monteiro',
    authorAvatarUrl: 'https://i.pravatar.cc/200?img=14',
    authorSlug: 'pedro-monteiro',
    authorBio:
      'Editor de produto do Fanverse. Escreve sobre features novas e como aproveitá-las.',
    categoryId: 'cat-comunidade',
    categoryName: 'Comunidade',
    categorySlug: 'comunidade',
    tags: [
      { id: 'tag-tutorial', name: 'Tutorial', slug: 'tutorial' },
      { id: 'tag-superchat', name: 'Superchat', slug: 'superchat' },
    ],
    publishedAt: '2026-04-22T15:00:00.000Z',
    seo: {
      metaTitle: 'Como usar o Superchat do Fanverse',
      metaDescription:
        'Passo a passo pra entrar no Superchat e participar do chat coletivo.',
    },
    readingTimeMinutes: 3,
  },
  {
    id: 'post-cultura-boiadeira-historia',
    title: 'A história da boiadeira: das tropas reais ao palco de hoje',
    subtitle:
      'Como a figura da boiadeira ressignificou o sertanejo brasileiro nos últimos 5 anos.',
    slug: 'historia-da-boiadeira',
    coverImageUrl: 'https://picsum.photos/seed/historia-boiadeira/1280/720',
    coverImageAlt: 'Imagem ilustrativa de tropeiros do século XIX',
    excerpt:
      'De Goiás do século XIX ao streaming de 2026 — uma análise etnomusicológica de como a figura da mulher boiadeira ressignificou o sertanejo.',
    bodyHtml: `<p class="lede">A boiadeira não nasceu com a Ana Castela — mas a Ana deu a ela uma voz pop. Esse texto reconstrói a linhagem.</p>
<h2>Origens no século XIX</h2>
<p>O termo "boiadeira" aparece em registros do interior de Goiás, descrevendo mulheres que tocavam gado em viagens de meses entre fazendas. Era um trabalho duro, predominantemente masculino — mas as exceções viraram lenda local.</p>
<h2>A virada na música</h2>
<p>Nos anos 1980, o sertanejo romântico ocupou o mainstream brasileiro. A figura da mulher, quando aparecia, era passiva — esperando, sofrendo, perdoando. Não cabia uma boiadeira no enredo.</p>
<p>A reviravolta começou nos anos 2010 com o feminejo. Mas foi em 2022, com o single homônimo da Ana Castela, que a boiadeira se tornou personagem central — não acessório, não exceção.</p>
<blockquote>A boiadeira de hoje monta no cavalo, mas também monta o próprio show. — pesquisadora de etnomusicologia</blockquote>
<h3>O que isso muda</h3>
<p>Ouvir "Boiadeira" tocando em festas universitárias, em Lisboa, em Buenos Aires — é entender que uma figura local virou símbolo global. O sertanejo cresceu junto.</p>`,
    authorId: 'aut-clara-mendonca',
    authorName: 'Clara Mendonça',
    authorAvatarUrl: 'https://i.pravatar.cc/200?img=44',
    authorSlug: 'clara-mendonca',
    authorBio:
      'Doutoranda em etnomusicologia. Pesquisa sertanejo contemporâneo e gênero.',
    categoryId: 'cat-cultura-sertaneja',
    categoryName: 'Cultura Sertaneja',
    categorySlug: 'cultura-sertaneja',
    tags: [
      { id: 'tag-boiadeira', name: 'Boiadeira', slug: 'boiadeira' },
      { id: 'tag-cultura-pop', name: 'Cultura Pop', slug: 'cultura-pop' },
    ],
    publishedAt: '2026-04-10T11:00:00.000Z',
    seo: {
      metaTitle: 'A história da boiadeira no sertanejo | Fanverse',
      metaDescription:
        'Análise etnomusicológica da figura da boiadeira no sertanejo brasileiro.',
      focusKeywords: [
        'boiadeira',
        'história do sertanejo',
        'etnomusicologia',
      ],
    },
    readingTimeMinutes: 12,
  },
  {
    id: 'post-festival-rodeio-barretos',
    title: 'Festival Rodeio de Barretos 2026: agenda, atrações e como ir',
    subtitle:
      'Guia completo do maior evento sertanejo do país.',
    slug: 'rodeio-barretos-2026-agenda',
    coverImageUrl: 'https://picsum.photos/seed/rodeio-barretos-2026/1280/720',
    coverImageAlt:
      'Festival do Peão de Barretos 2026 — palco principal iluminado',
    excerpt:
      'O guia completo do Festival do Peão de Barretos 2026 — dia da Ana Castela, esquema de mobilidade, ingressos.',
    bodyHtml: `<p class="lede">O Festival de Barretos é o maior evento sertanejo do país. Em 2026 a Ana sobe no palco no segundo final de semana.</p>
<h2>Datas e shows</h2>
<p>De 18 a 26 de agosto. Ana Castela no palco principal dia 23, 22h.</p>
<h2>Como ir</h2>
<p>Ônibus saindo de São Paulo, Brasília e Goiânia. Estacionamento no parque, mas o transporte público é mais prático.</p>
<h3>Ingressos</h3>
<p>Lote 1 esgotado. Lote 2 abre em junho. Cadastre-se no app pra receber notificação.</p>`,
    authorId: 'aut-rafael-tavares',
    authorName: 'Rafael Tavares',
    authorAvatarUrl: 'https://i.pravatar.cc/200?img=11',
    authorSlug: 'rafael-tavares',
    authorBio:
      'Repórter cultural com foco em eventos ao vivo e turnês internacionais.',
    categoryId: 'cat-shows-eventos',
    categoryName: 'Shows e Eventos',
    categorySlug: 'shows-eventos',
    tags: [
      { id: 'tag-festival', name: 'Festival', slug: 'festival' },
      { id: 'tag-sertanejo', name: 'Sertanejo', slug: 'sertanejo' },
    ],
    publishedAt: '2026-03-28T08:00:00.000Z',
    seo: {
      metaTitle: 'Festival Rodeio de Barretos 2026 — Guia completo',
      metaDescription:
        'Datas, atrações e como ir no Festival do Peão de Barretos 2026.',
    },
    readingTimeMinutes: 3,
  },
  {
    id: 'post-superfas-evento-vip',
    title:
      'O que rolou no encontro Top 10 superfãs: relatos de quem esteve lá',
    subtitle:
      'Os 10 superfãs do mês foram pra um encontro privado com a Ana. Contamos como foi.',
    slug: 'encontro-top-10-superfas',
    coverImageUrl: 'https://picsum.photos/seed/encontro-superfas/1280/720',
    coverImageAlt:
      'Encontro entre os top 10 superfãs e a artista numa sala VIP',
    excerpt:
      'Os 10 fãs com mais Fanpoints do mês de abril foram pra um encontro fechado com a Ana. Estivemos lá.',
    bodyHtml: `<p class="lede">No dia 5 de abril, dez fãs receberam o convite que esperavam: encontro presencial com a Ana, sala VIP em São Paulo.</p>
<h2>Como funciona o Top 10</h2>
<p>O ranking de superfãs do Fanverse mede Fanpoints acumulados em 30 dias. O Top 10 ganha acesso a eventos exclusivos — esse foi o primeiro.</p>
<h2>O que rolou no encontro</h2>
<p>Bate-papo de uma hora, fotos individuais, autógrafo no álbum físico e — surpresa — preview do single que sai em junho.</p>
<blockquote>Acordei achando que era sonho. Encontrar a Ana cara a cara depois de 3 anos sendo fã foi indescritível. — Júlia, 22 anos</blockquote>
<h3>Próximos encontros</h3>
<p>O próximo encontro acontece em junho, em Brasília. Atualize seus Fanpoints e fique no Top 10 do mês.</p>`,
    authorId: 'aut-marina-vieira',
    authorName: 'Marina Vieira',
    authorAvatarUrl: 'https://i.pravatar.cc/200?img=47',
    authorSlug: 'marina-vieira',
    authorBio:
      'Jornalista de música, cobre o mercado da música pop brasileira há 8 anos. Editora-chefe do blog Fanverse.',
    categoryId: 'cat-comunidade',
    categoryName: 'Comunidade',
    categorySlug: 'comunidade',
    tags: [
      { id: 'tag-superchat', name: 'Superchat', slug: 'superchat' },
      { id: 'tag-fanpoints', name: 'Fanpoints', slug: 'fanpoints' },
    ],
    publishedAt: '2026-04-15T10:30:00.000Z',
    seo: {
      metaTitle: 'O encontro Top 10 superfãs Ana Castela',
      metaDescription:
        'Como foi o evento exclusivo com os superfãs do mês.',
    },
    readingTimeMinutes: 4,
  },
];

/** Toda lista é ordenada por publishedAt desc. */
function sorted(list: BlogPost[]): BlogPost[] {
  return [...list].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}

function toListItem(p: BlogPost): BlogPostListItem {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    slug: p.slug,
    coverImageUrl: p.coverImageUrl,
    coverImageAlt: p.coverImageAlt,
    excerpt: p.excerpt,
    authorName: p.authorName,
    authorAvatarUrl: p.authorAvatarUrl,
    authorSlug: p.authorSlug,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
    publishedAt: p.publishedAt,
    readingTimeMinutes: p.readingTimeMinutes,
    topTags: p.tags.slice(0, 3),
  };
}

/** Todos os posts ordenados por publishedAt desc. */
export function getAllPosts(): BlogPostListItem[] {
  return sorted(POSTS).map(toListItem);
}

/** Post destaque = o mais recente. */
export function getFeaturedPost(): BlogPostListItem | null {
  const list = sorted(POSTS);
  return list[0] ? toListItem(list[0]) : null;
}

/** Posts da "lista" da home — exclui o featured. */
export function getRecentPosts(limit = 6): BlogPostListItem[] {
  const list = sorted(POSTS).slice(1, limit + 1);
  return list.map(toListItem);
}

/** Detalhe completo por slug. */
export function getPostBySlug(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null;
}

/**
 * Posts relacionados — mesma categoria primeiro, depois fallback
 * pra mais recentes. Sempre exclui o próprio post. Limit 3.
 */
export function getRelatedPosts(
  postId: string,
  limit = 3,
): BlogPostListItem[] {
  const current = POSTS.find((p) => p.id === postId);
  if (!current) return [];
  const sameCategory = sorted(POSTS).filter(
    (p) => p.id !== postId && p.categoryId === current.categoryId,
  );
  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit).map(toListItem);
  }
  // Complementa com mais recentes (deduplicado).
  const used = new Set(sameCategory.map((p) => p.id));
  used.add(postId);
  const others = sorted(POSTS).filter((p) => !used.has(p.id));
  return [...sameCategory, ...others].slice(0, limit).map(toListItem);
}

/** Todos os slugs publicados — pra generateStaticParams no detalhe. */
export function getAllPostSlugs(): string[] {
  return POSTS.map((p) => p.slug);
}
