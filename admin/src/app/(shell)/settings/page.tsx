'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconCheck,
  IconKey,
  IconLink,
  IconTrash,
  IconDownload,
} from '@/components/icons';
import { teamService } from '@/services/team';
import { integrationsService } from '@/services/integrations';
import { apiKeysService } from '@/services/apiKeys';
import { billingService, workspaceService } from '@/services/billing';
import { siteTagsService } from '@/services/siteTags';
import type {
  ApiKey,
  BillingInvoice,
  BillingPlan,
  Integration,
  SiteTag,
  SiteTagKind,
  TeamMember,
  TeamRole,
  WorkspaceSettings,
} from '@/types';
import { formatBRL, formatDate, formatRelative } from '@/lib/format';
import styles from './page.module.css';

type SettingsTab = 'general' | 'team' | 'integrations' | 'tags' | 'billing' | 'apiKeys';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general',      label: 'Geral' },
  { id: 'team',         label: 'Equipe' },
  { id: 'integrations', label: 'Integrações' },
  { id: 'tags',         label: 'Tags' },
  { id: 'billing',      label: 'Faturamento' },
  { id: 'apiKeys',      label: 'API Keys' },
];

const ROLE_LABEL: Record<TeamRole, string> = {
  owner:     'Owner',
  admin:     'Admin',
  moderator: 'Moderador',
  readonly:  'Leitura',
};
const ROLE_TONE: Record<TeamRole, BadgeTone> = {
  owner:     'brand',
  admin:     'info',
  moderator: 'warning',
  readonly:  'neutral',
};

const CATEGORY_LABEL: Record<Integration['category'], string> = {
  music:     'Música',
  payments:  'Pagamentos',
  maps:      'Mapas',
  analytics: 'Analytics',
  comms:     'Comunicação',
};

const INVOICE_STATUS_LABEL: Record<BillingInvoice['status'], string> = {
  paid:    'Pago',
  pending: 'Pendente',
  failed:  'Falhou',
};
const INVOICE_STATUS_TONE: Record<BillingInvoice['status'], BadgeTone> = {
  paid:    'success',
  pending: 'warning',
  failed:  'danger',
};

/* ============================================================
   Page
   ============================================================ */

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general');

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Configurações do workspace, equipe, integrações e cobrança."
        tabs={
          <Tabs<SettingsTab>
            variant="bordered"
            items={TABS}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <div className={styles.body}>
        {tab === 'general'      && <GeneralTab />}
        {tab === 'team'         && <TeamTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'tags'         && <TagsTab />}
        {tab === 'billing'      && <BillingTab />}
        {tab === 'apiKeys'      && <ApiKeysTab />}
      </div>
    </>
  );
}

/* ============================================================
   Tab: Geral
   ============================================================ */

function GeneralTab() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [draft, setDraft] = useState<WorkspaceSettings | null>(null);
  const { push } = useToast();

  useEffect(() => {
    workspaceService.get().then((s) => {
      setSettings(s);
      setDraft(s);
    });
  }, []);

  const dirty = settings && draft && JSON.stringify(settings) !== JSON.stringify(draft);

  if (!draft) return null;

  return (
    <Card>
      <CardHeader
        title="Workspace"
        description="Identidade pública do Fanverse e configurações regionais."
      />
      <div className={styles.formBody}>
        <div className={styles.formGrid}>
          <Input
            label="Nome do workspace"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Slug público"
            required
            value={draft.slug}
            helperText={`Acessível em fanverse.app/${draft.slug}`}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
        </div>

        <Textarea
          label="Descrição"
          helperText="Aparece na landing page e em compartilhamentos sociais."
          rows={3}
          value={draft.description ?? ''}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />

        <div className={styles.formGrid}>
          <Select
            label="Idioma padrão"
            required
            value={draft.language}
            onChange={(e) =>
              setDraft({ ...draft, language: e.target.value as WorkspaceSettings['language'] })
            }
            options={[
              { value: 'pt-BR', label: 'Português (Brasil)' },
              { value: 'en-US', label: 'English (US)' },
              { value: 'es-ES', label: 'Español' },
            ]}
          />
          <Select
            label="Fuso horário"
            required
            value={draft.timezone}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            options={[
              { value: 'America/Sao_Paulo',     label: 'America/Sao_Paulo (BRT)' },
              { value: 'America/Manaus',        label: 'America/Manaus (AMT)' },
              { value: 'America/Recife',        label: 'America/Recife (BRT)' },
              { value: 'America/Noronha',       label: 'America/Noronha (FNT)' },
              { value: 'UTC',                   label: 'UTC' },
            ]}
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty}
          onClick={() => settings && setDraft(settings)}
        >
          Descartar
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty}
          leadingIcon={<IconCheck size={14} />}
          onClick={() => {
            setSettings(draft);
            push({
              type: 'success',
              title: 'Configurações salvas',
              description: 'As alterações entram em vigor imediatamente.',
            });
          }}
        >
          Salvar alterações
        </Button>
      </div>
    </Card>
  );
}

/* ============================================================
   Tab: Equipe
   ============================================================ */

function TeamTab() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const { push } = useToast();
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);

  useEffect(() => {
    teamService.list().then(setMembers);
  }, []);

  const columns: Column<TeamMember>[] = [
    {
      id: 'member',
      header: 'Membro',
      sortKey: (m) => m.name,
      cell: (m) => (
        <div className={styles.memberCell}>
          <Avatar name={m.name} src={m.avatar} size="md" />
          <div className={styles.memberText}>
            <span className={styles.memberName}>{m.name}</span>
            <span className={styles.memberEmail}>{m.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Função',
      sortKey: (m) => m.role,
      cell: (m) => (
        <Badge tone={ROLE_TONE[m.role]} size="sm" dot>
          {ROLE_LABEL[m.role]}
        </Badge>
      ),
      width: 130,
    },
    {
      id: '2fa',
      header: '2FA',
      sortKey: (m) => (m.twoFactor ? 0 : 1),
      cell: (m) => (
        <Badge tone={m.twoFactor ? 'success' : 'neutral'} size="sm">
          {m.twoFactor ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
      width: 90,
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (m) => m.status,
      cell: (m) =>
        m.status === 'active' ? (
          <span className={styles.memberMute}>Ativo</span>
        ) : (
          <Badge tone="warning" size="sm">Convite pendente</Badge>
        ),
      width: 130,
    },
    {
      id: 'lastActive',
      header: 'Última atividade',
      sortKey: (m) => m.lastActiveAt,
      cell: (m) => <span className={styles.memberMute}>{formatRelative(m.lastActiveAt)}</span>,
      width: 150,
    },
    {
      id: 'actions',
      header: 'Ação',
      align: 'right',
      cell: (m) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            disabled={m.role === 'owner'}
            aria-label={`Remover ${m.name}`}
            title="Remover"
            onClick={() => setPendingRemove(m)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="Membros da equipe"
          description="Quem tem acesso ao painel administrativo do Fanverse."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={() =>
                push({
                  type: 'info',
                  title: 'Convite indisponível',
                  description: 'O fluxo de convite precisa do backend conectado.',
                })
              }
            >
              Convidar membro
            </Button>
          }
        />
        <Table<TeamMember>
          columns={columns}
          data={members ?? []}
          rowId={(m) => m.id}
          pageSize={10}
          loading={members === null}
        />
      </Card>

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove || !members) return;
          setMembers(members.filter((m) => m.id !== pendingRemove.id));
          push({
            type: 'warning',
            title: 'Membro removido',
            description: `${pendingRemove.name} perdeu acesso ao painel.`,
          });
          setPendingRemove(null);
        }}
        title={pendingRemove ? `Remover ${pendingRemove.name}?` : ''}
        description="O usuário perde acesso imediato ao painel administrativo. Você pode convidar novamente depois."
        confirmLabel="Remover acesso"
        destructive
      />
    </>
  );
}

/* ============================================================
   Tab: Integrações
   ============================================================ */

function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const { push } = useToast();

  useEffect(() => {
    integrationsService.list().then(setIntegrations);
  }, []);

  function toggle(int: Integration) {
    if (!integrations) return;
    const next = integrations.map((i) =>
      i.id === int.id
        ? {
            ...i,
            connected: !i.connected,
            connectedAt: !i.connected ? new Date().toISOString() : undefined,
          }
        : i
    );
    setIntegrations(next);
    push({
      type: int.connected ? 'warning' : 'success',
      title: int.connected ? `${int.name} desconectado` : `${int.name} conectado`,
      description: int.connected
        ? 'O fluxo dependente desta integração foi pausado.'
        : 'Os eventos começarão a sincronizar nos próximos minutos.',
    });
  }

  return (
    <Card>
      <CardHeader
        title="Integrações"
        description="Serviços conectados ao Fanverse — habilite ou pause individualmente."
      />
      <div className={styles.integrationsGrid}>
        {(integrations ?? []).map((int) => (
          <div key={int.id} className={styles.integration}>
            <div className={styles.intHead}>
              <div>
                <div className={styles.intName}>{int.name}</div>
                <div className={styles.intCategory}>{CATEGORY_LABEL[int.category]}</div>
              </div>
              <span className={styles.intLogo}>{int.name.slice(0, 1).toUpperCase()}</span>
            </div>
            <div className={styles.intDescription}>{int.description}</div>
            <div className={styles.intFooter}>
              {int.connected ? (
                <Badge tone="success" size="sm" dot>
                  Conectado
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Desconectado
                </Badge>
              )}
              <Button
                variant={int.connected ? 'outline' : 'primary'}
                size="sm"
                leadingIcon={<IconLink size={13} />}
                onClick={() => toggle(int)}
              >
                {int.connected ? 'Desconectar' : 'Conectar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   Tab: Tags (Google, Facebook, Clarity, etc.)
   ============================================================ */

interface TagCatalogEntry {
  kind: SiteTagKind;
  name: string;
  /** Color used for the square logo + the brand vibe of the card. */
  brand: string;
  /** 1-2 letter monogram used as the logo glyph. */
  monogram: string;
  description: string;
  placeholder: string;
  helperText: string;
  /** Optional URL the team can follow to grab the value from the
   *  third-party dashboard. Rendered as a small "Onde encontrar"
   *  link in the card footer. */
  docsUrl?: string;
}

/**
 * Catalog of supported tag kinds. Adding a new one here + adding the
 * matching snippet in `src/components/TrackingTags.tsx` on the
 * player side is all that's needed to wire up a new provider —
 * the schema's CHECK constraint also needs to learn the new kind
 * in a migration before the row insert will pass.
 */
const TAG_CATALOG: TagCatalogEntry[] = [
  {
    kind: 'analytics',
    name: 'Google Analytics 4',
    brand: '#E37400',
    monogram: 'GA',
    description: 'Tag de medição (gtag.js). Cole o ID que começa com G-.',
    placeholder: 'G-XXXXXXXXXX',
    helperText: 'ID que começa com "G-" — encontrado em Admin → Streams de dados.',
    docsUrl: 'https://analytics.google.com',
  },
  {
    kind: 'gtm',
    name: 'Google Tag Manager',
    brand: '#246FDB',
    monogram: 'GTM',
    description: 'Container do GTM. Use quando preferir gerenciar tags pela interface do Google.',
    placeholder: 'GTM-XXXXXXX',
    helperText: 'ID que começa com "GTM-".',
    docsUrl: 'https://tagmanager.google.com',
  },
  {
    kind: 'facebook',
    name: 'Meta (Facebook) Pixel',
    brand: '#0866FF',
    monogram: 'fb',
    description: 'Pixel da Meta para campanhas no Facebook e Instagram Ads.',
    placeholder: '1234567890123456',
    helperText: 'ID numérico do pixel — encontrado no Gerenciador de Eventos.',
    docsUrl: 'https://business.facebook.com/events_manager',
  },
  {
    kind: 'clarity',
    name: 'Microsoft Clarity',
    brand: '#0078D4',
    monogram: 'MC',
    description: 'Mapas de calor e gravações de sessão (free, sem amostragem).',
    placeholder: 'xxxxxxxxxx',
    helperText: 'ID do projeto — visível na URL do dashboard, /projects/<ID>.',
    docsUrl: 'https://clarity.microsoft.com',
  },
  {
    kind: 'tiktok',
    name: 'TikTok Pixel',
    brand: '#000000',
    monogram: 'tt',
    description: 'Pixel da TikTok para mensurar campanhas e públicos.',
    placeholder: 'C123ABC456DEF',
    helperText: 'ID do pixel (começa com "C…") — encontrado em TikTok Ads Manager.',
    docsUrl: 'https://ads.tiktok.com',
  },
  {
    kind: 'hotjar',
    name: 'Hotjar',
    brand: '#FD3A5C',
    monogram: 'HJ',
    description: 'Mapas de calor, funis e gravações para análise qualitativa.',
    placeholder: '1234567',
    helperText: 'Site ID numérico (HJID).',
    docsUrl: 'https://insights.hotjar.com',
  },
  {
    kind: 'posthog',
    name: 'PostHog',
    brand: '#1D4AFF',
    monogram: 'PH',
    description: 'Product Analytics (eventos, funis, cohorts, retenção). Ferramenta principal de analytics.',
    placeholder: 'phc_xxxxxxxxxxxxxxxxxxxxxx',
    helperText: 'Project API key — começa com "phc_". Encontrada em Settings → Project no PostHog.',
    docsUrl: 'https://app.posthog.com',
  },
];

function TagsTab() {
  const [tags, setTags] = useState<SiteTag[] | null>(null);

  useEffect(() => {
    siteTagsService
      .list()
      .then((res) => setTags(res.items))
      .catch((err) => {
        console.error('siteTags.list failed:', err);
        // Fallback to empty rows derived from the catalog so the
        // UI still renders the form — the user can fill values in
        // and the PATCH will create the rows on save.
        setTags(
          TAG_CATALOG.map((t) => ({
            kind: t.kind,
            value: '',
            enabled: false,
            updatedAt: new Date(0).toISOString(),
            updatedBy: null,
          })),
        );
      });
  }, []);

  function patchLocal(kind: SiteTagKind, patch: Partial<SiteTag>) {
    setTags((prev) =>
      prev ? prev.map((t) => (t.kind === kind ? { ...t, ...patch } : t)) : prev,
    );
  }

  return (
    <Card>
      <CardHeader
        title="Tags de rastreamento"
        description="Pixels e tags de análise injetados em todas as páginas da plataforma. Tudo que estiver ativo aqui carrega automaticamente para os usuários."
      />
      {tags === null ? (
        <div style={{ padding: 24, fontSize: 12.5, color: 'var(--text-mute)' }}>
          Carregando…
        </div>
      ) : (
        <div className={styles.tagGrid}>
          {TAG_CATALOG.map((entry) => {
            const row =
              tags.find((t) => t.kind === entry.kind) ?? {
                kind: entry.kind,
                value: '',
                enabled: false,
                updatedAt: new Date(0).toISOString(),
                updatedBy: null,
              };
            return (
              <TagCard
                key={entry.kind}
                entry={entry}
                row={row}
                onChange={(patch) => patchLocal(entry.kind, patch)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface TagCardProps {
  entry: TagCatalogEntry;
  row: SiteTag;
  onChange: (patch: Partial<SiteTag>) => void;
}

/** Single tag editor card.
 *
 *  Local state mirrors the row but only persists on click of
 *  "Salvar" — the toggle is local too until saved. This avoids
 *  surprising the team with a partial save while still typing
 *  the ID. Saved state pushes back to the parent so the next
 *  refetch is unnecessary. */
function TagCard({ entry, row, onChange }: TagCardProps) {
  const { push } = useToast();
  const [value, setValue] = useState(row.value);
  const [enabled, setEnabled] = useState(row.enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(row.value);
    setEnabled(row.enabled);
  }, [row.value, row.enabled]);

  const dirty = value !== row.value || enabled !== row.enabled;
  const active = row.enabled && row.value.trim().length > 0;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await siteTagsService.save(entry.kind, value.trim(), enabled);
      onChange({
        value: value.trim(),
        enabled: enabled && value.trim().length > 0,
        updatedAt: new Date().toISOString(),
      });
      push({
        type: 'success',
        title: `${entry.name} salvo`,
        description: enabled && value.trim()
          ? 'A tag passa a carregar no próximo refresh dos visitantes.'
          : 'A tag foi pausada e não vai mais carregar.',
      });
    } catch (err) {
      console.error('siteTag save failed:', err);
      push({
        type: 'error',
        title: `Falha ao salvar ${entry.name}`,
        description: 'Tente novamente em alguns instantes.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.tagCard} ${active ? styles.tagCardActive : ''}`}>
      <div className={styles.tagHead}>
        <div className={styles.tagHeadLeft}>
          <span
            className={styles.tagLogo}
            style={{ background: entry.brand }}
            aria-hidden="true"
          >
            {entry.monogram}
          </span>
          <div className={styles.tagMeta}>
            <span className={styles.tagName}>{entry.name}</span>
            <span className={styles.tagDescription}>{entry.description}</span>
          </div>
        </div>
        <Switch
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={saving}
          aria-label={`Ativar ${entry.name}`}
        />
      </div>

      <Input
        inputSize="md"
        placeholder={entry.placeholder}
        helperText={entry.helperText}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        maxLength={200}
      />

      <div className={styles.tagFooter}>
        <span className={styles.tagFooterMeta}>
          {row.updatedBy
            ? `Editado ${formatRelative(row.updatedAt)} por ${row.updatedBy.name ?? row.updatedBy.email}`
            : entry.docsUrl
              ? (
                <a
                  href={entry.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--text-mute)', textDecoration: 'underline' }}
                >
                  Onde encontrar?
                </a>
              )
              : 'Nunca configurado'}
        </span>
        <Button
          variant={dirty ? 'primary' : 'ghost'}
          size="sm"
          loading={saving}
          disabled={!dirty || saving}
          onClick={save}
          leadingIcon={!saving && dirty ? <IconCheck size={14} /> : undefined}
        >
          {dirty ? 'Salvar' : active ? 'Ativo' : 'Inativo'}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   Tab: Faturamento
   ============================================================ */

function BillingTab() {
  const [plan, setPlan] = useState<BillingPlan | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);

  useEffect(() => {
    billingService.plan().then(setPlan);
    billingService.invoices().then(setInvoices);
  }, []);

  const invoiceColumns: Column<BillingInvoice>[] = [
    {
      id: 'number',
      header: 'Fatura',
      sortKey: (i) => i.number,
      cell: (i) => <span className={styles.invoiceCell}>{i.number}</span>,
      width: 180,
    },
    {
      id: 'date',
      header: 'Data',
      sortKey: (i) => i.date,
      cell: (i) => <span className={styles.invoiceMute}>{formatDate(i.date)}</span>,
      width: 140,
    },
    {
      id: 'amount',
      header: 'Valor',
      sortKey: (i) => i.amount,
      align: 'right',
      cell: (i) => <span className={styles.invoiceCell}>{formatBRL(i.amount)}</span>,
      width: 130,
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (i) => i.status,
      cell: (i) => (
        <Badge tone={INVOICE_STATUS_TONE[i.status]} size="sm" dot>
          {INVOICE_STATUS_LABEL[i.status]}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'download',
      header: '',
      align: 'right',
      cell: () => (
        <Button variant="ghost" size="sm" iconOnly aria-label="Baixar fatura" title="Baixar fatura">
          <IconDownload size={14} />
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader title="Plano atual" description="Ciclo de cobrança e método de pagamento." />
        <div className={styles.planHero}>
          <div className={styles.planMain}>
            <span className={styles.planLabel}>Plano</span>
            <span className={styles.planName}>
              {plan?.name ?? '—'}
              {plan && (
                <span className={styles.planPrice}>
                  · {formatBRL(plan.monthlyBRL)} / mês
                </span>
              )}
            </span>
            <span className={styles.planSeats}>
              {plan ? `${plan.seatsUsed} de ${plan.seats} assentos em uso` : '—'}
            </span>
            <span className={styles.planNext}>
              {plan && (
                <>
                  Próxima cobrança em <b>{formatDate(plan.nextChargeAt)}</b>
                </>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button variant="primary" size="sm">Mudar plano</Button>
              <Button variant="ghost" size="sm">Cancelar assinatura</Button>
            </div>
          </div>

          <div className={styles.paymentBox}>
            <span className={styles.planLabel}>Método de pagamento</span>
            {plan ? (
              <>
                <span className={styles.paymentBrand}>
                  {plan.paymentMethod.brand} •••• {plan.paymentMethod.last4}
                </span>
                <span className={styles.paymentMeta}>
                  Validade {plan.paymentMethod.expiresAt}
                </span>
                <Button variant="outline" size="sm" style={{ marginTop: 8 }}>
                  Atualizar cartão
                </Button>
              </>
            ) : (
              <span className={styles.paymentMeta}>—</span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Histórico de faturas"
          description="Faturas emitidas nos últimos 6 meses."
        />
        <Table<BillingInvoice>
          columns={invoiceColumns}
          data={invoices ?? []}
          rowId={(i) => i.id}
          pageSize={10}
          loading={invoices === null}
        />
      </Card>
    </>
  );
}

/* ============================================================
   Tab: API Keys
   ============================================================ */

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);
  const { push } = useToast();

  useEffect(() => {
    apiKeysService.list().then(setKeys);
  }, []);

  const columns: Column<ApiKey>[] = [
    {
      id: 'label',
      header: 'Chave',
      sortKey: (k) => k.label,
      cell: (k) => (
        <div className={styles.keyCell}>
          <span className={styles.keyLabel}>{k.label}</span>
          <span className={styles.keyPrefix}>{k.prefix}••••••</span>
        </div>
      ),
    },
    {
      id: 'scopes',
      header: 'Escopos',
      cell: (k) => (
        <div className={styles.keyScopes}>
          {k.scopes.slice(0, 3).map((s) => (
            <Badge key={s} tone="neutral" size="sm">
              {s}
            </Badge>
          ))}
          {k.scopes.length > 3 && (
            <Badge tone="neutral" size="sm">
              +{k.scopes.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'createdBy',
      header: 'Criado por',
      sortKey: (k) => k.createdBy,
      cell: (k) => <span className={styles.memberMute}>{k.createdBy}</span>,
      width: 160,
    },
    {
      id: 'createdAt',
      header: 'Criada em',
      sortKey: (k) => k.createdAt,
      cell: (k) => <span className={styles.memberMute}>{formatDate(k.createdAt)}</span>,
      width: 140,
    },
    {
      id: 'lastUsedAt',
      header: 'Último uso',
      sortKey: (k) => k.lastUsedAt ?? '',
      cell: (k) => (
        <span className={styles.memberMute}>
          {k.lastUsedAt ? formatRelative(k.lastUsedAt) : 'nunca'}
        </span>
      ),
      width: 140,
    },
    {
      id: 'actions',
      header: 'Ação',
      align: 'right',
      cell: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Revogar ${k.label}`}
            title="Revogar"
            onClick={() => setPendingRevoke(k)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="API Keys"
          description="Tokens de acesso à API. Revogue imediatamente se houver suspeita de comprometimento."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconKey size={14} />}
              onClick={() =>
                push({
                  type: 'info',
                  title: 'Geração indisponível',
                  description: 'O fluxo de geração precisa do backend conectado.',
                })
              }
            >
              Gerar nova key
            </Button>
          }
        />
        <Table<ApiKey>
          columns={columns}
          data={keys ?? []}
          rowId={(k) => k.id}
          pageSize={10}
          loading={keys === null}
        />
      </Card>

      <ConfirmDialog
        open={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        onConfirm={() => {
          if (!pendingRevoke || !keys) return;
          setKeys(keys.filter((k) => k.id !== pendingRevoke.id));
          push({
            type: 'error',
            title: 'API key revogada',
            description: `${pendingRevoke.label} não pode mais ser usada.`,
          });
          setPendingRevoke(null);
        }}
        title={pendingRevoke ? `Revogar ${pendingRevoke.label}?` : ''}
        description="Qualquer requisição usando essa chave passa a falhar imediatamente. Esta ação é permanente."
        confirmLabel="Revogar key"
        destructive
      />
    </>
  );
}
