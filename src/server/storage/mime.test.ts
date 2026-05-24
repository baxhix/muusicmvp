import { describe, it, expect } from 'vitest';
import { getContentType } from './mime';

describe('getContentType', () => {
  describe('imagens', () => {
    it('mapeia jpg/jpeg pra image/jpeg', () => {
      expect(getContentType('foo.jpg')).toBe('image/jpeg');
      expect(getContentType('foo.jpeg')).toBe('image/jpeg');
    });

    it('mapeia png/webp/gif/svg', () => {
      expect(getContentType('foo.png')).toBe('image/png');
      expect(getContentType('foo.webp')).toBe('image/webp');
      expect(getContentType('foo.gif')).toBe('image/gif');
      expect(getContentType('foo.svg')).toBe('image/svg+xml');
    });
  });

  describe('áudio', () => {
    it('mapeia mp3/m4a/wav/ogg', () => {
      expect(getContentType('song.mp3')).toBe('audio/mpeg');
      expect(getContentType('song.m4a')).toBe('audio/mp4');
      expect(getContentType('song.wav')).toBe('audio/wav');
      expect(getContentType('song.ogg')).toBe('audio/ogg');
    });
  });

  describe('vídeo', () => {
    it('mapeia mp4/webm/mov/ogv', () => {
      expect(getContentType('clip.mp4')).toBe('video/mp4');
      expect(getContentType('clip.webm')).toBe('video/webm');
      expect(getContentType('clip.mov')).toBe('video/quicktime');
      expect(getContentType('clip.ogv')).toBe('video/ogg');
    });
  });

  describe('documentos / pacotes', () => {
    it('mapeia pdf/zip', () => {
      expect(getContentType('doc.pdf')).toBe('application/pdf');
      expect(getContentType('archive.zip')).toBe('application/zip');
    });
  });

  describe('case-insensitive', () => {
    it('aceita extensão em maiúsculo', () => {
      expect(getContentType('FOO.JPG')).toBe('image/jpeg');
      expect(getContentType('Foo.PnG')).toBe('image/png');
    });
  });

  describe('edge cases', () => {
    it('retorna octet-stream pra extensão desconhecida', () => {
      expect(getContentType('foo.xyz')).toBe('application/octet-stream');
      expect(getContentType('foo.exe')).toBe('application/octet-stream');
    });

    it('retorna octet-stream pra string sem extensão', () => {
      expect(getContentType('noext')).toBe('application/octet-stream');
    });

    it('retorna octet-stream pra string vazia', () => {
      expect(getContentType('')).toBe('application/octet-stream');
    });

    it('usa a extensão FINAL em paths com múltiplos pontos', () => {
      expect(getContentType('archive.tar.gz')).toBe('application/octet-stream');
      expect(getContentType('foo.bar.jpg')).toBe('image/jpeg');
    });
  });
});
