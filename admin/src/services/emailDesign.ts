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
  /** Logo do template — sobrescreve o brand.logoUrl global. */
  logoUrl?: string;
  /** Altura em pixels (default 40). */
  logoHeight?: number;
}

export interface BrandSocialLink {
  platform: string;
  url: string;
  label?: string;
}

export interface BrandFooterLink {
  label: string;
  url: string;
}

export interface BrandSettings {
  logoUrl?: string;
  brandName?: string;
  siteUrl?: string;
  addressLine?: string;
  copyrightLine?: string;
  links?: BrandFooterLink[];
  socials?: BrandSocialLink[];
  showRecipientNote?: boolean;
  bgColor?: string;
  textColor?: string;
  linkColor?: string;
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

function renderHeader(
  h: EmailHeader,
  theme: EmailTheme,
  brand?: BrandSettings,
): string {
  if (!h.enabled) return '';
  const logoUrl = h.logoUrl ?? brand?.logoUrl;
  const logoH = h.logoHeight ?? 40;
  const logo = logoUrl
    ? `<div style="text-align:center;padding:0 0 18px;"><img src="${esc(logoUrl)}" alt="${esc(brand?.brandName ?? 'Logo')}" height="${logoH}" style="height:${logoH}px;width:auto;max-width:240px;display:inline-block;border:0;" /></div>`
    : '';
  const sub = h.subtitle
    ? `<p style="margin:6px 0 0;font-family:${theme.fontFamily};font-size:14px;color:${theme.mutedColor};line-height:1.5;">${esc(h.subtitle)}</p>`
    : '';
  return `<tr><td style="padding:0 0 18px;">${logo}<h1 style="margin:0;font-family:${theme.fontFamily};font-size:24px;font-weight:700;color:${theme.textColor};line-height:1.25;">${esc(h.title)}</h1>${sub}</td></tr>`;
}

function renderFooter(f: EmailFooter, theme: EmailTheme): string {
  if (!f.enabled) return '';
  return `<tr><td style="padding:28px 0 0;border-top:1px solid #ececec;"><p style="margin:18px 0 0;font-family:${theme.fontFamily};font-size:12px;color:${theme.mutedColor};line-height:1.5;">${esc(f.text)}</p></td></tr>`;
}

/* SVG inline dos ícones — espelhado do backend pra preview ficar
 * 1:1 com o que vai sair no email final. */
const SOCIAL_ICONS: Record<string, string> = {
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>',
  twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  youtube: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-0z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>',
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  website: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

function renderBrandFooter(brand: BrandSettings | null | undefined): string {
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

  return `<tr><td style="padding:28px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};border-radius:12px;"><tr><td style="padding:24px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${socialsHtml}${siteHtml}${linksHtml}${addressHtml}${copyrightHtml}</table></td></tr></table></td></tr>`;
}

/** Gera HTML completo pro preview client-side, opcionalmente
 *  com brand settings (logo no header + brand footer). */
export function designToHtml(
  design: EmailDesign,
  brand: BrandSettings | null = null,
): string {
  const { theme } = design;
  const blocks = design.blocks.map((b) => renderBlock(b, theme)).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;padding:0;background:${theme.bgColor};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${theme.bgColor};"><tr><td align="center" style="padding:32px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background:${theme.contentBg};border-radius:12px;"><tr><td style="padding:32px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${renderHeader(design.header, theme, brand ?? undefined)}${blocks}${renderFooter(design.footer, theme)}${renderBrandFooter(brand)}</table></td></tr></table></td></tr></table></body></html>`;
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
