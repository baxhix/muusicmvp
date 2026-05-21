import type { BlogCategory } from '@/types/blog';

/**
 * Categorias do blog — dataset determinístico.
 *
 * O conteúdo é amostra realista do tipo de pauta que o muusic
 * vai cobrir: artistas, eventos, lançamentos. Cobre os dois
 * estados do enum (active/inactive) pra exercitar a UI.
 *
 * Quando o backend cair, troca-se o array por um fetch — o
 * shape do BlogCategory é o mesmo.
 */
export const MOCK_BLOG_CATEGORIES: BlogCategory[] = [
  {
    id: 'cat-shows-eventos',
    name: 'Shows e Eventos',
    slug: 'shows-eventos',
    description:
      'Coberturas de turnês, agenda de festivais e bastidores dos shows da Ana Castela.',
    status: 'active',
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-04-30T14:22:00.000Z',
    postCount: 12,
  },
  {
    id: 'cat-lancamentos',
    name: 'Lançamentos',
    slug: 'lancamentos',
    description: 'Singles, álbuns e EPs novos com análise de produção e letras.',
    status: 'active',
    createdAt: '2026-01-12T09:01:00.000Z',
    updatedAt: '2026-05-10T11:45:00.000Z',
    postCount: 8,
  },
  {
    id: 'cat-bastidores',
    name: 'Bastidores',
    slug: 'bastidores',
    description: 'Como a banda se prepara, escolhas criativas, entrevistas longas.',
    status: 'active',
    createdAt: '2026-01-12T09:02:00.000Z',
    updatedAt: '2026-04-18T10:10:00.000Z',
    postCount: 5,
  },
  {
    id: 'cat-comunidade',
    name: 'Comunidade',
    slug: 'comunidade',
    description: 'Histórias da boiadeira, fãs ao redor do Brasil, cobertura de meetups.',
    status: 'active',
    createdAt: '2026-02-04T16:30:00.000Z',
    updatedAt: '2026-05-02T08:15:00.000Z',
    postCount: 3,
  },
  {
    id: 'cat-cultura-sertaneja',
    name: 'Cultura Sertaneja',
    slug: 'cultura-sertaneja',
    description:
      'Contexto histórico, raízes da boiadeira e a influência do sertanejo na cultura brasileira.',
    status: 'active',
    createdAt: '2026-02-20T11:00:00.000Z',
    updatedAt: '2026-04-12T09:50:00.000Z',
    postCount: 4,
  },
  {
    id: 'cat-tutoriais',
    name: 'Tutoriais',
    slug: 'tutoriais',
    description:
      'Guias pra usar o Fanverse, como ganhar Fanpoints, dicas de Superchat.',
    status: 'inactive',
    createdAt: '2026-03-08T13:20:00.000Z',
    updatedAt: '2026-03-15T15:00:00.000Z',
    postCount: 0,
  },
];

export function loadMockBlogCategories(): BlogCategory[] {
  return [...MOCK_BLOG_CATEGORIES];
}
