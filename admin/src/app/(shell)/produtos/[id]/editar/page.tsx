'use client';

import { Suspense, use } from 'react';
import ProductEditor from '@/components/produtos/ProductEditor';

/** Página dedicada de edição de produto. Hidrata o form pelo id da rota.
 *  Suspense: ProductEditor usa useSearchParams. */
export default function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <ProductEditor mode="edit" productId={id} />
    </Suspense>
  );
}
