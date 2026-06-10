/**
 * k6 stress test — muusic.live
 *
 * Perfil: ramping até **250 VUs totais** num período de ~6min
 * pra descobrir onde a SSH instance da Hostinger começa a
 * sufocar. Distribuição:
 *   - landing:  80 VUs (web SSR — costuma ser o gargalo CPU)
 *   - api:      80 VUs (DB-bound, vai pressurizar pool)
 *   - auth:     50 VUs (DB write + email queue)
 *   - socket:   40 VUs (handshake polling)
 *
 * Stages:
 *   30s : 0   → peak/2  (warmup ramp)
 *   1m  : ↑   peak/2     (warm sustain)
 *   1m  : peak/2 → peak  (push to peak)
 *   3m  :  ↑   peak       (sustain stress)
 *   30s : peak → 0       (cool down)
 *
 * Total: ~6min de pressão real.
 *
 * Como rodar:
 *   k6 run scripts/k6/stress.js
 *
 * Expectativa: thresholds DESLIGADOS pra não abortar — quero
 * ver onde quebra, não passar/falhar.
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

/* Stages de stress — escala em duas etapas (warm + push) pra
 *  ver curva, não só estado final. */
function rampStress(peak) {
  return [
    { duration: '30s', target: Math.floor(peak / 2) },  // warmup
    { duration: '1m',  target: Math.floor(peak / 2) },  // warm hold
    { duration: '1m',  target: peak },                  // push to peak
    { duration: '3m',  target: peak },                  // sustain stress
    { duration: '30s', target: 0 },                     // cool down
  ];
}

export const options = {
  scenarios: {
    landing: {
      executor: 'ramping-vus',
      stages: rampStress(80),
      gracefulRampDown: '20s',
      exec: 'landing',
      tags: { scenario: 'landing' },
    },
    api: {
      executor: 'ramping-vus',
      stages: rampStress(80),
      gracefulRampDown: '20s',
      exec: 'api',
      tags: { scenario: 'api' },
    },
    auth: {
      executor: 'ramping-vus',
      stages: rampStress(50),
      gracefulRampDown: '20s',
      exec: 'auth',
      tags: { scenario: 'auth' },
    },
    socket: {
      executor: 'ramping-vus',
      stages: rampStress(40),
      gracefulRampDown: '20s',
      exec: 'socket',
      tags: { scenario: 'socket' },
    },
  },
  /* Thresholds em modo "observar" — só marcam vermelho se a
   *  saúde DESPENCAR (p95 > 8s em landing significa servidor
   *  travado). Não aborta o run mid-flight (abortOnFail false). */
  thresholds: {
    'http_req_duration{scenario:landing}': [
      { threshold: 'p(95)<8000',  abortOnFail: false },
      { threshold: 'p(99)<15000', abortOnFail: false },
    ],
    'http_req_duration{scenario:api}': [
      { threshold: 'p(95)<6000',  abortOnFail: false },
      { threshold: 'p(99)<12000', abortOnFail: false },
    ],
    'http_req_duration{scenario:auth}': [
      { threshold: 'p(95)<8000',  abortOnFail: false },
      { threshold: 'p(99)<15000', abortOnFail: false },
    ],
    /* Stress test: até 10% de erro é aceitável; acima disso é
     *  sinal de capacity exceeded. */
    'errors_landing': [{ threshold: 'rate<0.10', abortOnFail: false }],
    'errors_api':     [{ threshold: 'rate<0.10', abortOnFail: false }],
    'errors_auth':    [{ threshold: 'rate<0.15', abortOnFail: false }],
    'errors_socket':  [{ threshold: 'rate<0.10', abortOnFail: false }],
  },
};

const defaultHeaders = {
  'User-Agent': 'muusic-k6-stress/1.0 (+stress-test)',
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
        /* Timeout custom: stress test pode ter resposta lenta;
         *  10s é o teto que ainda considera "respondeu". */
        timeout: '10s',
      });
      const ok = check(r, {
        [`${path} status 200`]: (res) => res.status === 200,
        [`${path} no 5xx`]: (res) => res.status < 500,
      });
      errLanding.add(!ok);
      ttfbLanding.add(r.timings.waiting);
    }
  });
  sleep(0.8 + Math.random() * 0.4);
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
        timeout: '8s',
      });
      const ok = check(r, {
        [`${ep.path} status ok`]: (res) => ep.expected.indexOf(res.status) !== -1,
        [`${ep.path} no 5xx`]: (res) => res.status < 500,
      });
      errApi.add(!ok);
    }
  });
  sleep(0.5 + Math.random() * 0.5);
}

/* ─── 3. Auth flow ───────────────────────────────────────── */
export function auth() {
  group('auth', () => {
    const email = `k6-stress-${__VU}-${__ITER}-${Date.now()}@muusic-test.local`;
    const r = http.post(
      `${BASE_URL}/api/auth/request`,
      JSON.stringify({ email }),
      {
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        tags: { name: 'POST /api/auth/request' },
        responseCallback: http.expectedStatuses(200, 202, 429),
        timeout: '10s',
      }
    );
    const ok = check(r, {
      'auth request status ok': (res) => [200, 202, 429].indexOf(res.status) !== -1,
      'auth request no 5xx': (res) => res.status < 500,
    });
    errAuth.add(!ok);
  });
  sleep(2 + Math.random() * 1);
}

/* ─── 4. Socket.io handshake ─────────────────────────────── */
export function socket() {
  group('socket', () => {
    const url = `${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
    const r = http.get(url, {
      headers: defaultHeaders,
      tags: { name: 'socket.io handshake' },
      responseCallback: expectOK,
      timeout: '8s',
    });
    const ok = check(r, {
      'socket handshake status 200': (res) => res.status === 200,
      'socket handshake body has sid': (res) =>
        typeof res.body === 'string' && res.body.indexOf('"sid"') !== -1,
    });
    errSocket.add(!ok);
  });
  sleep(1.5 + Math.random() * 0.5);
}
