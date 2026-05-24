/**
 * Materiais — cliente HTTP tipado pra falar com o backend
 * (`/api/admin/materiais/*`).
 *
 * Não usa o wrapper genérico `api` de services/api.ts porque
 * uploads precisam de multipart/form-data (sem Content-Type
 * manual; o browser injeta o boundary). Mantemos uma chamada
 * `jsonRequest` interna pra GET/POST/PATCH/DELETE de JSON e
 * uma path específica `uploadMultipart` pra POST de arquivo.
 *
 * Todos os erros do backend (4xx, 5xx) viram MateriaisApiError
 * com status code + error code; a UI pode mapear pra mensagens
 * amigáveis.
 */

import type {
  MaterialNode,
  MaterialAudience,
  MaterialStatus,
} from '@/data/mock/materiais';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export class MateriaisApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`materiais api: ${status} (${code})`);
    this.name = 'MateriaisApiError';
  }
}

interface ApiErrorBody {
  error?: string;
}

interface ListResponse {
  nodes: MaterialNode[];
}
interface NodeResponse {
  node: MaterialNode;
}

async function readErrorCode(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    return data.error ?? `http_${res.status}`;
  } catch {
    return `http_${res.status}`;
  }
}

async function jsonRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new MateriaisApiError(res.status, await readErrorCode(res));
  }
  /* Algumas rotas (delete) podem retornar 204 sem body; trate. */
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ────────────────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────────────────── */

/** Lista a árvore inteira de materiais (folders + files). */
export async function listMateriais(): Promise<MaterialNode[]> {
  const data = await jsonRequest<ListResponse>('GET', '/api/admin/materiais');
  return data.nodes;
}

export interface CreateFolderPayload {
  name: string;
  description?: string;
  parentId: string | null;
}

/** Cria uma pasta dentro de outra (ou no root se parentId=null). */
export async function createFolder(
  input: CreateFolderPayload,
): Promise<MaterialNode> {
  const data = await jsonRequest<NodeResponse>(
    'POST',
    '/api/admin/materiais/folder',
    {
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId,
    },
  );
  return data.node;
}

export interface UploadFilePayload {
  file: File;
  parentId: string;
  name?: string;
  description?: string;
  audience: MaterialAudience;
  thumb?: string;
  publishedToFeed?: boolean;
  /** Callback opcional pra progresso real do upload via XHR
   *  (0–100). Quando ausente, usamos fetch (sem progresso). */
  onProgress?: (percent: number) => void;
  /** AbortSignal pra cancelar o upload (XHR.abort no signal). */
  signal?: AbortSignal;
}

/** Faz upload de um arquivo (multipart). Usa XHR quando há
 *  `onProgress` ou `signal`; senão fetch (mais simples). */
export async function uploadFile(
  input: UploadFilePayload,
): Promise<MaterialNode> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('parentId', input.parentId);
  form.append('audience', input.audience);
  if (input.description) form.append('description', input.description);
  if (input.name) form.append('name', input.name);
  if (input.thumb) form.append('thumb', input.thumb);
  form.append('publishedToFeed', input.publishedToFeed ? '1' : '0');

  /* Fast path: sem progresso/signal → fetch normal. */
  if (!input.onProgress && !input.signal) {
    const res = await fetch(`${BASE_URL}/api/admin/materiais/file`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    if (!res.ok) {
      throw new MateriaisApiError(res.status, await readErrorCode(res));
    }
    const data = (await res.json()) as NodeResponse;
    return data.node;
  }

  /* XHR pra progresso + cancelamento. fetch ainda não suporta
   * `upload.onprogress` (em qualquer browser). XHR continua
   * sendo o padrão pra esse caso de uso. */
  return new Promise<MaterialNode>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/api/admin/materiais/file`, true);
    xhr.withCredentials = true;

    if (input.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          input.onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    if (input.signal) {
      input.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as NodeResponse;
          resolve(data.node);
        } catch {
          reject(new MateriaisApiError(xhr.status, 'parse_error'));
        }
      } else {
        let code = `http_${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText) as ApiErrorBody;
          if (body.error) code = body.error;
        } catch {
          /* response não é JSON — mantém o code default */
        }
        reject(new MateriaisApiError(xhr.status, code));
      }
    };
    xhr.onerror = () => reject(new MateriaisApiError(0, 'network_error'));
    xhr.onabort = () => reject(new MateriaisApiError(0, 'aborted'));

    xhr.send(form);
  });
}

export interface UpdateNodePayload {
  name?: string;
  description?: string | null;
  audience?: MaterialAudience;
  status?: MaterialStatus;
  publishedToFeed?: boolean;
}

/** Atualiza um node (pasta ou arquivo). Subset arbitrário. */
export async function updateNode(
  id: string,
  patch: UpdateNodePayload,
): Promise<MaterialNode> {
  const data = await jsonRequest<NodeResponse>(
    'PATCH',
    `/api/admin/materiais/${id}`,
    patch,
  );
  return data.node;
}

/** Apaga um node — cascade no backend cuida dos descendentes
 *  e dos binários no disco. */
export async function deleteNode(id: string): Promise<void> {
  await jsonRequest<{ ok: true }>('DELETE', `/api/admin/materiais/${id}`);
}

/** URL pra iniciar o download via window.open ou navegação.
 *  O backend cuida do increment de downloads + Content-Disposition. */
export function getDownloadUrl(id: string): string {
  return `${BASE_URL}/api/admin/materiais/${id}/download`;
}

/** Mensagens amigáveis por error code do backend. Default cai
 *  num genérico — quem chama pode logar o code original. */
export function describeError(err: unknown): string {
  if (!(err instanceof MateriaisApiError)) {
    return 'Algo deu errado. Tente novamente.';
  }
  switch (err.code) {
    case 'unauthorized':       return 'Sessão expirada — faça login novamente.';
    case 'forbidden':          return 'Sua conta não tem permissão pra essa ação.';
    case 'no_file':            return 'Nenhum arquivo foi selecionado.';
    case 'too_large':          return 'Arquivo grande demais (máx 50 MB).';
    case 'unsupported_type':   return 'Formato não suportado.';
    case 'missing_name':       return 'Informe um nome.';
    case 'missing_parent':     return 'Pasta de destino não informada.';
    case 'missing_description': return 'A descrição é obrigatória.';
    case 'invalid_json':
    case 'invalid_form':       return 'Os dados enviados estão inválidos.';
    case 'not_found':          return 'Material não encontrado.';
    case 'write_failed':       return 'Falha ao salvar o arquivo no servidor.';
    case 'create_failed':
    case 'update_failed':
    case 'delete_failed':
    case 'list_failed':        return 'O servidor não conseguiu completar a operação.';
    default:                   return 'Algo deu errado. Tente novamente.';
  }
}
