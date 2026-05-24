/**
 * Visual email design — espelho do `src/server/email/design.ts`
 * do projeto principal. Mantemos a cópia aqui pra o admin poder
 * renderizar preview client-side sem precisar bater no servidor
 * a cada keystroke.
 *
 * Se a estrutura mudar no backend, atualizar aqui também. Há
 * teste no backend que valida o output do generator — eventual
 * divergência aparece como preview "errado" no admin mas o email
 * enviado de fato fica certo (server-side regenera).
 */

export type BlockKind =
  | 'heading'
  | 'paragraph'
  | 'button'
  | 'image'
  | 'divider'
  | 'spacer';

export interface BlockHeading {
  id: string;
  kind: 'heading';
  text: string;
  level?: 2 | 3;
}
export interface BlockParagraph {
  id: string;
  kind: 'paragraph';
  text: string;
}
export interface BlockButton {
  id: string;
  kind: 'button';
  text: string;
  href: string;
  align?: 'center' | 'left';
}
export interface BlockImage {
  id: string;
  kind: 'image';
  src: string;
  alt: string;
  width?: number;
}
export interface BlockDivider {
  id: string;
  kind: 'divider';
}
export interface BlockSpacer {
  id: string;
  kind: 'spacer';
  height?: number;
}

export type EmailBlock =
  | BlockHeading
  | BlockParagraph
  | BlockButton
  | BlockImage
  | BlockDivider
  | BlockSpacer;

export interface EmailTheme {
  bgColor: string;
  contentBg: string;
  textColor: string;
  mutedColor: string;
  linkColor: string;
  buttonBg: string;
  buttonText: string;
  buttonRadius: number;
  fontFamily: string;
}

export interface EmailHeader {
  enabled: boolean;
  title: string;
  subtitle?: string;
}

export interface EmailFooter {
  enabled: boolean;
  text: string;
}

export interface EmailDesign {
  version: 1;
  theme: EmailTheme;
  header: EmailHeader;
  blocks: EmailBlock[];
  footer: EmailFooter;
}

export const DEFAULT_THEME: EmailTheme = {
  bgColor: '#f6f6f7',
  contentBg: '#ffffff',
  textColor: '#111111',
  mutedColor: '#888888',
  linkColor: '#000000',
  buttonBg: '#000000',
  buttonText: '#ffffff',
  buttonRadius: 999,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export function newBlockId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/* ──────────────────────────────────────────────────────────────
 * Generator de HTML — espelho do backend pra preview.
 * ────────────────────────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkify(text: string, color: string): string {
  const escaped = esc(text);
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return escaped.replace(
    urlRegex,
    (url) =>
      `<a href="${url}" style="color:${color};text-decoration:underline;">${url}</a>`,
  );
}

function renderBlock(block: EmailBlock, theme: EmailTheme): string {
  switch (block.kind) {
    case 'heading': {
      const level = block.level === 3 ? 3 : 2;
      const size = level === 2 ? 20 : 16;
      return `<tr><td style="padding:0 0 12px;"><h${level} style="margin:0;font-family:${theme.fontFamily};font-size:${size}px;font-weight:700;color:${theme.textColor};line-height:1.3;">${esc(block.text)}</h${level}></td></tr>`;
    }
    case 'paragraph':
      return `<tr><td style="padding:0 0 14px;"><p style="margin:0;font-family:${theme.fontFamily};font-size:15px;line-height:1.55;color:${theme.textColor};">${linkify(block.text, theme.linkColor)}</p></td></tr>`;
    case 'button': {
      const align = block.align === 'left' ? 'left' : 'center';
      return `<tr><td style="padding:18px 0;text-align:${align};"><a href="${esc(block.href)}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};text-decoration:none;font-family:${theme.fontFamily};font-size:15px;font-weight:600;padding:12px 22px;border-radius:${theme.buttonRadius}px;">${esc(block.text)}</a></td></tr>`;
    }
    case 'image': {
      const w = block.width ?? 480;
      return `<tr><td style="padding:8px 0;text-align:center;"><img src="${esc(block.src)}" alt="${esc(block.alt)}" width="${w}" style="max-width:100%;height:auto;display:inline-block;border:0;" /></td></tr>`;
    }
    case 'divider':
      return `<tr><td style="padding:14px 0;"><hr style="border:0;border-top:1px solid #e5e5e5;margin:0;" /></td></tr>`;
    case 'spacer': {
      const h = block.height ?? 16;
      return `<tr><td style="line-height:${h}px;height:${h}px;font-size:1px;">&nbsp;</td></tr>`;
    }
  }
}

function renderHeader(h: EmailHeader, theme: EmailTheme): string {
  if (!h.enabled) return '';
  const sub = h.subtitle
    ? `<p style="margin:6px 0 0;font-family:${theme.fontFamily};font-size:14px;color:${theme.mutedColor};line-height:1.5;">${esc(h.subtitle)}</p>`
    : '';
  return `<tr><td style="padding:0 0 18px;"><h1 style="margin:0;font-family:${theme.fontFamily};font-size:24px;font-weight:700;color:${theme.textColor};line-height:1.25;">${esc(h.title)}</h1>${sub}</td></tr>`;
}

function renderFooter(f: EmailFooter, theme: EmailTheme): string {
  if (!f.enabled) return '';
  return `<tr><td style="padding:28px 0 0;border-top:1px solid #ececec;"><p style="margin:18px 0 0;font-family:${theme.fontFamily};font-size:12px;color:${theme.mutedColor};line-height:1.5;">${esc(f.text)}</p></td></tr>`;
}

/** Gera HTML completo pro preview client-side. */
export function designToHtml(design: EmailDesign): string {
  const { theme } = design;
  const blocks = design.blocks.map((b) => renderBlock(b, theme)).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;padding:0;background:${theme.bgColor};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${theme.bgColor};"><tr><td align="center" style="padding:32px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background:${theme.contentBg};border-radius:12px;"><tr><td style="padding:32px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${renderHeader(design.header, theme)}${blocks}${renderFooter(design.footer, theme)}</table></td></tr></table></td></tr></table></body></html>`;
}

/** Substitui {{vars}} por valores fictícios pra preview. */
export function interpolatePreview(
  html: string,
  variables: { name: string }[],
): string {
  const fakes: Record<string, string> = {
    magicUrl: 'https://example.com/preview',
    code: '123456',
    email: 'usuario@example.com',
    userName: 'João',
  };
  let out = html;
  for (const v of variables) {
    const replacement = fakes[v.name] ?? `[${v.name}]`;
    out = out.replaceAll(`{{${v.name}}}`, replacement);
  }
  return out;
}
