'use client';

import PostEditor from '@/components/blog/PostEditor';

/** Página dedicada de criação de post. NÃO é drawer — escrita de
 *  conteúdo longo merece a área inteira do shell admin. Quando
 *  o post é salvo pela primeira vez (rascunho ou direto
 *  publicado), o PostEditor router.push() pra
 *  /blog/posts/[id]/editar pra que o histórico de revisões
 *  continue a partir dali. */
export default function NovoPostPage() {
  return <PostEditor mode="create" />;
}
