import { describe, it, expect } from 'vitest';
import { resolveReportImagePath } from './storage';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_HEX = 'abcd1234';

/** Anti-path-traversal do storage de evidências de report. */
describe('resolveReportImagePath', () => {
  it.each(['jpg', 'png', 'webp', 'gif'])('aceita .%s', (ext) => {
    const fn = `${VALID_UUID}.${VALID_HEX}.${ext}`;
    expect(resolveReportImagePath(fn)).not.toBeNull();
  });

  it('rejeita SVG (XSS vector)', () => {
    expect(resolveReportImagePath(`${VALID_UUID}.${VALID_HEX}.svg`)).toBeNull();
  });

  it.each([
    '../etc/passwd.jpg',
    `${VALID_UUID}.${VALID_HEX}.png/..`,
    '..%2fpasswd.png',
  ])('rejeita traversal "%s"', (p) => {
    expect(resolveReportImagePath(p)).toBeNull();
  });

  it.each([
    `${VALID_UUID}.${VALID_HEX}.exe`,
    `${VALID_UUID}.${VALID_HEX}.zip`, // reports só aceitam imagens
    `${VALID_UUID}.${VALID_HEX}.pdf`,
  ])('rejeita não-imagem "%s"', (fn) => {
    expect(resolveReportImagePath(fn)).toBeNull();
  });

  it.each(['', 'foo.jpg', `${VALID_UUID}.short.jpg`, `${VALID_UUID}.${VALID_HEX}`])(
    'rejeita malformado "%s"',
    (fn) => {
      expect(resolveReportImagePath(fn)).toBeNull();
    },
  );
});
