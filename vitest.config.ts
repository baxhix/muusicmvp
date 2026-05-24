import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config — testes unitários da camada server.
 *
 * Escopo deliberadamente cirúrgico:
 *   - Cobre o que é puro (validators, MIME, rate limiter, hash, retry).
 *   - NÃO cobre handlers Next.js que dependem de cookies()/headers()
 *     (precisa de mock pesado do Next runtime — bloco azul futuro).
 *   - NÃO cobre queries Drizzle (precisa Postgres de teste — phase 2).
 *
 * Run:
 *   npm test            → roda uma vez
 *   npm run test:watch  → modo dev
 *   npm run test:coverage → relatório de cobertura
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /* Exclui testes que precisem de browser (admin/ tem alguns no
     * componente layer; futuro). */
    exclude: ['admin/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      include: ['src/server/**'],
      exclude: ['src/server/db/migrate.ts', 'src/server/db/seed.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
