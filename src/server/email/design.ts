/**
 * Visual email design — estrutura de dados que o editor manipula
 * + gerador determinístico de HTML.
 *
 * Por que existe: o admin de gestão não escreve HTML. O editor
 * visual produz um `EmailDesign` (JSON tipado) que esta função
 * traduz num HTML responsivo, compatível com Gmail/Outlook,
 * usando tabelas + inline styles (regra básica de email
 * marketing).
 *
 * Determinístico: sempre que rodar com o mesmo design, gera
 * exatamente o mesmo HTML. Mudanças aqui são versionadas via
 * git — não há "estilo personalizado" arbitrário fora da grade
 * de blocos.
 *
 * Variáveis `{{var}}` permanecem intactas no output — só são
 * substituídas no `sendEmail` (interpolate function).
 *
 * Compatibilidade de email clients:
 *   - Tudo via <table> aninhada (única coisa que Outlook web
 *     respeita 100%).
 *   - Estilos sempre inline (Gmail strip <style> em alguns
 *     casos).
 *   - Padding via cellpadding/padding inline.
 *   - Imagens com width fixo no atributo (Outlook ignora width
 *     CSS).
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
  /** 2 | 3 — h1 é reservado pro header do template. */
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
  /** URL ou {{var}}. Default {{magicUrl}} pro magic link. */
  href: string;
  /** Centro (default) ou alinhado à esquerda. */
  align?: 'center' | 'left';
}
export interface BlockImage {
  id: string;
  kind: 'image';
  src: string;
  alt: string;
  /** Largura máxima em px. Default 480 (fit do container). */
  width?: number;
}
export interface BlockDivider {
  id: string;
  kind: 'divider';
}
export interface BlockSpacer {
  id: string;
  kind: 'spacer';
  /** Em pixels. Default 16. */
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
  /** Cor de fundo da página inteira (gmail/outlook canvas). */
  bgColor: string;
  /** Cor de fundo do bloco de conteúdo (card centralizado). */
  contentBg: string;
  /** Cor do texto principal. */
  textColor: string;
  /** Cor de textos secundários (footer, captions). */
  mutedColor: string;
  /** Cor dos links e elementos de destaque. */
  linkColor: string;
  /** Cor de fundo do botão CTA. */
  buttonBg: string;
  /** Cor do texto do botão CTA. */
  buttonText: string;
  /** Border-radius do botão (px). */
  buttonRadius: number;
  /** Família de fontes (web-safe). */
  fontFamily: string;
}

export interface EmailHeader {
  enabled: boolean;
  /** Título principal (h1 dentro do email). */
  title: string;
  /** Subtítulo opcional embaixo do título. */
  subtitle?: string;
}

export interface EmailFooter {
  enabled: boolean;
  /** Texto fine-print (copyright, instruções de unsubscribe, etc). */
  text: string;
}

export interface EmailDesign {
  /** Versão do schema — pra migração futura sem quebrar templates
   *  antigos. Hoje sempre 1. */
  version: 1;
  theme: EmailTheme;
  header: EmailHeader;
  blocks: EmailBlock[];
  footer: EmailFooter;
}

/* ──────────────────────────────────────────────────────────────
 * Defaults — usados pra criar um design "vazio" sensato quando
 * o admin abre o visual editor pela primeira vez.
 * ────────────────────────────────────────────────────────────── */

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

export function emptyDesign(): EmailDesign {
  return {
    version: 1,
    theme: { ...DEFAULT_THEME },
    header: { enabled: true, title: 'Título do email' },
    blocks: [
      {
        id: cryptoId(),
        kind: 'paragraph',
        text: 'Edite este texto com a mensagem principal.',
      },
    ],
    footer: {
      enabled: true,
      text: 'Se você não pediu este email, ignore.',
    },
  };
}

/** ID curto pra blocos — só pro React key. Não persiste vínculo
 *  semântico. Aceitável usar Math.random() porque os blocos vivem
 *  num único array em memória — colisão é catastrófica se
 *  acontecer mas é estatisticamente impossível em N < 1000. */
export function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/* ──────────────────────────────────────────────────────────────
 * Gerador de HTML — input EmailDesign → output string HTML.
 * ────────────────────────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Linkifica URLs nuas em texto livre. Mantém `{{var}}` intactos. */
function linkify(text: string, color: string): string {
  // Escape primeiro, depois converte URLs em <a>.
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
      return `
<tr><td style="padding:0 0 12px;">
  <h${level} style="margin:0;font-family:${theme.fontFamily};font-size:${size}px;font-weight:700;color:${theme.textColor};line-height:1.3;">${esc(block.text)}</h${level}>
</td></tr>`;
    }

    case 'paragraph':
      return `
<tr><td style="padding:0 0 14px;">
  <p style="margin:0;font-family:${theme.fontFamily};font-size:15px;line-height:1.55;color:${theme.textColor};">${linkify(block.text, theme.linkColor)}</p>
</td></tr>`;

    case 'button': {
      const align = block.align === 'left' ? 'left' : 'center';
      return `
<tr><td style="padding:18px 0;text-align:${align};">
  <a href="${esc(block.href)}"
     style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};text-decoration:none;font-family:${theme.fontFamily};font-size:15px;font-weight:600;padding:12px 22px;border-radius:${theme.buttonRadius}px;">
    ${esc(block.text)}
  </a>
</td></tr>`;
    }

    case 'image': {
      const w = block.width ?? 480;
      return `
<tr><td style="padding:8px 0;text-align:center;">
  <img src="${esc(block.src)}" alt="${esc(block.alt)}" width="${w}" style="max-width:100%;height:auto;display:inline-block;border:0;" />
</td></tr>`;
    }

    case 'divider':
      return `
<tr><td style="padding:14px 0;">
  <hr style="border:0;border-top:1px solid #e5e5e5;margin:0;" />
</td></tr>`;

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
  return `
<tr><td style="padding:0 0 18px;">
  <h1 style="margin:0;font-family:${theme.fontFamily};font-size:24px;font-weight:700;color:${theme.textColor};line-height:1.25;">${esc(h.title)}</h1>
  ${sub}
</td></tr>`;
}

function renderFooter(f: EmailFooter, theme: EmailTheme): string {
  if (!f.enabled) return '';
  return `
<tr><td style="padding:28px 0 0;border-top:1px solid #ececec;">
  <p style="margin:18px 0 0;font-family:${theme.fontFamily};font-size:12px;color:${theme.mutedColor};line-height:1.5;">${esc(f.text)}</p>
</td></tr>`;
}

/** Gera o HTML final a partir do design. */
export function designToHtml(design: EmailDesign): string {
  const { theme } = design;
  const blocks = design.blocks.map((b) => renderBlock(b, theme)).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:${theme.bgColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${theme.bgColor};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background:${theme.contentBg};border-radius:12px;">
        <tr><td style="padding:32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${renderHeader(design.header, theme)}
            ${blocks}
            ${renderFooter(design.footer, theme)}
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ──────────────────────────────────────────────────────────────
 * Default design por kind conhecido. Quando o admin abre o
 * editor visual pela primeira vez (sem `design` salvo no DB),
 * carregamos este preset que reproduz vagamente o template
 * hardcoded — ao invés de partir de tela em branco.
 * ────────────────────────────────────────────────────────────── */

export function magicLinkDefaultDesign(): EmailDesign {
  return {
    version: 1,
    theme: { ...DEFAULT_THEME },
    header: {
      enabled: true,
      title: 'Seu acesso ao Fanverse',
    },
    blocks: [
      {
        id: cryptoId(),
        kind: 'paragraph',
        text: 'Clique no botão abaixo pra entrar. O link expira em 15 minutos e só pode ser usado uma vez.',
      },
      {
        id: cryptoId(),
        kind: 'button',
        text: 'Entrar no Fanverse',
        href: '{{magicUrl}}',
        align: 'center',
      },
      {
        id: cryptoId(),
        kind: 'paragraph',
        text: 'Ou digite este código no app: {{code}}',
      },
    ],
    footer: {
      enabled: true,
      text: 'Se você não pediu este email, ignore.',
    },
  };
}
