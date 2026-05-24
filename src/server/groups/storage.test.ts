import { describe, it, expect } from 'vitest';
import { resolveGroupImagePath } from './storage';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_HEX = 'abcd1234';

/** Anti-path-traversal do storage de imagens de grupo (chat). */
describe('resolveGroupImagePath', () => {
  it.each(['jpg', 'png', 'webp', 'gif'])('aceita .%s', (ext) => {
    const fn = `${VALID_UUID}.${VALID_HEX}.${ext}`;
    expect(resolveGroupImagePath(fn)).not.toBeNull();
  });

  it('rejeita SVG (XSS vector)', () => {
    expect(resolveGroupImagePath(`${VALID_UUID}.${VALID_HEX}.svg`)).toBeNull();
  });

  it.each([
    '../etc/passwd.jpg',
    `${VALID_UUID}.${VALID_HEX}.png/..`,
    '..%2fpasswd.png',
  ])('rejeita traversal "%s"', (p) => {
    expect(resolveGroupImagePath(p)).toBeNull();
  });

  it.each([
    `${VALID_UUID}.${VALID_HEX}.exe`,
    `${VALID_UUID}.${VALID_HEX}.html`,
    `${VALID_UUID}.${VALID_HEX}.php`,
  ])('rejeita executável/script "%s"', (fn) => {
    expect(resolveGroupImagePath(fn)).toBeNull();
  });

  it.each(['', 'foo.png', `${VALID_UUID}.short.png`, `${VALID_UUID}.${VALID_HEX}`])(
    'rejeita malformado "%s"',
    (fn) => {
      expect(resolveGroupImagePath(fn)).toBeNull();
    },
  );
});
