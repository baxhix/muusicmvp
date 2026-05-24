import { describe, it, expect } from 'vitest';
import { resolveAvatarPath } from './storage';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_HEX = 'abcd1234';

/**
 * Security tests — anti-path-traversal do avatar storage.
 * Aceita: <user-uuid>.<8-16 hex>.<jpg|png|webp|gif>.
 * Rejeita: tudo o resto (executáveis, SVG, traversal).
 */
describe('resolveAvatarPath', () => {
  it.each(['jpg', 'png', 'webp', 'gif'])('aceita .%s', (ext) => {
    const fn = `${VALID_UUID}.${VALID_HEX}.${ext}`;
    expect(resolveAvatarPath(fn)).not.toBeNull();
  });

  it('aceita extensão em maiúsculo', () => {
    expect(resolveAvatarPath(`${VALID_UUID}.${VALID_HEX}.PNG`)).not.toBeNull();
  });

  it('rejeita SVG (vetor pra XSS via foreignObject)', () => {
    expect(resolveAvatarPath(`${VALID_UUID}.${VALID_HEX}.svg`)).toBeNull();
  });

  it.each([
    '../etc/passwd',
    `${VALID_UUID}.${VALID_HEX}.jpg/../../foo`,
    '..%2fpasswd.jpg',
    '/etc/passwd.jpg',
  ])('rejeita traversal "%s"', (p) => {
    expect(resolveAvatarPath(p)).toBeNull();
  });

  it.each([
    `${VALID_UUID}.${VALID_HEX}.exe`,
    `${VALID_UUID}.${VALID_HEX}.sh`,
    `${VALID_UUID}.${VALID_HEX}.php`,
  ])('rejeita executável "%s"', (fn) => {
    expect(resolveAvatarPath(fn)).toBeNull();
  });

  it.each([
    '',
    'no-ext',
    'foo.jpg',
    `${VALID_UUID}.short.jpg`,
    `${VALID_UUID}.${'a'.repeat(20)}.jpg`,
    `${VALID_UUID}.${VALID_HEX}`,
  ])('rejeita malformado "%s"', (fn) => {
    expect(resolveAvatarPath(fn)).toBeNull();
  });
});
