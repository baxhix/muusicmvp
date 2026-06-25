/* ============================================================
   API LAYER — single point of swap from mocks to a real backend.

   Today: every service module reads from `MOCK_DRIVER`.
   Tomorrow: set NEXT_PUBLIC_API_BASE_URL and switch DRIVER to
   `httpDriver`. Service modules (services/users.ts, etc.) do
   not care which driver is in use — they only call:

     await api.get<User[]>('/users')
     await api.post<User>('/users', body)
     ...

   ── How to integrate the real API later ──────────────────────
   1. Set process.env.NEXT_PUBLIC_API_BASE_URL.
   2. Set process.env.NEXT_PUBLIC_API_DRIVER=http (or rely on
      the auto-detection below).
   3. Implement any auth header injection inside `httpDriver`.
   4. Each `mockDriver` route is a TODO: replace its branch with
      a real HTTP call OR delete the mock branch entirely.
   ============================================================ */

import { MOCK_USERS } from '@/data/mock/users';
import { MOCK_REPORTS } from '@/data/mock/reports';
import { MOCK_SUPERFANS } from '@/data/mock/superfans';
import {
  MOCK_KPIS,
  MOCK_GROWTH,
  MOCK_REVENUE,
  POSTS_BY_TYPE,
  PLAN_DISTRIBUTION,
  REPORTS_BY_REASON,
} from '@/data/mock/metrics';
import { MOCK_TEAM } from '@/data/mock/team';
import { MOCK_WORKSPACE } from '@/data/mock/billing';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type ApiCall<T> = (method: Method, path: string, body?: unknown) => Promise<T>;

interface ApiClient {
  get:    <T>(path: string) => Promise<T>;
  post:   <T>(path: string, body?: unknown) => Promise<T>;
  patch:  <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}

/* ── Mock driver ─────────────────────────────────────────── */

const mockLatencyMs = 150;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Each route in here is a "fake endpoint". When swapping to HTTP,
 * it's safe to delete this whole map — the same paths will be
 * served by the backend.
 */
const mockRoutes: Record<string, () => unknown> = {
  // Real backend path — mocked here também pra que designers rodando o
  // admin standalone (sem APP_URL set) ainda vejam tabela populada.
  'GET /api/admin/users': () => MOCK_USERS,
  'GET /users':       () => MOCK_USERS,
  'GET /reports':     () => MOCK_REPORTS,
  'GET /superfans':   () => MOCK_SUPERFANS,
  'GET /metrics/kpis':              () => MOCK_KPIS,
  'GET /metrics/growth':            () => MOCK_GROWTH,
  'GET /metrics/revenue':           () => MOCK_REVENUE,
  'GET /metrics/posts-by-type':     () => POSTS_BY_TYPE,
  'GET /metrics/plan-distribution': () => PLAN_DISTRIBUTION,
  'GET /metrics/reports-by-reason': () => REPORTS_BY_REASON,
  'GET /settings/team':             () => MOCK_TEAM,
  'GET /settings/workspace':        () => MOCK_WORKSPACE,
};

/* ── Produtos: mock store em memória ─────────────────────────
 * O CRUD real de produtos vive em /api/admin/produtos/* no backend.
 * Quando o admin roda standalone (sem BASE_URL), este store em memória
 * mantém a tela viva — cria/edita/reordena/apaga durante a sessão SPA
 * (reseta no reload). Some quando o httpDriver assume. */
interface MockProductMedia {
  type: 'image' | 'video';
  url: string;
}
interface MockProduct {
  id: string;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number;
  imageUrls: string[];
  media: MockProductMedia[];
  audience: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function makeMockProduct(seed: Partial<MockProduct>): MockProduct {
  const media = seed.media ?? [];
  const now = new Date().toISOString();
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now()}`) as string,
    name: seed.name ?? 'Produto',
    description: seed.description ?? null,
    priceFrom: seed.priceFrom ?? null,
    priceTo: seed.priceTo ?? 0,
    media,
    imageUrls: media.filter((m) => m.type === 'image').map((m) => m.url),
    audience: seed.audience ?? 'all',
    active: seed.active ?? true,
    sortOrder: seed.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

const mockProducts: MockProduct[] = [
  makeMockProduct({
    name: 'Chapéu Ana Castela — Couro Preto',
    description: 'Chapéu de couro legítimo autografado, edição limitada.',
    priceFrom: 12000,
    priceTo: 9000,
    audience: 'top100',
    media: [
      { type: 'image', url: 'https://picsum.photos/seed/chapeu1/640/640' },
      { type: 'image', url: 'https://picsum.photos/seed/chapeu2/640/640' },
    ],
  }),
  makeMockProduct({
    name: 'Camiseta Boiadeira',
    description: 'Camiseta oficial da turnê.',
    priceTo: 4500,
    audience: 'all',
    media: [{ type: 'image', url: 'https://picsum.photos/seed/camiseta/640/640' }],
  }),
];

function mockProductsRoute(
  method: Method,
  path: string,
  body?: unknown,
): unknown | undefined {
  if (path === '/api/admin/produtos') {
    if (method === 'GET') return { items: mockProducts };
    if (method === 'POST') {
      const p = makeMockProduct((body ?? {}) as Partial<MockProduct>);
      mockProducts.unshift(p);
      return { product: p };
    }
  }
  const m = path.match(/^\/api\/admin\/produtos\/([^/]+)$/);
  if (m) {
    const id = m[1];
    const idx = mockProducts.findIndex((p) => p.id === id);
    if (method === 'PATCH') {
      if (idx < 0) return { error: 'not_found' };
      const patch = (body ?? {}) as Partial<MockProduct>;
      const merged = { ...mockProducts[idx], ...patch, updatedAt: new Date().toISOString() };
      if (patch.media) merged.imageUrls = patch.media.filter((x) => x.type === 'image').map((x) => x.url);
      mockProducts[idx] = merged;
      return { product: merged };
    }
    if (method === 'DELETE') {
      if (idx >= 0) mockProducts.splice(idx, 1);
      return { ok: true };
    }
  }
  return undefined;
}

const mockCall: ApiCall<unknown> = async (method, path, body) => {
  await wait(mockLatencyMs);
  // Produtos têm store mutável próprio (CRUD), checado antes do mapa estático.
  const produtos = mockProductsRoute(method, path, body);
  if (produtos !== undefined) {
    return JSON.parse(JSON.stringify(produtos));
  }
  const handler = mockRoutes[`${method} ${path}`];
  if (!handler) {
    throw new Error(`[mock-api] no handler for ${method} ${path}`);
  }
  // Return a deep clone so consumers can't mutate the mock store
  return JSON.parse(JSON.stringify(handler()));
};

const mockDriver: ApiClient = {
  get:    <T,>(path: string) => mockCall('GET',    path) as Promise<T>,
  post:   <T,>(path: string, body?: unknown) => mockCall('POST',   path, body) as Promise<T>,
  patch:  <T,>(path: string, body?: unknown) => mockCall('PATCH',  path, body) as Promise<T>,
  delete: <T,>(path: string) => mockCall('DELETE', path) as Promise<T>,
};

/* ── HTTP driver (placeholder) ──────────────────────────── */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function httpCall<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // TODO: inject auth token here when wiring auth
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    /* Extrai o code de erro do JSON body quando o servidor manda
     * `{ error: 'some_code' }` — esse padrão é seguido por todos
     * os endpoints de `/api/admin/*`. Permite que os toasts dos
     * formulários (FeedComposerDrawer.humanError etc) mostrem
     * mensagens específicas em vez do fallback genérico
     * "Tente novamente em instantes".
     *
     * Fallback pra string sintética `[api] METHOD path → status`
     * quando o body não é JSON OU não tem `error`. */
    let code: string | null = null;
    try {
      const data = (await res.json()) as { error?: string } | null;
      if (data && typeof data.error === 'string' && data.error.length > 0) {
        code = data.error;
      }
    } catch {
      /* body não é JSON — usa fallback abaixo */
    }
    throw new Error(code ?? `[api] ${method} ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

const httpDriver: ApiClient = {
  get:    <T,>(path: string) => httpCall<T>('GET', path),
  post:   <T,>(path: string, body?: unknown) => httpCall<T>('POST', path, body),
  patch:  <T,>(path: string, body?: unknown) => httpCall<T>('PATCH', path, body),
  delete: <T,>(path: string) => httpCall<T>('DELETE', path),
};

/* ── Driver selection ────────────────────────────────────── */

const driverEnv = process.env.NEXT_PUBLIC_API_DRIVER;
const useHttp = driverEnv === 'http' || (driverEnv == null && BASE_URL !== '');

/**
 * Per-path driver pick. Live paths under /api/admin/* go to the real
 * muusic backend (httpDriver); legacy paths used by services we
 * haven't migrated yet (settings/team/reports/etc) stay on mockDriver
 * so the screens keep rendering instead of 404'ing the moment
 * BASE_URL is set.
 *
 * Migration target: as each service grows a real /api/admin/* endpoint,
 * its path naturally graduates to httpDriver — no code change here.
 */
function pickDriver(path: string): ApiClient {
  if (!useHttp) return mockDriver;
  return path.startsWith('/api/admin/') ? httpDriver : mockDriver;
}

export const api: ApiClient = {
  get:    <T,>(path: string) => pickDriver(path).get<T>(path),
  post:   <T,>(path: string, body?: unknown) => pickDriver(path).post<T>(path, body),
  patch:  <T,>(path: string, body?: unknown) => pickDriver(path).patch<T>(path, body),
  delete: <T,>(path: string) => pickDriver(path).delete<T>(path),
};
