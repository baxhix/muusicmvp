/**
 * blogImagesService — upload de imagens usadas no módulo de Blog
 * (cover destaque, og:image override, imagens dentro do
 * RichTextEditor).
 *
 * Atualmente reaproveita o endpoint `/api/admin/feed/upload` do
 * app principal, que já implementa validação de tipo/tamanho,
 * armazena em `/uploads/feed/<nome>.{ext}` e devolve uma URL
 * pública relativa. Quando o blog ganhar persistência própria,
 * basta apontar pra `/api/admin/blog/upload` (mesmo contrato de
 * multipart) sem mudar nada nos componentes que consomem.
 *
 * Erro retorna `Error(code)` onde code é uma das strings do
 * backend ('too_large', 'unsupported_type', 'write_failed', ...)
 * — os componentes mapeiam pra mensagens humanas.
 */

export interface BlogImageUploadResult {
  url: string;
  filename: string;
}

async function uploadImage(file: File): Promise<BlogImageUploadResult> {
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
  return res.json();
}

export const blogImagesService = {
  upload: uploadImage,
};
