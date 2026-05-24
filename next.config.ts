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
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
