/**
 * k6 spike test — muusic.live
 *
 * Perfil: escalada agressiva pra **1000 VUs concorrentes** com
 * patamares em 500 → 1000 pra mapear a curva de degradação.
 *
 * Distribuição (peak 1000):
 *   - landing: 400 VUs (web SSR — gargalo CPU candidato #1)
 *   - api:     300 VUs (DB-bound)
 *   - auth:    150 VUs (DB write + email queue — pode hit rate-limit)
 *   - socket:  150 VUs (engine.io polling handshake)
 *
 * Stages (mesma curva pra todos, escalada proporcional ao
 * próprio peak de cada cenário):
 *   30s : 0    → 50% peak   (ramp to baseline)
 *   1m  : hold 50%          (sustain baseline)
 *   1m  : 50%  → peak       (spike to full load)
 *   2m  : hold peak         (sustain spike)
 *   30s : peak → 0          (cool down)
 *
 * Total: ~5min de fogo.
 *
 * Como rodar:
 *   k6 run scripts/k6/spike.js
 *
 * Atenção: gera tráfego de produção realista — não rodar em
 * janela de pico de usuários. Cada VU sustenta socket TCP até
 * sair, então o pico de file descriptors locais ≈ 1000-1500.
 *
 * Pré-check no macOS:
 *   ulimit -n   # deve estar > 4096; default High Sierra 256
 */

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

/* Curva de spike — half/peak escalonado pra ver onde a
 *  latência derrete. */
function rampSpike(peak) {
  return [
    { duration: '30s', target: Math.floor(peak / 2) },  // ramp to 50%
    { duration: '1m',  target: Math.floor(peak / 2) },  // baseline hold
    { duration: '1m',  target: peak },                  // spike to peak
    { duration: '2m',  target: peak },                  // sustain
    { duration: '30s', target: 0 },                     // cool down
  ];
}

export const options = {
  scenarios: {
    landing: {
      executor: 'ramping-vus',
      stages: rampSpike(400),
      gracefulRampDown: '30s',
      exec: 'landing',
      tags: { scenario: 'landing' },
    },
    api: {
      executor: 'ramping-vus',
      stages: rampSpike(300),
      gracefulRampDown: '30s',
      exec: 'api',
      tags: { scenario: 'api' },
    },
    auth: {
      executor: 'ramping-vus',
      stages: rampSpike(150),
      gracefulRampDown: '30s',
      exec: 'auth',
      tags: { scenario: 'auth' },
    },
    socket: {
      executor: 'ramping-vus',
      stages: rampSpike(150),
      gracefulRampDown: '30s',
      exec: 'socket',
      tags: { scenario: 'socket' },
    },
  },
  /* Spike test: thresholds só pra logar — abortOnFail false em
   *  TODOS. Queremos ver o ponto de quebra, não falhar o run. */
  thresholds: {
    'http_req_duration{scenario:landing}': [
      { threshold: 'p(95)<15000', abortOnFail: false },
      { threshold: 'p(99)<25000', abortOnFail: false },
    ],
    'http_req_duration{scenario:api}': [
      { threshold: 'p(95)<10000', abortOnFail: false },
      { threshold: 'p(99)<20000', abortOnFail: false },
    ],
    'http_req_duration{scenario:auth}': [
      { threshold: 'p(95)<15000', abortOnFail: false },
    ],
    /* Em spike test até 20% de erros é informativo. */
    'errors_landing': [{ threshold: 'rate<0.20', abortOnFail: false }],
    'errors_api':     [{ threshold: 'rate<0.20', abortOnFail: false }],
    'errors_auth':    [{ threshold: 'rate<0.30', abortOnFail: false }],
    'errors_socket':  [{ threshold: 'rate<0.20', abortOnFail: false }],
  },
};

const defaultHeaders = {
  'User-Agent': 'muusic-k6-spike/1.0 (+spike-test)',
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
        /* Timeout 20s — no spike, requests podem ficar em queue
         *  longa. Qualquer coisa acima é considerado "morto". */
        timeout: '20s',
      });
      const ok = check(r, {
        [`${path} status 200`]: (res) => res.status === 200,
        [`${path} no 5xx`]: (res) => res.status < 500,
      });
      errLanding.add(!ok);
      ttfbLanding.add(r.timings.waiting);
    }
  });
  sleep(0.5 + Math.random() * 0.3);
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
        timeout: '15s',
      });
      const ok = check(r, {
        [`${ep.path} status ok`]: (res) => ep.expected.indexOf(res.status) !== -1,
        [`${ep.path} no 5xx`]: (res) => res.status < 500,
      });
      errApi.add(!ok);
    }
  });
  sleep(0.4 + Math.random() * 0.3);
}

/* ─── 3. Auth flow ───────────────────────────────────────── */
export function auth() {
  group('auth', () => {
    const email = `k6-spike-${__VU}-${__ITER}-${Date.now()}@muusic-test.local`;
    const r = http.post(
      `${BASE_URL}/api/auth/request`,
      JSON.stringify({ email }),
      {
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        tags: { name: 'POST /api/auth/request' },
        responseCallback: http.expectedStatuses(200, 202, 429),
        timeout: '20s',
      }
    );
    const ok = check(r, {
      'auth request status ok': (res) => [200, 202, 429].indexOf(res.status) !== -1,
      'auth request no 5xx': (res) => res.status < 500,
    });
    errAuth.add(!ok);
  });
  sleep(1.5 + Math.random() * 0.5);
}

/* ─── 4. Socket.io handshake ─────────────────────────────── */
export function socket() {
  group('socket', () => {
    const url = `${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
    const r = http.get(url, {
      headers: defaultHeaders,
      tags: { name: 'socket.io handshake' },
      responseCallback: expectOK,
      timeout: '15s',
    });
    const ok = check(r, {
      'socket handshake status 200': (res) => res.status === 200,
      'socket handshake body has sid': (res) =>
        typeof res.body === 'string' && res.body.indexOf('"sid"') !== -1,
    });
    errSocket.add(!ok);
  });
  sleep(1 + Math.random() * 0.5);
}
