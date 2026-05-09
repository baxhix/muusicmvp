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
import { MOCK_POSTS } from '@/data/mock/posts';
import { MOCK_REPORTS } from '@/data/mock/reports';
import { MOCK_SUPERFANS } from '@/data/mock/superfans';
import { MOCK_ACTIVITY } from '@/data/mock/activity';
import {
  MOCK_KPIS,
  MOCK_GROWTH,
  MOCK_REVENUE,
  POSTS_BY_TYPE,
  PLAN_DISTRIBUTION,
  REPORTS_BY_REASON,
} from '@/data/mock/metrics';
import { MOCK_TEAM } from '@/data/mock/team';
import { MOCK_INTEGRATIONS } from '@/data/mock/integrations';
import { MOCK_API_KEYS } from '@/data/mock/apiKeys';
import {
  MOCK_BILLING_PLAN,
  MOCK_INVOICES,
  MOCK_WORKSPACE,
} from '@/data/mock/billing';

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
  'GET /users':       () => MOCK_USERS,
  'GET /posts':       () => MOCK_POSTS,
  'GET /reports':     () => MOCK_REPORTS,
  'GET /superfans':   () => MOCK_SUPERFANS,
  'GET /activity':    () => MOCK_ACTIVITY,
  'GET /metrics/kpis':         () => MOCK_KPIS,
  'GET /metrics/growth':       () => MOCK_GROWTH,
  'GET /metrics/revenue':      () => MOCK_REVENUE,
  'GET /metrics/posts-by-type': () => POSTS_BY_TYPE,
  'GET /metrics/plan-distribution': () => PLAN_DISTRIBUTION,
  'GET /metrics/reports-by-reason': () => REPORTS_BY_REASON,

  'GET /settings/team':         () => MOCK_TEAM,
  'GET /settings/integrations': () => MOCK_INTEGRATIONS,
  'GET /settings/api-keys':     () => MOCK_API_KEYS,
  'GET /settings/billing/plan': () => MOCK_BILLING_PLAN,
  'GET /settings/billing/invoices': () => MOCK_INVOICES,
  'GET /settings/workspace':    () => MOCK_WORKSPACE,
};

const mockCall: ApiCall<unknown> = async (method, path) => {
  await wait(mockLatencyMs);
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
    throw new Error(`[api] ${method} ${path} → ${res.status}`);
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

export const api: ApiClient = useHttp ? httpDriver : mockDriver;
