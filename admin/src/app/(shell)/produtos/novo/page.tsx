'use client';

import ProductEditor from '@/components/produtos/ProductEditor';

/** Página dedicada de criação de produto (não modal) — cadastro
 *  completo com upload de imagens/vídeos e reordenação da galeria. */
export default function NovoProdutoPage() {
  return <ProductEditor mode="create" />;
}
