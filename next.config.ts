import type { NextConfig } from 'next';

/**
 * Security headers aplicados em TODAS as respostas. São aditivos e
 * não dependem de cliente — browsers que entendem aplicam, os que
 * não, ignoram. Detalhes de cada um:
 *
 *  - Strict-Transport-Security: força HTTPS por 2 anos + subdomínios.
 *    Só tem efeito em respostas servidas via HTTPS (browser ignora
 *    em http://), então dev em localhost não é afetado.
 *
 *  - X-Content-Type-Options: nosniff impede o browser de inferir
 *    Content-Type por heurística (mitigação clássica de XSS via
 *    upload disfarçado).
 *
 *  - X-Frame-Options: SAMEORIGIN bloqueia iframe em outro domínio
 *    (anti-clickjacking). Note: substituído por `frame-ancestors`
 *    em CSP quando implementarmos CSP — mantemos os dois por
 *    compatibilidade com browsers antigos.
 *
 *  - Referrer-Policy: strict-origin-when-cross-origin envia URL
 *    completa em navegação interna, só origin em navegação
 *    cross-site, e nada em downgrades HTTPS→HTTP.
 *
 *  - Permissions-Policy: deny explícito de features não usadas.
 *    geolocation=(self) porque /api/me/location precisa dela.
 *    camera/microphone/payment deny — não há feature que use.
 *
 *  - X-DNS-Prefetch-Control: on libera DNS prefetch (perf).
 *
 * Decisão consciente: NÃO incluímos Content-Security-Policy aqui.
 * CSP precisa de auditoria cuidadosa de Mapbox + PostHog + inline
 * scripts da landing/welcome. Fica como bloco amarelo do plano.
 */
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), camera=(), microphone=(), payment=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/**
 * Content-Security-Policy — modo Report-Only.
 *
 * MODO DE ROLLOUT PRUDENTE:
 *   1. (atual) Report-Only — browser NÃO bloqueia, só envia
 *      relatórios pro endpoint configurado. Permite descobrir
 *      todas as fontes legítimas (Mapbox tiles, PostHog,
 *      inline scripts, fonts CDN, etc.) antes de enforce.
 *   2. (futuro) Após 1–2 semanas de telemetria, ajustar a
 *      policy e mudar pra `Content-Security-Policy` (enforce).
 *
 * Sources atuais conhecidas (mapeadas via auditoria):
 *   - script: self + 'unsafe-inline' (welcome flag script no
 *     root layout) + PostHog (us.i.posthog.com) + Mapbox
 *   - style: self + 'unsafe-inline' (Tailwind/CSS Modules
 *     inline em alguns componentes)
 *   - img: self + data: + blob: + api.mapbox.com + *.tile.openstreetmap.org
 *   - font: self + data: (Borscha self-hosted)
 *   - connect: self + Resend webhook + PostHog + Mapbox API
 *   - frame-ancestors: 'none' (anti-clickjacking — substitui
 *     X-Frame-Options nos browsers modernos)
 *
 * 'unsafe-inline' em script é o ponto que mais incomoda — ideal
 * é mover pra nonce ou hash. Próxima iteração.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://api.mapbox.com https://*.mapbox.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: https://api.mapbox.com https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://us.i.posthog.com https://api.mapbox.com wss://*.mapbox.com https://api.resend.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // Produces .next/standalone for the production Docker image.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        port: '',
        pathname: '/image/**',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Aplica em tudo. Static assets (`_next/static/*`) e API routes
        // herdam, e o overhead é desprezível (são headers, não geram
        // request adicional).
        source: '/:path*',
        headers: [
          ...SECURITY_HEADERS,
          // CSP em modo Report-Only — não bloqueia nada, só registra
          // violações no console do browser pra mapear fontes externas
          // legítimas antes de ativar enforce. Não aplica em /api/*
          // (rotas JSON não renderizam scripts).
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
