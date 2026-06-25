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

export type ProductMediaType = 'image' | 'video';
export interface ProductMedia {
  type: ProductMediaType;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number;
  /** @deprecated subconjunto de imagens — prefira `media`. */
  imageUrls: string[];
  /** Galeria ordenada (imagens + vídeos). Primeiro item = capa. */
  media: ProductMedia[];
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
  media?: ProductMedia[];
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

/** Limites espelhados do backend (src/server/feed/storage.ts). */
export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const PRODUCT_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const PRODUCT_VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/ogg';

async function uploadTo(path: string, file: File): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${base}${path}`, {
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

/** Upload de imagem de produto — reaproveita o endpoint genérico de
 *  upload de imagem do admin (/api/admin/feed/upload). Retorna a URL. */
export const uploadProductImage = (file: File) =>
  uploadTo('/api/admin/feed/upload', file);

/** Upload de vídeo de produto — endpoint dedicado de vídeo do admin
 *  (/api/admin/feed/upload-video, até 100 MB). Retorna a URL. */
export const uploadProductVideo = (file: File) =>
  uploadTo('/api/admin/feed/upload-video', file);

/** Detecta tipo pelo MIME e roteia pro uploader certo, devolvendo a
 *  mídia pronta pra galeria. Lança 'unsupported_type' se não for img/vídeo. */
export async function uploadProductMedia(file: File): Promise<ProductMedia> {
  if (file.type.startsWith('image/')) {
    const url = await uploadProductImage(file);
    return { type: 'image', url };
  }
  if (file.type.startsWith('video/')) {
    const url = await uploadProductVideo(file);
    return { type: 'video', url };
  }
  throw new Error('unsupported_type');
}
