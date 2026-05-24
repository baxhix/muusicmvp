import { describe, it, expect } from 'vitest';
import { resolveMaterialPath } from './storage';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_HEX = 'abcd1234';

/**
 * Security tests — anti-path-traversal do storage de Materiais.
 * Aceita formatos: jpg, png, svg, mp3, mp4, pdf, zip.
 * SVG é permitido em Materiais (acervo da artista é controlado).
 */
describe('resolveMaterialPath', () => {
  it.each(['jpg', 'png', 'svg', 'mp3', 'mp4', 'pdf', 'zip'])(
    'aceita .%s',
    (ext) => {
      const fn = `${VALID_UUID}.${VALID_HEX}.${ext}`;
      expect(resolveMaterialPath(fn)).not.toBeNull();
    },
  );

  it('aceita case-insensitive', () => {
    expect(resolveMaterialPath(`${VALID_UUID}.${VALID_HEX}.MP3`)).not.toBeNull();
  });

  it.each([
    '../etc/passwd.pdf',
    `${VALID_UUID}.${VALID_HEX}.mp3/../foo`,
    '..%2fpasswd.zip',
  ])('rejeita traversal "%s"', (p) => {
    expect(resolveMaterialPath(p)).toBeNull();
  });

  it.each([
    `${VALID_UUID}.${VALID_HEX}.exe`,
    `${VALID_UUID}.${VALID_HEX}.sh`,
    `${VALID_UUID}.${VALID_HEX}.bat`,
    `${VALID_UUID}.${VALID_HEX}.html`, // pode carregar JS
  ])('rejeita executável/script "%s"', (fn) => {
    expect(resolveMaterialPath(fn)).toBeNull();
  });

  it.each([
    '',
    'noext',
    'random.jpg',
    `${VALID_UUID}.bad.jpg`,
    `${VALID_UUID}.${VALID_HEX}`,
  ])('rejeita malformado "%s"', (fn) => {
    expect(resolveMaterialPath(fn)).toBeNull();
  });
});
