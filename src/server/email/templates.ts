/**
 * Email templates — leitura/escrita do registro editável que o
 * admin gerencia.
 *
 * Pattern: a função `getTemplate(kind)` é o read-side. Quem
 * monta o email (ex: `sendMagicLink`) chama isto, e SE o registro
 * existir e `is_active=true`, usa o subject/html do DB. Caso
 * contrário cai pro hardcoded em código — kill switch tranquilo.
 *
 * Interpolação de variáveis: usamos `{{nome}}` (mustache-light).
 * `interpolate(html, vars)` substitui ocorrências. Variáveis não
 * conhecidas ficam intactas — facilita debug ("achei {{xyz}} no
 * email enviado, falta passar essa var").
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { emailTemplates, type EmailTemplate } from '../db/schema';
import type { EmailDesign } from './design';
import { magicLinkDefaultDesign } from './design';

export interface GetTemplateOptions {
  kind: string;
}

/** Lê um template do DB. Retorna null se não existe, ou se
 *  `is_active=false` — caller deve fazer fallback pro hardcoded. */
export async function getTemplate(kind: string): Promise<EmailTemplate | null> {
  const rows = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.kind, kind))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!row.isActive) return null;
  return row;
}

/** Lista todos os templates pro admin. Inclui inativos. */
export async function listTemplates(): Promise<EmailTemplate[]> {
  return await db
    .select()
    .from(emailTemplates)
    .orderBy(emailTemplates.kind);
}

export interface UpsertTemplateInput {
  kind: string;
  /** Nome amigável (editável pelo admin). Quando null, GET usa
   *  fallback do KNOWN_TEMPLATES.label. */
  label?: string | null;
  subject: string;
  html: string;
  isActive: boolean;
  description?: string | null;
  /** Quando setado, indica que o template foi editado via editor
   *  visual e o `html` foi gerado a partir desta estrutura. Null
   *  = template editado em HTML cru. */
  design?: EmailDesign | null;
  updatedBy: string;
}

/** Cria ou atualiza o template (upsert por `kind`). */
export async function upsertTemplate(
  input: UpsertTemplateInput,
): Promise<EmailTemplate> {
  const rows = await db
    .insert(emailTemplates)
    .values({
      kind: input.kind,
      label: input.label ?? null,
      subject: input.subject,
      html: input.html,
      design: (input.design ?? null) as unknown as Record<string, unknown> | null,
      isActive: input.isActive,
      description: input.description ?? null,
      updatedBy: input.updatedBy,
    })
    .onConflictDoUpdate({
      target: emailTemplates.kind,
      set: {
        label: input.label ?? null,
        subject: input.subject,
        html: input.html,
        design: (input.design ?? null) as unknown as Record<string, unknown> | null,
        isActive: input.isActive,
        description: input.description ?? null,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0];
}

/**
 * Substitui ocorrências de `{{varName}}` no template por valores.
 * Vars não-conhecidas ficam intactas pro debug ser óbvio.
 *
 * Não escapa HTML — assume que os valores são plain-text confiáveis
 * (vindo do servidor, não input do usuário). Se um dia precisar
 * passar conteúdo arbitrário, trocar `value` por escape básico.
 */
export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return name in vars ? vars[name] : match;
  });
}

/**
 * Lista de templates "conhecidos" — usado pelo admin pra mostrar
 * placeholders mesmo antes do dev backend gravar a primeira
 * versão. Cada entry tem o `kind`, label legível, descrição e as
 * variáveis que aquele template aceita.
 *
 * Quando o código adiciona um novo email do sistema, vem cadastrar
 * aqui pra aparecer no admin. Não precisa de migration pra cada um.
 */
export interface KnownTemplate {
  kind: string;
  label: string;
  description: string;
  variables: { name: string; description: string }[];
  /** Subject default — usado quando o admin clica "criar template". */
  defaultSubject: string;
  /** HTML default — base pro admin editar em modo HTML cru. */
  defaultHtml: string;
  /** Design default — base pro editor visual. Quando o admin
   *  abre o editor visual pela primeira vez sem `design` salvo,
   *  carregamos este preset. */
  defaultDesign: EmailDesign;
}

export const KNOWN_TEMPLATES: KnownTemplate[] = [
  {
    kind: 'magic_link',
    label: 'Link de acesso (magic link)',
    description:
      'Disparado quando o usuário pede pra entrar via email. Inclui ' +
      'link clicável + código OTP de 6 dígitos como fallback.',
    variables: [
      { name: 'magicUrl', description: 'URL completa pro botão "Entrar"' },
      { name: 'code', description: 'Código OTP de 6 dígitos (sem espaços)' },
    ],
    defaultSubject: 'Seu link de acesso ao Fanverse',
    defaultHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Seu acesso ao Fanverse</h1>
  <p style="font-size: 15px; line-height: 1.55; color: #333;">
    Clique no botão abaixo pra entrar. O link expira em 15 minutos e só pode ser usado uma vez.
  </p>
  <p style="margin: 28px 0;">
    <a href="{{magicUrl}}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 600;">
      Entrar no Fanverse
    </a>
  </p>
  <div style="margin: 32px 0; padding: 20px; background: #f6f6f7; border-radius: 12px; text-align: center;">
    <p style="font-size: 13px; color: #666; margin: 0 0 8px;">Ou digite este código no app:</p>
    <p style="font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: #111; margin: 0;">{{code}}</p>
  </div>
  <p style="font-size: 13px; color: #888;">
    Se o botão não funcionar, copie e cole este link no navegador:<br/>
    <span style="word-break: break-all;">{{magicUrl}}</span>
  </p>
  <p style="font-size: 12px; color: #aaa; margin-top: 32px;">Se você não pediu este email, ignore.</p>
</div>`,
    defaultDesign: magicLinkDefaultDesign(),
  },
];

export function getKnownTemplate(kind: string): KnownTemplate | null {
  return KNOWN_TEMPLATES.find((t) => t.kind === kind) ?? null;
}
