/**
 * Show communities — comunidades dedicadas a shows agendados da
 * Ana Castela. Per spec "só será criado via admin pela equipe",
 * essas entradas são read-only no client (sem create/edit) e
 * vivem só em memória: a aba "Shows" do CommunityPanel filtra
 * por elas, e os fluxos de detalhe + tópicos consultam esses
 * mocks ao invés do backend quando o slug bate.
 *
 * Quando o admin ganhar um CRUD pra isso (tabela
 * `show_communities` ou flag `kind='show'` em communities),
 * basta substituir os 4 acessores (isShow, getCard, getDetail,
 * getTopics, getComments) por queries no servidor.
 *
 * Imagem: hero padrão do Tour 2026 (Ana com chapéu rosa) +
 * badge "TOUR 2026" renderizado no CommunityPanel via CSS
 * (não embutido na imagem).
 */

import type {
  ApiCommunityCard,
  ApiCommunityDetail,
  ApiCommunityTopic,
  ApiCommunityTopicComment,
} from '@/lib/api/types';

/** Hero image compartilhada entre todas as show communities.
 *  Per spec atualizado: URL anterior (kondzilla CDN) estava
 *  quebrada — substituída pela URL fornecida (gstatic
 *  encrypted-tbn). */
export const SHOW_COMMUNITY_IMAGE =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3k5WLJgLUWWIMBw1KrVppBK_0tXT35MZj8A&s';

/** Marker que o CommunityPanel usa pra renderizar o badge "TOUR 2026"
 *  sobre a thumbnail — checa se o slug pertence ao set de shows. */
const SHOW_SLUGS = new Set<string>([
  'show-americana-2026-06-14',
  'show-arena-nicnet-2026-06-18',
  'show-irece-2026-06-20',
  'show-cruz-das-almas-2026-06-21',
  'show-maceio-2026-06-23',
]);

export function isShowCommunitySlug(slug: string): boolean {
  return SHOW_SLUGS.has(slug);
}

/* ── Cards (lista) ──────────────────────────────────────────── */

/** Avatar genérico do "perfil oficial" da equipe — usado como
 *  criador e como autor dos tópicos. URL externa estável (Ana
 *  Castela no Spotify CDN), com fallback de iniciais via UI. */
const STAFF_AVATAR =
  'https://i.scdn.co/image/ab6761610000e5eb7d3b1f5e1c6c8e4f1b3a8e8f';

const STAFF_PREVIEW = {
  id: 'staff-tour-2026',
  name: 'Equipe Ana Castela',
  avatarUrl: STAFF_AVATAR,
};

/** Datas-base — todas em UTC pra evitar timezone shift no
 *  Date.toISOString(). lastActivityAt fica próximo do "agora"
 *  pra ordenação parecer real. */
const NOW = '2026-06-08T12:00:00.000Z';
const CREATED_AT = '2026-05-15T10:00:00.000Z';

export const SHOW_COMMUNITIES: ApiCommunityCard[] = [
  {
    id: 'show-comm-americana',
    slug: 'show-americana-2026-06-14',
    name: 'Festa do Peão de Americana 16/6',
    description: '14/06: Festa do Peão de Americana – Americana (SP)',
    imageUrl: SHOW_COMMUNITY_IMAGE,
    creatorId: STAFF_PREVIEW.id,
    memberCount: 1842,
    topicCount: 5,
    lastActivityAt: '2026-06-08T11:42:00.000Z',
    createdAt: CREATED_AT,
    isMember: true,
    isTrending: true,
  },
  {
    id: 'show-comm-nicnet',
    slug: 'show-arena-nicnet-2026-06-18',
    name: 'Arena NicNet 18/6',
    description:
      '18/06: Arena NicNet (Aniversário de Ribeirão Preto) – Ribeirão Preto (SP)',
    imageUrl: SHOW_COMMUNITY_IMAGE,
    creatorId: STAFF_PREVIEW.id,
    memberCount: 1207,
    topicCount: 4,
    lastActivityAt: '2026-06-08T10:30:00.000Z',
    createdAt: CREATED_AT,
    isMember: true,
    isTrending: false,
  },
  {
    id: 'show-comm-irece',
    slug: 'show-irece-2026-06-20',
    name: 'Cruz das Almas (BA) 20/6',
    description: '20/06: Irecê (BA)',
    imageUrl: SHOW_COMMUNITY_IMAGE,
    creatorId: STAFF_PREVIEW.id,
    memberCount: 612,
    topicCount: 4,
    lastActivityAt: '2026-06-08T09:15:00.000Z',
    createdAt: CREATED_AT,
    isMember: true,
    isTrending: false,
  },
  {
    id: 'show-comm-cda',
    slug: 'show-cruz-das-almas-2026-06-21',
    name: 'Cruz das Almas (BA) 21/06',
    description: 'Show Ana Castela em Cruz das Almas (BA)',
    imageUrl: SHOW_COMMUNITY_IMAGE,
    creatorId: STAFF_PREVIEW.id,
    memberCount: 488,
    topicCount: 4,
    lastActivityAt: '2026-06-08T08:50:00.000Z',
    createdAt: CREATED_AT,
    isMember: true,
    isTrending: false,
  },
  {
    id: 'show-comm-maceio',
    slug: 'show-maceio-2026-06-23',
    name: '23/06: Maceió (AL)',
    description: 'Show Ana Castela em Maceió (AL)',
    imageUrl: SHOW_COMMUNITY_IMAGE,
    creatorId: STAFF_PREVIEW.id,
    memberCount: 921,
    topicCount: 5,
    lastActivityAt: '2026-06-08T07:10:00.000Z',
    createdAt: CREATED_AT,
    isMember: true,
    isTrending: true,
  },
];

export function getShowCommunityCard(slug: string): ApiCommunityCard | null {
  return SHOW_COMMUNITIES.find((c) => c.slug === slug) ?? null;
}

/* ── Detail (member previews, creator) ──────────────────────── */

/** Avatares de membros pro detail view — reutilizados em todas as
 *  show communities pra economizar mock. Devolvem URLs estáveis
 *  do unsplash, com fallback de iniciais quando a img falha. */
const MEMBER_PREVIEWS = [
  { id: 'm1', name: 'Marina', avatarUrl: 'https://i.pravatar.cc/80?img=44' },
  { id: 'm2', name: 'Lucas', avatarUrl: 'https://i.pravatar.cc/80?img=12' },
  { id: 'm3', name: 'Camila', avatarUrl: 'https://i.pravatar.cc/80?img=32' },
  { id: 'm4', name: 'Rafael', avatarUrl: 'https://i.pravatar.cc/80?img=58' },
  { id: 'm5', name: 'Bia', avatarUrl: 'https://i.pravatar.cc/80?img=23' },
];

export function getShowCommunityDetail(slug: string): ApiCommunityDetail | null {
  const card = getShowCommunityCard(slug);
  if (!card) return null;
  return {
    ...card,
    isCreator: false,
    memberPreviews: MEMBER_PREVIEWS,
    creator: STAFF_PREVIEW,
  };
}

/* ── Topics (per show) ──────────────────────────────────────── */

/** Helper pra evitar repetição de campos default em cada topic. */
function topic(
  args: {
    id: string;
    communityId: string;
    title: string;
    body: string;
    commentCount: number;
    createdAt: string;
    authorName?: string;
  },
): ApiCommunityTopic {
  return {
    id: args.id,
    communityId: args.communityId,
    title: args.title,
    body: args.body,
    authorId: STAFF_PREVIEW.id,
    authorName: args.authorName ?? STAFF_PREVIEW.name,
    authorEmail: null,
    authorAvatar: STAFF_AVATAR,
    commentCount: args.commentCount,
    createdAt: args.createdAt,
    deletedAt: null,
  };
}

const TOPICS_BY_SLUG: Record<string, ApiCommunityTopic[]> = {
  'show-americana-2026-06-14': [
    topic({
      id: 'amer-t1',
      communityId: 'show-comm-americana',
      title: 'Onde comprar ingresso oficial',
      body:
        'Lote 2 disponível pelo site oficial da Festa do Peão. ' +
        'Pista feminina já esgotou — restam camarote e arena.',
      commentCount: 28,
      createdAt: '2026-05-20T14:00:00.000Z',
    }),
    topic({
      id: 'amer-t2',
      communityId: 'show-comm-americana',
      title: 'Encontro de fãs 1h antes do show',
      body:
        'Vamos nos encontrar na entrada principal às 21h. ' +
        'Levem o chapéu rosa! Quem confirma?',
      commentCount: 64,
      createdAt: '2026-05-22T18:30:00.000Z',
      authorName: 'Marina',
    }),
    topic({
      id: 'amer-t3',
      communityId: 'show-comm-americana',
      title: 'Carona/transporte de São Paulo',
      body:
        'Saindo de SP capital sexta à tarde, vans organizadas pelo ' +
        'time. Inscrições no formulário fixado.',
      commentCount: 19,
      createdAt: '2026-05-25T10:00:00.000Z',
    }),
    topic({
      id: 'amer-t4',
      communityId: 'show-comm-americana',
      title: 'Setlist apostado',
      body: 'Qual música vocês querem ouvir ao vivo? Apostem nos comentários.',
      commentCount: 41,
      createdAt: '2026-06-01T09:00:00.000Z',
      authorName: 'Lucas',
    }),
    topic({
      id: 'amer-t5',
      communityId: 'show-comm-americana',
      title: 'Look com chapéu — montem um esquadrão',
      body:
        'Compilando fotos do esquadrão rosa do ano passado. Subam as ' +
        'suas pra inspirar a galera nova.',
      commentCount: 12,
      createdAt: '2026-06-05T20:00:00.000Z',
      authorName: 'Bia',
    }),
  ],
  'show-arena-nicnet-2026-06-18': [
    topic({
      id: 'nic-t1',
      communityId: 'show-comm-nicnet',
      title: 'Ingressos restantes',
      body:
        'Última leva de pista premium liberada no site da Arena. ' +
        'Camarote já esgotou — fiquem espertos.',
      commentCount: 33,
      createdAt: '2026-05-21T11:00:00.000Z',
    }),
    topic({
      id: 'nic-t2',
      communityId: 'show-comm-nicnet',
      title: 'Encontro 2h antes na fila',
      body:
        'A galera de Ribeirão tá organizando ponto de encontro na ' +
        'frente da Arena às 18h. Apareçam!',
      commentCount: 47,
      createdAt: '2026-05-26T16:00:00.000Z',
      authorName: 'Camila',
    }),
    topic({
      id: 'nic-t3',
      communityId: 'show-comm-nicnet',
      title: 'Hospedagem em RP — dividir quarto',
      body:
        'Quem tá indo de fora? Tem uma galera dividindo Airbnb perto da ' +
        'Arena. Preço fica em torno de R$ 90 a noite.',
      commentCount: 22,
      createdAt: '2026-05-30T09:30:00.000Z',
    }),
    topic({
      id: 'nic-t4',
      communityId: 'show-comm-nicnet',
      title: 'Aniversário de Ribeirão — programação completa',
      body:
        'Além da Ana, tem mais atrações ao longo da semana. Confiram ' +
        'a programação oficial no link fixado.',
      commentCount: 8,
      createdAt: '2026-06-02T12:00:00.000Z',
    }),
  ],
  'show-irece-2026-06-20': [
    topic({
      id: 'ire-t1',
      communityId: 'show-comm-irece',
      title: 'Quem vai de Irecê?',
      body:
        'Galera da cidade, comentem aqui! Vamos fazer um grupo pra ' +
        'combinar transporte e encontros pré-show.',
      commentCount: 36,
      createdAt: '2026-05-23T10:00:00.000Z',
      authorName: 'Rafael',
    }),
    topic({
      id: 'ire-t2',
      communityId: 'show-comm-irece',
      title: 'Pista vs camarote — qual compensa?',
      body:
        'Tô na dúvida. Quem já foi em show da Ana, vale a pena pagar ' +
        'a mais pelo camarote?',
      commentCount: 18,
      createdAt: '2026-05-27T19:00:00.000Z',
    }),
    topic({
      id: 'ire-t3',
      communityId: 'show-comm-irece',
      title: 'Caravana saindo de Salvador',
      body:
        'Ônibus fretado de Salvador, R$ 180 ida e volta, com parada ' +
        'em Feira. Vagas limitadas.',
      commentCount: 27,
      createdAt: '2026-06-01T14:00:00.000Z',
    }),
    topic({
      id: 'ire-t4',
      communityId: 'show-comm-irece',
      title: 'Encontro de fãs no centro antes do show',
      body:
        'Vamos nos juntar na praça central às 17h pra tirar fotos e ' +
        'já entrar todo mundo junto.',
      commentCount: 14,
      createdAt: '2026-06-04T11:30:00.000Z',
      authorName: 'Marina',
    }),
  ],
  'show-cruz-das-almas-2026-06-21': [
    topic({
      id: 'cda-t1',
      communityId: 'show-comm-cda',
      title: 'Fila desde quando?',
      body:
        'Quem tá pretendendo ir cedo? Tô pensando em chegar 14h pra ' +
        'pegar lugar bom na grade.',
      commentCount: 24,
      createdAt: '2026-05-24T15:00:00.000Z',
    }),
    topic({
      id: 'cda-t2',
      communityId: 'show-comm-cda',
      title: 'Bate-papo pré-show',
      body:
        'Quero conhecer a galera daqui! Quem vai? Apareçam pra ' +
        'combinarmos um café antes.',
      commentCount: 39,
      createdAt: '2026-05-28T13:00:00.000Z',
      authorName: 'Bia',
    }),
    topic({
      id: 'cda-t3',
      communityId: 'show-comm-cda',
      title: 'Vendo ingresso pista',
      body:
        'Comprei 2 e meu amigo não vai poder ir. Vendo 1 pelo valor ' +
        'de face. Manda DM.',
      commentCount: 11,
      createdAt: '2026-06-02T17:00:00.000Z',
    }),
    topic({
      id: 'cda-t4',
      communityId: 'show-comm-cda',
      title: 'Estacionamento perto do local',
      body:
        'Alguém sabe se tem estacionamento oficial ou se vamos ter ' +
        'que deixar nas ruas próximas?',
      commentCount: 9,
      createdAt: '2026-06-06T08:00:00.000Z',
    }),
  ],
  'show-maceio-2026-06-23': [
    topic({
      id: 'mac-t1',
      communityId: 'show-comm-maceio',
      title: 'Praia + show no mesmo dia',
      body:
        'Plano perfeito: Pajuçara de manhã, almoço na orla, e show à ' +
        'noite. Quem topa montar esse roteiro?',
      commentCount: 52,
      createdAt: '2026-05-25T11:00:00.000Z',
      authorName: 'Camila',
    }),
    topic({
      id: 'mac-t2',
      communityId: 'show-comm-maceio',
      title: 'Encontro na Pajuçara antes do show',
      body:
        'Vamos nos juntar no quiosque do Sete Coqueiros às 15h. ' +
        'Levem o look pra tirar foto na praia!',
      commentCount: 43,
      createdAt: '2026-05-29T16:00:00.000Z',
    }),
    topic({
      id: 'mac-t3',
      communityId: 'show-comm-maceio',
      title: 'Ingressos restantes — onde achar',
      body:
        'Pista comum ainda tem no site oficial. VIP esgotou semana ' +
        'passada — fiquem ligados em revenda só oficial.',
      commentCount: 17,
      createdAt: '2026-06-01T10:30:00.000Z',
    }),
    topic({
      id: 'mac-t4',
      communityId: 'show-comm-maceio',
      title: 'Hospedagem em Maceió — dicas',
      body:
        'Qual região vocês recomendam? Ponta Verde, Jatiúca, ou perto ' +
        'do local do show?',
      commentCount: 21,
      createdAt: '2026-06-04T14:00:00.000Z',
      authorName: 'Lucas',
    }),
    topic({
      id: 'mac-t5',
      communityId: 'show-comm-maceio',
      title: 'Look praia + show',
      body:
        'Compartilhem suas inspirações de look que funcione na praia ' +
        'de dia e no show de noite!',
      commentCount: 15,
      createdAt: '2026-06-06T19:00:00.000Z',
      authorName: 'Bia',
    }),
  ],
};

export function getShowCommunityTopics(slug: string): ApiCommunityTopic[] {
  return TOPICS_BY_SLUG[slug] ?? [];
}

export function getShowCommunityTopic(
  slug: string,
  topicId: string,
): ApiCommunityTopic | null {
  return (TOPICS_BY_SLUG[slug] ?? []).find((t) => t.id === topicId) ?? null;
}

/* ── Comments (per topic) ───────────────────────────────────── */

/** Mock light: cada tópico de show recebe os mesmos 3 comentários
 *  representativos. Isso mantém o file size sob controle sem
 *  comprometer a sensação de "comunidade ativa". Quando o admin
 *  CRUD existir, vira fetch real. */
function buildComments(topicId: string): ApiCommunityTopicComment[] {
  return [
    {
      id: `${topicId}-c1`,
      topicId,
      parentCommentId: null,
      body: 'Confirmado! Conta comigo aí.',
      createdAt: '2026-06-07T18:00:00.000Z',
      deletedAt: null,
      author: {
        id: 'm1',
        name: 'Marina',
        email: null,
        avatarUrl: 'https://i.pravatar.cc/80?img=44',
      },
      reactions: { count: 7, mine: false },
      replyCount: 1,
    },
    {
      id: `${topicId}-c2`,
      topicId,
      parentCommentId: null,
      body: 'Vou tentar ir! Posto aqui quando confirmar 🎤',
      createdAt: '2026-06-07T20:30:00.000Z',
      deletedAt: null,
      author: {
        id: 'm3',
        name: 'Camila',
        email: null,
        avatarUrl: 'https://i.pravatar.cc/80?img=32',
      },
      reactions: { count: 12, mine: false },
      replyCount: 0,
    },
    {
      id: `${topicId}-c1-r1`,
      topicId,
      parentCommentId: `${topicId}-c1`,
      body: 'Bora!! Mal posso esperar 💖',
      createdAt: '2026-06-07T19:15:00.000Z',
      deletedAt: null,
      author: {
        id: 'm5',
        name: 'Bia',
        email: null,
        avatarUrl: 'https://i.pravatar.cc/80?img=23',
      },
      reactions: { count: 4, mine: false },
      replyCount: null,
    },
  ];
}

export function getShowTopicComments(
  topicId: string,
): ApiCommunityTopicComment[] {
  return buildComments(topicId);
}
