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

/* Boas-vindas — disparado UMA VEZ no momento da criação de conta
 * (POST /api/auth/request quando o usuário é INSERT). Carrega o
 * próprio magic link + código OTP do primeiro acesso, então o
 * usuário recebe UM email único de cadastro+acesso. */
function welcomeDefaultDesign(): EmailDesign {
  return {
    version: 1,
    theme: {
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
    },
    header: {
      enabled: true,
      title: 'Bem-vindo ao Fanverse, {{userName}}!',
      subtitle: 'A casa dos superfãs.',
    },
    blocks: [
      {
        id: 'welcome-1',
        kind: 'paragraph',
        text: 'É um prazer ter você por aqui. O Fanverse é o seu espaço pra acompanhar a artista, conhecer outros fãs e participar de momentos exclusivos.',
      },
      {
        id: 'welcome-2',
        kind: 'paragraph',
        text: 'Clique no botão abaixo pra entrar pela primeira vez. O link expira em 15 minutos e só pode ser usado uma vez.',
      },
      {
        id: 'welcome-3',
        kind: 'button',
        text: 'Entrar no Fanverse',
        href: '{{magicUrl}}',
        align: 'center',
      },
      {
        id: 'welcome-4',
        kind: 'paragraph',
        text: 'Ou digite o código no app: {{code}}',
      },
      {
        id: 'welcome-5',
        kind: 'paragraph',
        text: 'Qualquer dúvida, é só responder este email.',
      },
    ],
    footer: {
      enabled: false,
      text: '',
    },
  };
}

/* Resumo diário — disparado pelo cron noturno (23h59) com saldo
 * de fanpoints do dia, distância pro próximo tier e highlights
 * perdidos. Block longo: header + 3 paragraphs de stat + button
 * "Abrir o app" + paragraph de "destaques do dia". */
function dailyDigestDefaultDesign(): EmailDesign {
  return {
    version: 1,
    theme: {
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
    },
    header: {
      enabled: true,
      title: 'Seu dia no Fanverse, {{userName}}',
      subtitle: 'Resumo de {{dateLabel}}',
    },
    blocks: [
      {
        id: 'digest-1',
        kind: 'paragraph',
        text: 'Você ganhou <b>{{pointsToday}} fanpoints</b> hoje — seu saldo atual é <b>{{totalPoints}}</b>.',
      },
      {
        id: 'digest-2',
        kind: 'paragraph',
        text: '<i>Faltam {{pointsToNext}} pontos pra você entrar no {{nextTierLabel}}.</i>',
      },
      {
        id: 'digest-3',
        kind: 'paragraph',
        text: '<b>Você perdeu hoje:</b><br/>{{missedHighlights}}',
      },
      {
        id: 'digest-4',
        kind: 'button',
        text: 'Voltar pro Fanverse',
        href: '{{appUrl}}',
        align: 'center',
      },
      {
        id: 'digest-5',
        kind: 'paragraph',
        text: 'Até amanhã. 👋',
      },
    ],
    footer: {
      enabled: false,
      text: '',
    },
  };
}

/* Nova mensagem direta — dispara em TODA DM no Fanverse, online
 * ou não. Email mostra snippet + CTA pra abrir a conversa. */
function newDmDefaultDesign(): EmailDesign {
  return {
    version: 1,
    theme: {
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
    },
    header: {
      enabled: true,
      title: 'Você tem uma nova mensagem',
      subtitle: 'De {{senderName}} no Fanverse.',
    },
    blocks: [
      {
        id: 'newdm-1',
        kind: 'paragraph',
        text: '{{senderName}} te mandou uma mensagem no Fanverse:',
      },
      {
        id: 'newdm-2',
        kind: 'paragraph',
        text: '<i>“{{messageSnippet}}”</i>',
      },
      {
        id: 'newdm-3',
        kind: 'button',
        text: 'Abrir conversa',
        href: '{{conversationUrl}}',
        align: 'center',
      },
      {
        id: 'newdm-4',
        kind: 'paragraph',
        text: 'Se você está recebendo muitas dessas, vale silenciar nas configurações da conta.',
      },
    ],
    footer: {
      enabled: false,
      text: '',
    },
  };
}

export const KNOWN_TEMPLATES: KnownTemplate[] = [
  {
    kind: 'boas_vindas',
    label: 'Boas-vindas',
    description:
      'Disparado uma única vez no momento da criação de conta — quando ' +
      'o endpoint /api/auth/request faz o INSERT do usuário. Carrega o ' +
      'próprio magic link + código OTP do primeiro acesso, então o ' +
      'usuário recebe UM único email de cadastro+acesso. Idempotente ' +
      'via claim atômico em welcomeEmailSentAt.',
    variables: [
      { name: 'userName', description: 'Nome do usuário (display name)' },
      { name: 'magicUrl', description: 'URL completa pro botão "Entrar"' },
      { name: 'code', description: 'Código OTP de 6 dígitos (sem espaços)' },
    ],
    defaultSubject: 'Bem-vindo ao Fanverse, {{userName}}!',
    defaultHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">Bem-vindo ao Fanverse, {{userName}}!</h1>
  <p style="font-size:15px;line-height:1.55;color:#333;">É um prazer ter você por aqui. Clique no botão abaixo pra entrar pela primeira vez — o link expira em 15 minutos.</p>
  <p style="margin:28px 0;"><a href="{{magicUrl}}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">Entrar no Fanverse</a></p>
  <div style="margin:32px 0;padding:20px;background:#f6f6f7;border-radius:12px;text-align:center;">
    <p style="font-size:13px;color:#666;margin:0 0 8px;">Ou digite este código no app:</p>
    <p style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:0.2em;color:#111;margin:0;">{{code}}</p>
  </div>
</div>`,
    defaultDesign: welcomeDefaultDesign(),
  },
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
  <p style="font-size: 12px; color: #aaa; margin-top: 32px;">Se você não pediu este email, ignore.</p>
</div>`,
    defaultDesign: magicLinkDefaultDesign(),
  },
  {
    kind: 'new_dm',
    label: 'Nova mensagem direta',
    description:
      'Disparado quando alguém te manda DM no Fanverse. Vai pra TODO ' +
      'destinatário (online ou não) por padrão — admin pode desligar ' +
      'o canal email em /notificacoes/new_dm pra silenciar.',
    variables: [
      { name: 'senderName', description: 'Nome de quem mandou a mensagem' },
      { name: 'messageSnippet', description: 'Trecho da mensagem (até 200 chars)' },
      { name: 'conversationUrl', description: 'URL que abre a conversa específica no app' },
    ],
    defaultSubject: 'Nova mensagem de {{senderName}} no Fanverse',
    defaultHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">Você tem uma nova mensagem</h1>
  <p style="font-size:15px;line-height:1.55;color:#333;"><b>{{senderName}}</b> te mandou uma mensagem no Fanverse:</p>
  <blockquote style="margin:20px 0;padding:14px 16px;background:#f6f6f7;border-left:3px solid #111;border-radius:6px;font-size:14.5px;line-height:1.5;color:#222;font-style:italic;">{{messageSnippet}}</blockquote>
  <p style="margin:28px 0;"><a href="{{conversationUrl}}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">Abrir conversa</a></p>
  <p style="font-size:12px;color:#888;margin-top:32px;">Se você está recebendo muitas dessas, dá pra silenciar nas configurações da conta.</p>
</div>`,
    defaultDesign: newDmDefaultDesign(),
  },
  {
    kind: 'daily_digest',
    label: 'Resumo diário',
    description:
      'Email noturno (23h59) com resumo do dia: fanpoints ganhos, ' +
      'distância pro próximo nível e destaques perdidos. Vai pra ' +
      'todos os usuários enquanto a base é pequena.',
    variables: [
      { name: 'userName', description: 'Nome do usuário (display name)' },
      { name: 'dateLabel', description: 'Data do dia em formato curto (ex: "25 mai")' },
      { name: 'pointsToday', description: 'Fanpoints ganhos no dia (número)' },
      { name: 'totalPoints', description: 'Saldo total de fanpoints' },
      { name: 'nextTierLabel', description: 'Próximo tier (ex: "Top 50")' },
      { name: 'pointsToNext', description: 'Quantos pontos faltam pro próximo tier' },
      { name: 'missedHighlights', description: 'Lista HTML <br>-separada do que o user perdeu' },
      { name: 'appUrl', description: 'URL pra voltar ao /app' },
    ],
    defaultSubject: 'Seu dia no Fanverse · {{pointsToday}} fanpoints novos',
    defaultHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">Seu dia no Fanverse, {{userName}}</h1>
  <p style="font-size:13px;color:#888;margin:0 0 20px;">Resumo de {{dateLabel}}</p>
  <p style="font-size:15px;line-height:1.55;color:#333;">Você ganhou <b>{{pointsToday}} fanpoints</b> hoje — seu saldo atual é <b>{{totalPoints}}</b>.</p>
  <p style="font-size:15px;line-height:1.55;color:#333;font-style:italic;">Faltam {{pointsToNext}} pontos pra você entrar no {{nextTierLabel}}.</p>
  <div style="margin:20px 0;padding:14px 16px;background:#f6f6f7;border-radius:10px;font-size:14px;line-height:1.55;color:#222;">
    <p style="margin:0 0 8px;font-weight:600;">Você perdeu hoje:</p>
    <div>{{missedHighlights}}</div>
  </div>
  <p style="margin:28px 0;text-align:center;"><a href="{{appUrl}}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">Voltar pro Fanverse</a></p>
  <p style="font-size:12px;color:#888;margin-top:24px;">Até amanhã. 👋</p>
</div>`,
    defaultDesign: dailyDigestDefaultDesign(),
  },
];

export function getKnownTemplate(kind: string): KnownTemplate | null {
  return KNOWN_TEMPLATES.find((t) => t.kind === kind) ?? null;
}
