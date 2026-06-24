import { api } from './api';

/**
 * Produtos da Loja Fanverse — CRUD sobre /api/admin/produtos/*.
 * Preços em Fanpoints. `audience` define quem pode comprar.
 */

export type ProductAudience = 'top1' | 'top10' | 'top50' | 'top100' | 'all';

export const PRODUCT_AUDIENCE_OPTIONS: { value: ProductAudience; label: string }[] = [
  { value: 'all', label: 'Todos os usuários' },
  { value: 'top100', label: 'Top 100 fãs' },
  { value: 'top50', label: 'Top 50 fãs' },
  { value: 'top10', label: 'Top 10 fãs' },
  { value: 'top1', label: 'Top 1 fã' },
];

export const PRODUCT_AUDIENCE_LABEL: Record<ProductAudience, string> =
  Object.fromEntries(
    PRODUCT_AUDIENCE_OPTIONS.map((o) => [o.value, o.label]),
  ) as Record<ProductAudience, string>;

export interface Product {
  id: string;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number;
  imageUrls: string[];
  audience: ProductAudience;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  priceFrom?: number | null;
  priceTo: number;
  imageUrls?: string[];
  audience?: ProductAudience;
  active?: boolean;
  sortOrder?: number;
}

export const productService = {
  list: () => api.get<{ items: Product[] }>('/api/admin/produtos'),
  create: (input: ProductInput) =>
    api.post<{ product: Product }>('/api/admin/produtos', input),
  update: (id: string, input: Partial<ProductInput>) =>
    api.patch<{ product: Product }>(`/api/admin/produtos/${id}`, input),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/admin/produtos/${id}`),
};

/** Upload de imagem de produto — reaproveita o endpoint genérico de
 *  upload de imagem do admin (/api/admin/feed/upload). Retorna a URL. */
export async function uploadProductImage(file: File): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${base}/api/admin/feed/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  if (!res.ok) {
    let code = 'upload_failed';
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') code = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(code);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
