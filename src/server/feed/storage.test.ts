import { describe, it, expect } from 'vitest';
import { resolveFeedImagePath, resolveFeedVideoPath } from './storage';

/**
 * Security tests — proteções anti-traversal do resolve.
 *
 * O regex em resolveFeedImagePath/Video deve aceitar APENAS o
 * formato canônico: `<owner-uuid>.<8-16 hex>.<ext-whitelisted>`.
 * Qualquer outra forma (path traversal, executável, MIME falso)
 * deve retornar null.
 */
describe('resolveFeedImagePath', () => {
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
  const VALID_HEX  = 'abcd1234';

  describe('aceita formato canônico', () => {
    // Nota: `jpeg` NÃO está na whitelist do feed pois saveFeedImage
    // normaliza `image/jpeg` → extensão `.jpg` na escrita. Mantém o
    // resolve enxuto.
    it.each(['jpg', 'png', 'webp', 'gif'])(
      'aceita .%s',
      (ext) => {
        const fn = `${VALID_UUID}.${VALID_HEX}.${ext}`;
        expect(resolveFeedImagePath(fn)).not.toBeNull();
      },
    );

    it('aceita extensão em maiúsculo (case-insensitive)', () => {
      expect(resolveFeedImagePath(`${VALID_UUID}.${VALID_HEX}.JPG`)).not.toBeNull();
    });
  });

  describe('rejeita path traversal', () => {
    it.each([
      '../etc/passwd',
      '../../foo.jpg',
      `${VALID_UUID}.${VALID_HEX}.jpg/../../foo`,
      '..%2fetc%2fpasswd',
      '..\\windows\\system32',
    ])('rejeita "%s"', (path) => {
      expect(resolveFeedImagePath(path)).toBeNull();
    });
  });

  describe('rejeita extensões não-whitelist (anti-exec)', () => {
    it.each([
      `${VALID_UUID}.${VALID_HEX}.exe`,
      `${VALID_UUID}.${VALID_HEX}.sh`,
      `${VALID_UUID}.${VALID_HEX}.php`,
      `${VALID_UUID}.${VALID_HEX}.html`,
      `${VALID_UUID}.${VALID_HEX}.svg`, // SVG não está no whitelist do feed
    ])('rejeita "%s"', (fn) => {
      expect(resolveFeedImagePath(fn)).toBeNull();
    });
  });

  describe('rejeita formatos malformados', () => {
    it.each([
      '',
      'no-extension',
      'foo.jpg', // sem UUID
      'not-uuid.abcd1234.jpg',
      `${VALID_UUID}.short.jpg`, // hex < 8 chars
      `${VALID_UUID}.${'a'.repeat(20)}.jpg`, // hex > 16 chars
      `${VALID_UUID}..jpg`, // hex vazio
      `${VALID_UUID}.${VALID_HEX}`, // sem extensão
    ])('rejeita "%s"', (fn) => {
      expect(resolveFeedImagePath(fn)).toBeNull();
    });
  });
});

describe('resolveFeedVideoPath', () => {
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
  const VALID_HEX  = 'abcd1234';

  it('aceita extensões de vídeo', () => {
    expect(resolveFeedVideoPath(`${VALID_UUID}.${VALID_HEX}.mp4`)).not.toBeNull();
    expect(resolveFeedVideoPath(`${VALID_UUID}.${VALID_HEX}.webm`)).not.toBeNull();
  });

  it('rejeita extensões de imagem (separação de domínio)', () => {
    expect(resolveFeedVideoPath(`${VALID_UUID}.${VALID_HEX}.jpg`)).toBeNull();
    expect(resolveFeedVideoPath(`${VALID_UUID}.${VALID_HEX}.png`)).toBeNull();
  });

  it('rejeita path traversal', () => {
    expect(resolveFeedVideoPath('../../etc/passwd.mp4')).toBeNull();
  });
});
