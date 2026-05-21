import type { BlogAuthor } from '@/types/blog';

/**
 * Autores do blog — equipe editorial fictícia.
 *
 * 4 perfis cobrindo: editor-chefe, repórter, colaborador externo,
 * autor sem avatar (testa fallback de iniciais).
 */
export const MOCK_BLOG_AUTHORS: BlogAuthor[] = [
  {
    id: 'aut-marina-vieira',
    name: 'Marina Vieira',
    email: 'marina.vieira@muusic.com.br',
    slug: 'marina-vieira',
    avatarUrl: 'https://i.pravatar.cc/200?img=47',
    bio: 'Editora-chefe do blog. Cobre sertanejo e cultura pop há 8 anos, ex-Folha e ex-G1 Música.',
    createdAt: '2026-01-08T10:00:00.000Z',
    updatedAt: '2026-04-22T14:00:00.000Z',
    postCount: 14,
  },
  {
    id: 'aut-rafael-tavares',
    name: 'Rafael Tavares',
    email: 'rafael.tavares@muusic.com.br',
    slug: 'rafael-tavares',
    avatarUrl: 'https://i.pravatar.cc/200?img=12',
    bio: 'Repórter de bastidores. Mora em Goiânia e cobre a cena country-rural do centro-oeste.',
    createdAt: '2026-01-15T11:30:00.000Z',
    updatedAt: '2026-05-01T09:20:00.000Z',
    postCount: 9,
  },
  {
    id: 'aut-clara-mendonca',
    name: 'Clara Mendonça',
    email: 'clara@externa.com',
    slug: 'clara-mendonca',
    avatarUrl: 'https://i.pravatar.cc/200?img=32',
    bio: 'Colaboradora freelancer. Doutoranda em Etnomusicologia (USP), escreve análises culturais profundas.',
    createdAt: '2026-02-10T15:00:00.000Z',
    updatedAt: '2026-04-19T16:45:00.000Z',
    postCount: 5,
  },
  {
    id: 'aut-pedro-monteiro',
    name: 'Pedro Monteiro',
    email: 'pedro.monteiro@muusic.com.br',
    slug: 'pedro-monteiro',
    avatarUrl: null,
    bio: null,
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    postCount: 2,
  },
];

export function loadMockBlogAuthors(): BlogAuthor[] {
  return [...MOCK_BLOG_AUTHORS];
}
