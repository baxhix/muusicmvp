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
  /** HTML limitado: pode conter <strong>, <b>, <br>, <br/>, <i>,
   *  <em>. Qualquer outra tag é stripada no renderer. URLs em
   *  texto livre viram <a> automaticamente. */
  text: string;
  align?: 'left' | 'center' | 'right' | 'justify';
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
  /** URL absoluta do logotipo. Quando setado, renderiza antes do
   *  título centralizado. Altura padrão 40px (max-width 200). */
  logoUrl?: string;
  /** Altura do logo em pixels. Default 40. */
  logoHeight?: number;
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
 * Brand settings — config global aplicada a todos os emails.
 * Renderiza um bloco institucional após o footer do template
 * (com logo, links de site, redes sociais, copyright).
 * ────────────────────────────────────────────────────────────── */

export interface BrandSocialLink {
  /** Identifica o ícone que vai renderizar:
   *  'instagram' | 'twitter' | 'youtube' | 'tiktok' | 'facebook' |
   *  'linkedin' | 'website'. */
  platform: string;
  url: string;
  label?: string;
}

export interface BrandFooterLink {
  label: string;
  url: string;
}

export interface BrandSettings {
  /** URL do logotipo usado no header de todos os templates.
   *  Templates podem override por design.header.logoUrl. */
  logoUrl?: string;
  /** Nome da marca exibido no brand footer. */
  brandName?: string;
  /** Site institucional. Vira link clicável + aparece embaixo. */
  siteUrl?: string;
  /** Endereço físico / linha legal (CAN-SPAM exige nos EUA;
   *  Brasil é boa prática pra reduzir spam score). */
  addressLine?: string;
  /** Linha de copyright. Default "© {ano} {brandName}". */
  copyrightLine?: string;
  /** Links de navegação no footer (ex.: termos, privacidade,
   *  ajuda). Aparecem em linha separados por · */
  links?: BrandFooterLink[];
  /** Redes sociais. Renderizam como botões redondos com ícone. */
  socials?: BrandSocialLink[];
  /** Quando true, mostra "Você está recebendo porque..." */
  showRecipientNote?: boolean;
  /** Cor de fundo do brand footer (cinza claro default). */
  bgColor?: string;
  /** Cor do texto do brand footer. */
  textColor?: string;
  /** Cor de hover/link do brand footer. */
  linkColor?: string;
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

/* Tags permitidas no texto de paragraphs (input vem do editor
 * visual). Allowlist estrito — defesa em profundidade contra XSS
 * mesmo que o admin tenha sessão válida. */
const PARAGRAPH_ALLOWED_TAG = /^<\/?(strong|b|br|i|em)\s*\/?>$/i;

/**
 * Sanitiza + linkifica o texto de paragraph:
 *   - mantém só tags allowlisted (strong/b/br/i/em) sem attrs
 *   - escapa o resto do conteúdo como HTML
 *   - linkifica URLs em texto livre
 */
function formatParagraphHtml(text: string, linkColor: string): string {
  // Quebra em tokens: <tag> ou texto livre.
  const tokens = text.split(/(<[^>]+>)/);
  return tokens
    .map((token) => {
      if (token.startsWith('<') && token.endsWith('>')) {
        if (!PARAGRAPH_ALLOWED_TAG.test(token)) return '';
        // Normaliza pra lowercase + remove possíveis atributos.
        const lower = token.toLowerCase();
        const m = lower.match(/^<(\/?)(strong|b|br|i|em)\s*\/?>$/);
        if (!m) return '';
        const [, slash, name] = m;
        if (name === 'br') return '<br/>';
        return `<${slash}${name}>`;
      }
      return linkify(token, linkColor);
    })
    .join('');
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

    case 'paragraph': {
      const align = block.align ?? 'left';
      return `
<tr><td style="padding:0 0 14px;text-align:${align};">
  <p style="margin:0;font-family:${theme.fontFamily};font-size:15px;line-height:1.55;color:${theme.textColor};text-align:${align};">${formatParagraphHtml(block.text, theme.linkColor)}</p>
</td></tr>`;
    }

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

function renderHeader(
  h: EmailHeader,
  theme: EmailTheme,
  brand?: BrandSettings,
): string {
  if (!h.enabled) return '';
  // Logo: priority pra design.header.logoUrl (override por
  // template); fallback pro brand.logoUrl (global). Quando nem
  // um nem outro, nada renderiza.
  const logoUrl = h.logoUrl ?? brand?.logoUrl;
  const logoH = h.logoHeight ?? 40;
  const logo = logoUrl
    ? `<div style="text-align:center;padding:0 0 18px;"><img src="${esc(logoUrl)}" alt="${esc(brand?.brandName ?? 'Logo')}" height="${logoH}" style="height:${logoH}px;width:auto;max-width:240px;display:inline-block;border:0;" /></div>`
    : '';
  const sub = h.subtitle
    ? `<p style="margin:6px 0 0;font-family:${theme.fontFamily};font-size:14px;color:${theme.mutedColor};line-height:1.5;">${esc(h.subtitle)}</p>`
    : '';
  return `
<tr><td style="padding:0 0 18px;">
  ${logo}
  <h1 style="margin:0;font-family:${theme.fontFamily};font-size:24px;font-weight:700;color:${theme.textColor};line-height:1.25;">${esc(h.title)}</h1>
  ${sub}
</td></tr>`;
}

/* ──────────────────────────────────────────────────────────────
 * Brand footer — bloco institucional renderizado DEPOIS do footer
 * do template. Sempre presente em todos os emails quando o admin
 * configurou em `email_brand_settings`.
 *
 * Ícones de social inline em SVG (clientes de email são caprichosos
 * com SVG, mas inline + size fixo + viewBox simples passa em
 * Gmail/Outlook).
 * ────────────────────────────────────────────────────────────── */

const SOCIAL_ICONS: Record<string, string> = {
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>',
  twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  youtube: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-0z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>',
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  website: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

export function renderBrandFooter(brand: BrandSettings | null): string {
  if (!brand) return '';
  const hasContent =
    brand.brandName ||
    brand.siteUrl ||
    brand.addressLine ||
    brand.copyrightLine ||
    (brand.links && brand.links.length > 0) ||
    (brand.socials && brand.socials.length > 0);
  if (!hasContent) return '';

  const bg = brand.bgColor ?? '#f6f6f7';
  const text = brand.textColor ?? '#888888';
  const link = brand.linkColor ?? '#555555';

  const socialsHtml =
    brand.socials && brand.socials.length > 0
      ? `<tr><td style="padding:6px 0 12px;text-align:center;">${brand.socials
          .map((s) => {
            const icon = SOCIAL_ICONS[s.platform] ?? SOCIAL_ICONS.website;
            return `<a href="${esc(s.url)}" style="display:inline-block;margin:0 6px;color:${link};text-decoration:none;" aria-label="${esc(s.label ?? s.platform)}">${icon.replace('currentColor', link)}</a>`;
          })
          .join('')}</td></tr>`
      : '';

  const linksHtml =
    brand.links && brand.links.length > 0
      ? `<tr><td style="padding:6px 0;text-align:center;font-size:12px;color:${text};">${brand.links
          .map(
            (l, i) =>
              `${i > 0 ? `<span style="color:${text};opacity:0.4;margin:0 8px;">·</span>` : ''}<a href="${esc(l.url)}" style="color:${link};text-decoration:none;">${esc(l.label)}</a>`,
          )
          .join('')}</td></tr>`
      : '';

  const siteHtml = brand.siteUrl
    ? `<tr><td style="padding:6px 0 4px;text-align:center;font-size:13px;font-weight:600;"><a href="${esc(brand.siteUrl)}" style="color:${link};text-decoration:none;">${esc(brand.brandName ?? brand.siteUrl)}</a></td></tr>`
    : brand.brandName
      ? `<tr><td style="padding:6px 0 4px;text-align:center;font-size:13px;font-weight:600;color:${text};">${esc(brand.brandName)}</td></tr>`
      : '';

  const addressHtml = brand.addressLine
    ? `<tr><td style="padding:4px 0;text-align:center;font-size:11px;color:${text};line-height:1.5;">${esc(brand.addressLine)}</td></tr>`
    : '';

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightLine ?? `© ${year} ${brand.brandName ?? ''}`.trim();
  const copyrightHtml = copyright
    ? `<tr><td style="padding:8px 0 0;text-align:center;font-size:11px;color:${text};opacity:0.7;">${esc(copyright)}</td></tr>`
    : '';

  return `
<tr><td style="padding:28px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};border-radius:12px;">
    <tr><td style="padding:24px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        ${socialsHtml}
        ${siteHtml}
        ${linksHtml}
        ${addressHtml}
        ${copyrightHtml}
      </table>
    </td></tr>
  </table>
</td></tr>`;
}

function renderFooter(f: EmailFooter, theme: EmailTheme): string {
  if (!f.enabled) return '';
  return `
<tr><td style="padding:28px 0 0;border-top:1px solid #ececec;">
  <p style="margin:18px 0 0;font-family:${theme.fontFamily};font-size:12px;color:${theme.mutedColor};line-height:1.5;">${esc(f.text)}</p>
</td></tr>`;
}

/** Gera o HTML final a partir do design + brand settings (opcional).
 *
 * Quando `brand` é passado:
 *   - O logo do brand é usado no header se o template não tiver
 *     logo próprio (design.header.logoUrl).
 *   - O brand footer renderiza ABAIXO do footer do template
 *     (não substitui — preserva o aviso específico tipo "se você
 *     não pediu, ignore").
 */
export function designToHtml(
  design: EmailDesign,
  brand: BrandSettings | null = null,
): string {
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
            ${renderHeader(design.header, theme, brand ?? undefined)}
            ${blocks}
            ${renderFooter(design.footer, theme)}
            ${renderBrandFooter(brand)}
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
