/**
 * k6 smoke test — muusic.live (produção)
 *
 * Perfil: 5 VUs por 1 minuto. Objetivo é validar que cada
 * superfície pública responde sem erro e medir latência base.
 * NÃO é um stress test — quer só checar "está up + saudável".
 *
 * Cenários (rodam em paralelo no mesmo run, cada um com 5 VUs):
 *   1. landing  — GET nas páginas /, /teste, /blog
 *   2. api      — GET nos endpoints públicos de health/feed/etc.
 *   3. auth     — POST /api/auth/request com email throwaway
 *                 (gera magic link mas não verifica — só mede o
 *                 endpoint sob carga).
 *   4. socket   — handshake HTTP do socket.io polling endpoint
 *                 (verifica que o realtime server está alive).
 *
 * Como rodar:
 *   k6 run scripts/k6/smoke.js
 *
 * Override URL:
 *   k6 run -e BASE_URL=https://staging.muusic.live scripts/k6/smoke.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://muusic.live';

/* `expectedStatuses` ensina o k6 a NÃO contar respostas
 *  esperadas como falha. Sem isso o `http_req_failed` infla
 *  com 401s/404s que são comportamento correto pra anônimo.
 *  Cada request pode passar este callback via `responseCallback`. */
const expectOK = http.expectedStatuses(200);
const expectOKor401 = http.expectedStatuses(200, 401);

/* Métricas customizadas — uma rate por cenário pra ver no
 *  summary qual surface está mais flaky. */
const errLanding = new Rate('errors_landing');
const errApi = new Rate('errors_api');
const errAuth = new Rate('errors_auth');
const errSocket = new Rate('errors_socket');
const ttfbLanding = new Trend('ttfb_landing', true);

export const options = {
  scenarios: {
    landing: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'landing',
      tags: { scenario: 'landing' },
    },
    api: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'api',
      tags: { scenario: 'api' },
    },
    auth: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'auth',
      tags: { scenario: 'auth' },
    },
    socket: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'socket',
      tags: { scenario: 'socket' },
    },
  },
  thresholds: {
    /* Smoke = expectativa de saúde, não de performance.
     *  Cada cenário tem seu Rate customizado (errors_<x>) que
     *  conta SÓ falhas reais (5xx ou status fora do esperado).
     *  Falha > 5% em qualquer um aborta o run. p95 < 2s é
     *  generoso pra SSR + cold cache no Hostinger.
     *
     *  Removido `http_req_failed` global porque k6 conta 401
     *  como failed mesmo com expectedStatuses() bem setado
     *  (esse helper só silencia warnings, não muda o flag). */
    'http_req_duration{scenario:landing}': ['p(95)<2000'],
    'http_req_duration{scenario:api}': ['p(95)<1500'],
    'http_req_duration{scenario:auth}': ['p(95)<2500'],
    'errors_landing': ['rate<0.05'],
    'errors_api': ['rate<0.05'],
    'errors_auth': ['rate<0.05'],
    'errors_socket': ['rate<0.05'],
  },
};

/* Headers default — User-Agent dedicado pra filtrar em logs/
 *  analytics e não poluir métricas reais de usuário. */
const defaultHeaders = {
  'User-Agent': 'muusic-k6-smoke/1.0 (+load-test)',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

/* ─── 1. Landing pages ──────────────────────────────────────
 *  Bate em / (mapa app), /teste (landing experimental) e
 *  /blog. Todas são SSR; 200 esperado. */
export function landing() {
  const pages = ['/', '/teste', '/blog'];
  group('landing', () => {
    for (const path of pages) {
      const r = http.get(`${BASE_URL}${path}`, {
        headers: defaultHeaders,
        tags: { name: `GET ${path}` },
      });
      const ok = check(r, {
        [`${path} status 200`]: (res) => res.status === 200,
        [`${path} body html`]: (res) =>
          typeof res.body === 'string' && res.body.indexOf('<html') !== -1,
      });
      errLanding.add(!ok);
      ttfbLanding.add(r.timings.waiting);
    }
  });
  sleep(1);
}

/* ─── 2. API endpoints públicos ─────────────────────────────
 *  Endpoints validados ao vivo via curl antes do smoke:
 *   - /api/health          → 200 público
 *   - /api/communities     → 200 público
 *   - /api/legal/site/...  → 200 público (path é /[surface]/[kind])
 *   - /api/feed/posts      → 401 anônimo (esperado)
 *
 *  Cada endpoint declara seu(s) status aceitos. 5xx sempre
 *  conta como erro. */
export function api() {
  group('api', () => {
    const endpoints = [
      { path: '/api/health', expectedStatus: [200], responseCallback: expectOK },
      { path: '/api/communities', expectedStatus: [200], responseCallback: expectOK },
      { path: '/api/legal/site/terms_of_use', expectedStatus: [200], responseCallback: expectOK },
      { path: '/api/legal/site/privacy_policy', expectedStatus: [200], responseCallback: expectOK },
      /* Endpoint protegido — anônimo recebe 401. Tagged como
       *  expected pra não inflar http_req_failed. */
      { path: '/api/feed/posts', expectedStatus: [200, 401], responseCallback: expectOKor401 },
    ];
    for (const { path, expectedStatus, responseCallback } of endpoints) {
      const r = http.get(`${BASE_URL}${path}`, {
        headers: defaultHeaders,
        tags: { name: `GET ${path}` },
        responseCallback,
      });
      const ok = check(r, {
        [`${path} status ok`]: (res) => expectedStatus.indexOf(res.status) !== -1,
        [`${path} no 5xx`]: (res) => res.status < 500,
      });
      errApi.add(!ok);
    }
  });
  sleep(1);
}

/* ─── 3. Auth flow — magic link request ─────────────────────
 *  Submete email throwaway pro /api/auth/request. NÃO verifica
 *  link (precisa de Maildrop / mailbox real). 200 == endpoint
 *  aceitou o pedido e enfileirou o email.
 *
 *  Usa Date.now() pra cada VU gerar um email único e evitar
 *  rate-limit por email repetido. */
export function auth() {
  group('auth', () => {
    const email = `k6-smoke-${__VU}-${Date.now()}@muusic-test.local`;
    const r = http.post(
      `${BASE_URL}/api/auth/request`,
      JSON.stringify({ email }),
      {
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        tags: { name: 'POST /api/auth/request' },
        /* 200=ok, 202=enfileirado, 429=rate-limit (esperado
         *  quando smoke spamma o mesmo IP). Todos consideram
         *  o endpoint saudável. */
        responseCallback: http.expectedStatuses(200, 202, 429),
      }
    );
    const ok = check(r, {
      'auth request status ok': (res) => [200, 202, 429].indexOf(res.status) !== -1,
      'auth request no 5xx': (res) => res.status < 500,
    });
    errAuth.add(!ok);
  });
  sleep(2);
}

/* ─── 4. Socket.io handshake ───────────────────────────────
 *  Não é um WebSocket real (k6 stdlib ws não fala socket.io),
 *  mas o socket.io engine tem um endpoint HTTP polling no
 *  /socket.io/?EIO=4&transport=polling — bater nele valida que
 *  o servidor realtime está alive. */
export function socket() {
  group('socket', () => {
    const url = `${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
    const r = http.get(url, {
      headers: defaultHeaders,
      tags: { name: 'socket.io handshake' },
    });
    const ok = check(r, {
      'socket handshake status 200': (res) => res.status === 200,
      'socket handshake body has sid': (res) =>
        typeof res.body === 'string' && res.body.indexOf('"sid"') !== -1,
    });
    errSocket.add(!ok);
  });
  sleep(2);
}
