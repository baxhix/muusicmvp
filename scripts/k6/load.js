/**
 * k6 load test — muusic.live
 *
 * Perfil: 50 VUs totais ramping em 5 minutos. Distribuídos:
 *   - landing: 15 VUs (maior parte do tráfego web)
 *   - api:     15 VUs (endpoints públicos)
 *   - auth:    10 VUs (signup/login flow)
 *   - socket:  10 VUs (handshake do realtime)
 *
 * Ramping: 0 → target (30s), hold (4m), → 0 (30s).
 *
 * Como rodar:
 *   k6 run scripts/k6/load.js
 *
 * Override URL:
 *   k6 run -e BASE_URL=https://staging.muusic.live scripts/k6/load.js
 *
 * Reuso da lógica do smoke.js — só o cenário (VUs/duração)
 * e thresholds são diferentes. */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://muusic.live';

const expectOK = http.expectedStatuses(200);
const expectOKor401 = http.expectedStatuses(200, 401);

const errLanding = new Rate('errors_landing');
const errApi = new Rate('errors_api');
const errAuth = new Rate('errors_auth');
const errSocket = new Rate('errors_socket');
const ttfbLanding = new Trend('ttfb_landing', true);

/* Ramping stages compartilhado por todos os cenários. Cada
 *  scenario aplica este shape escalonado ao seu próprio target
 *  de VUs (gracefulRampDown evita finalizar iteração no meio). */
function ramp(target) {
  return [
    { duration: '30s', target },     // ramp-up
    { duration: '4m',  target },     // sustain
    { duration: '30s', target: 0 },  // ramp-down
  ];
}

export const options = {
  scenarios: {
    landing: {
      executor: 'ramping-vus',
      stages: ramp(15),
      gracefulRampDown: '15s',
      exec: 'landing',
      tags: { scenario: 'landing' },
    },
    api: {
      executor: 'ramping-vus',
      stages: ramp(15),
      gracefulRampDown: '15s',
      exec: 'api',
      tags: { scenario: 'api' },
    },
    auth: {
      executor: 'ramping-vus',
      stages: ramp(10),
      gracefulRampDown: '15s',
      exec: 'auth',
      tags: { scenario: 'auth' },
    },
    socket: {
      executor: 'ramping-vus',
      stages: ramp(10),
      gracefulRampDown: '15s',
      exec: 'socket',
      tags: { scenario: 'socket' },
    },
  },
  thresholds: {
    /* Limites mais frouxos que smoke porque concurrent load
     *  vai esticar p95. Ainda assim, tudo > 3s em landing ou
     *  > 2s em api é red flag pra Hostinger SSH SSR. */
    'http_req_duration{scenario:landing}': ['p(95)<3000', 'p(99)<5000'],
    'http_req_duration{scenario:api}':     ['p(95)<2000', 'p(99)<4000'],
    'http_req_duration{scenario:auth}':    ['p(95)<3500', 'p(99)<6000'],
    'errors_landing': ['rate<0.02'],
    'errors_api':     ['rate<0.02'],
    'errors_auth':    ['rate<0.02'],
    'errors_socket':  ['rate<0.02'],
  },
};

const defaultHeaders = {
  'User-Agent': 'muusic-k6-load/1.0 (+load-test)',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

/* ─── 1. Landing pages ────────────────────────────────────── */
export function landing() {
  const pages = ['/', '/teste', '/blog'];
  group('landing', () => {
    for (const path of pages) {
      const r = http.get(`${BASE_URL}${path}`, {
        headers: defaultHeaders,
        tags: { name: `GET ${path}` },
        responseCallback: expectOK,
      });
      const ok = check(r, {
        [`${path} status 200`]: (res) => res.status === 200,
        [`${path} body html`]: (res) =>
          typeof res.body === 'string' && res.body.indexOf('<html') !== -1,
        [`${path} no 5xx`]: (res) => res.status < 500,
      });
      errLanding.add(!ok);
      ttfbLanding.add(r.timings.waiting);
    }
  });
  /* Sleep ligeiramente randomizado pra evitar sincronização
   *  thunderning-herd em cada iteração — mantém o RPS suave. */
  sleep(1 + Math.random() * 0.5);
}

/* ─── 2. API endpoints públicos ──────────────────────────── */
export function api() {
  group('api', () => {
    const endpoints = [
      { path: '/api/health',                       expected: [200], cb: expectOK },
      { path: '/api/communities',                  expected: [200], cb: expectOK },
      { path: '/api/legal/site/terms_of_use',      expected: [200], cb: expectOK },
      { path: '/api/legal/site/privacy_policy',    expected: [200], cb: expectOK },
      { path: '/api/feed/posts',                   expected: [200, 401], cb: expectOKor401 },
    ];
    for (const ep of endpoints) {
      const r = http.get(`${BASE_URL}${ep.path}`, {
        headers: defaultHeaders,
        tags: { name: `GET ${ep.path}` },
        responseCallback: ep.cb,
      });
      const ok = check(r, {
        [`${ep.path} status ok`]: (res) => ep.expected.indexOf(res.status) !== -1,
        [`${ep.path} no 5xx`]: (res) => res.status < 500,
      });
      errApi.add(!ok);
    }
  });
  sleep(1 + Math.random() * 0.5);
}

/* ─── 3. Auth flow ───────────────────────────────────────── */
export function auth() {
  group('auth', () => {
    /* Email único por VU+iteração pra evitar rate-limit por
     *  email repetido. Com 10 VUs * 5min vamos gerar ~1000
     *  pedidos — todos com emails distintos. */
    const email = `k6-load-${__VU}-${__ITER}-${Date.now()}@muusic-test.local`;
    const r = http.post(
      `${BASE_URL}/api/auth/request`,
      JSON.stringify({ email }),
      {
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        tags: { name: 'POST /api/auth/request' },
        responseCallback: http.expectedStatuses(200, 202, 429),
      }
    );
    const ok = check(r, {
      'auth request status ok': (res) => [200, 202, 429].indexOf(res.status) !== -1,
      'auth request no 5xx': (res) => res.status < 500,
    });
    errAuth.add(!ok);
  });
  /* Auth flow é mais devagar que landing (espera ~2.5s entre
   *  iterações). Reflete usuário real lendo email/checking
   *  link em outra aba. */
  sleep(2.5 + Math.random() * 1);
}

/* ─── 4. Socket.io handshake ─────────────────────────────── */
export function socket() {
  group('socket', () => {
    const url = `${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
    const r = http.get(url, {
      headers: defaultHeaders,
      tags: { name: 'socket.io handshake' },
      responseCallback: expectOK,
    });
    const ok = check(r, {
      'socket handshake status 200': (res) => res.status === 200,
      'socket handshake body has sid': (res) =>
        typeof res.body === 'string' && res.body.indexOf('"sid"') !== -1,
    });
    errSocket.add(!ok);
  });
  sleep(2 + Math.random() * 0.5);
}
