import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test do helper softDeleteUser com DB mockado.
 *
 * Estratégia: substituímos `@/server/db` por um stub que captura
 * as operações. Isto valida o contrato (estrutura de transação,
 * atomicidade, returning) sem precisar de Postgres.
 *
 * Testes de integração com Postgres real (testcontainers) ficam
 * pra próxima rodada — vide docs/architecture.md.
 */

interface CapturedOp {
  kind: 'update' | 'delete';
  table: string;
  values?: Record<string, unknown>;
  where?: string;
  returning: Array<{ id?: string; tokenHash?: string }>;
}

const captured: CapturedOp[] = [];

/** Mock dinâmico — cada teste reseta as queues. */
const mockState = {
  updateReturning: [] as Array<{ id: string; deletedAt: Date }>,
  deleteReturning: [] as Array<{ tokenHash: string }>,
};

vi.mock('../db', () => {
  const buildUpdateChain = () => ({
    set: (values: Record<string, unknown>) => ({
      where: (_w: unknown) => ({
        returning: (_cols?: unknown) => {
          captured.push({
            kind: 'update',
            table: 'users',
            values,
            returning: mockState.updateReturning,
          });
          return Promise.resolve(mockState.updateReturning);
        },
      }),
    }),
  });
  const buildDeleteChain = () => ({
    where: (_w: unknown) => ({
      returning: (_cols?: unknown) => {
        captured.push({
          kind: 'delete',
          table: 'tokens',
          returning: mockState.deleteReturning,
        });
        return Promise.resolve(mockState.deleteReturning);
      },
    }),
  });

  interface TxMock {
    update: (_t: unknown) => ReturnType<typeof buildUpdateChain>;
    delete: (_t: unknown) => ReturnType<typeof buildDeleteChain>;
  }
  const tx: TxMock = {
    update: (_t: unknown) => buildUpdateChain(),
    delete: (_t: unknown) => buildDeleteChain(),
  };

  return {
    db: {
      transaction: async <T,>(fn: (tx: TxMock) => Promise<T>): Promise<T> => {
        return await fn(tx);
      },
    },
  };
});

import { softDeleteUser } from './softDelete';

describe('softDeleteUser', () => {
  beforeEach(() => {
    captured.length = 0;
    mockState.updateReturning = [];
    mockState.deleteReturning = [];
  });

  it('marca deleted_at e revoga sessões — caso happy path', async () => {
    mockState.updateReturning = [
      { id: 'user-123', deletedAt: new Date() },
    ];
    mockState.deleteReturning = [
      { tokenHash: 'hash-a' },
      { tokenHash: 'hash-b' },
      { tokenHash: 'hash-c' },
    ];

    const result = await softDeleteUser('user-123');

    expect(result).toEqual({
      marked: true,
      sessionsRevoked: 3,
    });

    // Verifica que ambas operações foram chamadas na ordem correta
    expect(captured).toHaveLength(2);
    expect(captured[0].kind).toBe('update');
    expect(captured[0].table).toBe('users');
    expect(captured[0].values).toHaveProperty('deletedAt');
    expect(captured[1].kind).toBe('delete');
    expect(captured[1].table).toBe('tokens');
  });

  it('é idempotente: usuário já soft-deletado retorna marked=false', async () => {
    // Update returning vazio → não atualizou nada (já estava deleted)
    mockState.updateReturning = [];
    mockState.deleteReturning = [];

    const result = await softDeleteUser('user-already-deleted');

    expect(result).toEqual({
      marked: false,
      sessionsRevoked: 0,
    });
  });

  it('zero sessões ativas é cenário válido', async () => {
    mockState.updateReturning = [
      { id: 'user-456', deletedAt: new Date() },
    ];
    mockState.deleteReturning = []; // nenhuma sessão

    const result = await softDeleteUser('user-456');

    expect(result).toEqual({
      marked: true,
      sessionsRevoked: 0,
    });
  });

  it('seta os campos esperados no UPDATE', async () => {
    mockState.updateReturning = [
      { id: 'user-789', deletedAt: new Date() },
    ];
    mockState.deleteReturning = [];

    await softDeleteUser('user-789');

    expect(captured[0].values).toMatchObject({
      deletedAt: expect.any(Date),
    });
    // Não vaza outros campos no UPDATE — apenas deleted_at
    expect(Object.keys(captured[0].values ?? {})).toEqual(['deletedAt']);
  });
});
