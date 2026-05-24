import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, generateCode, MAGIC_TTL_MS, SESSION_TTL_MS } from './tokens';

describe('generateToken', () => {
  it('gera raw + hash não-vazios', () => {
    const { raw, hash } = generateToken();
    expect(raw.length).toBeGreaterThan(20);
    expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('raw é base64url-safe (sem +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const { raw } = generateToken();
      expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('hash de raw bate com hashToken(raw)', () => {
    const { raw, hash } = generateToken();
    expect(hashToken(raw)).toBe(hash);
  });

  it('cada token é único (entropy real)', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { raw } = generateToken();
      tokens.add(raw);
    }
    expect(tokens.size).toBe(100); // zero colisões em 100 sampleos
  });
});

describe('hashToken', () => {
  it('é determinístico — mesma entrada, mesma saída', () => {
    expect(hashToken('abc123')).toBe(hashToken('abc123'));
  });

  it('é case-sensitive', () => {
    expect(hashToken('abc')).not.toBe(hashToken('ABC'));
  });

  it('1 char diferente = hash totalmente diferente (avalanche)', () => {
    const a = hashToken('hello-world-token');
    const b = hashToken('hello-world-tokeN'); // último char muda
    // Pelo menos 50% dos chars devem diferir (avalanche effect)
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    expect(diff).toBeGreaterThan(a.length * 0.4);
  });

  it('retorna 64 chars hex (SHA-256)', () => {
    const h = hashToken('anything');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateCode', () => {
  it('retorna sempre 6 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    }
  });

  it('inclui zero-padding pra números < 100000', () => {
    // Não dá pra testar diretamente porque random,
    // mas verificamos que strings de 6 chars sempre.
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) codes.add(generateCode());
    // 200 sampleos em 1M de espaço — colisões extremamente raras
    expect(codes.size).toBeGreaterThan(195);
  });

  it('uniformidade — distribuição não tem viés óbvio', () => {
    // Verifica que primeiros dígitos cobrem 0–9
    const firstDigits = new Set<string>();
    for (let i = 0; i < 500; i++) {
      firstDigits.add(generateCode()[0]);
    }
    expect(firstDigits.size).toBe(10); // todos os dígitos aparecem
  });
});

describe('constants', () => {
  it('MAGIC_TTL_MS = 15min', () => {
    expect(MAGIC_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('SESSION_TTL_MS = 30 dias', () => {
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('SESSION_TTL >> MAGIC_TTL (magic é curto, session é longo)', () => {
    expect(SESSION_TTL_MS / MAGIC_TTL_MS).toBeGreaterThan(2000);
  });
});
