'use client';

import { use } from 'react';
import ProductEditor from '@/components/produtos/ProductEditor';

/** Página dedicada de edição de produto. Hidrata o form pelo id da rota. */
export default function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProductEditor mode="edit" productId={id} />;
}
