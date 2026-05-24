import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setErrorTransport } from './log';

describe('logger', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarn  = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleLog   = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    consoleError.mockClear();
    consoleWarn.mockClear();
    consoleLog.mockClear();
  });

  afterEach(() => {
    // Reset transport entre testes pra evitar vazamento.
    setErrorTransport(() => {});
  });

  it('error emite no console com scope + stack', () => {
    const err = new Error('boom');
    logger.error('test.scope', err, { userId: '42' });
    expect(consoleError).toHaveBeenCalledTimes(1);
    const [msg, payload] = consoleError.mock.calls[0];
    expect(msg).toMatch(/\[ERROR\] test\.scope: boom/);
    expect(payload).toMatchObject({ userId: '42' });
    expect(payload).toHaveProperty('stack');
  });

  it('error aceita non-Error (string, object)', () => {
    logger.error('test', 'plain string');
    expect(consoleError).toHaveBeenCalled();
    const [msg] = consoleError.mock.calls[0];
    expect(msg).toMatch(/plain string/);
  });

  it('warn emite no console', () => {
    logger.warn('test', { foo: 'bar' });
    expect(consoleWarn).toHaveBeenCalled();
  });

  it('info emite no console', () => {
    logger.info('test', { x: 1 });
    expect(consoleLog).toHaveBeenCalled();
  });

  describe('setErrorTransport', () => {
    it('chama o transport configurado', () => {
      const transport = vi.fn();
      setErrorTransport(transport);

      const err = new Error('oops');
      logger.error('foo.bar', err, { tenant: 'x' });

      expect(transport).toHaveBeenCalledTimes(1);
      expect(transport).toHaveBeenCalledWith(err, {
        scope: 'foo.bar',
        tenant: 'x',
      });
    });

    it('engole exceção do transport (não derruba o caller)', () => {
      setErrorTransport(() => {
        throw new Error('transport broken');
      });
      expect(() => logger.error('test', new Error('x'))).not.toThrow();
      // E o console.error original ainda é chamado
      expect(consoleError).toHaveBeenCalled();
    });

    it('só roda transport em error(), não em warn/info', () => {
      const transport = vi.fn();
      setErrorTransport(transport);

      logger.warn('test', {});
      logger.info('test', {});
      expect(transport).not.toHaveBeenCalled();

      logger.error('test', new Error('x'));
      expect(transport).toHaveBeenCalledTimes(1);
    });
  });
});
