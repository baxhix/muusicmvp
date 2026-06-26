'use client';

import { Suspense } from 'react';
import ProductEditor from '@/components/produtos/ProductEditor';

/** Página dedicada de criação de produto (não modal) — cadastro
 *  completo com upload de imagens/vídeos e reordenação da galeria.
 *  Suspense: ProductEditor usa useSearchParams (?from=<id> p/ copiar). */
export default function NovoProdutoPage() {
  return (
    <Suspense fallback={null}>
      <ProductEditor mode="create" />
    </Suspense>
  );
}
