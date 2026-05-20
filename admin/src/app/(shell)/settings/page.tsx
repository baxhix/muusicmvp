'use client';

import { useEffect, useMemo, useState } from 'react';
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
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconCheck,
  IconTrash,
  IconEdit,
} from '@/components/icons';
import { teamService } from '@/services/team';
import { workspaceService } from '@/services/billing';
import type {
  TeamMember,
  TeamRole,
  WorkspaceSettings,
} from '@/types';
import {
  CATEGORY_LABEL as FANPOINT_CATEGORY_LABEL,
  loadFanpointRules,
  type FanpointCategory,
  type FanpointRule,
} from '@/data/mock/fanpoints';
import { formatRelative } from '@/lib/format';
import styles from './page.module.css';

// Scope:
//   - Geral / Usuários — workspace e equipe (mantidos do design original)
//   - Registro de regras / Notificações — stubs prontos pra ganhar
//     conteúdo quando o backend correspondente cair
//   - Fanpoints — CRUD de comportamentos × pontos (FanpointsTab)
//
// O tab "Tags" foi movido pra /desenvolvedor per product feedback
// "leve o item de Tags para [Desenvolvedor]" — integrações de
// pixels ficam mais coerentes lá.
type SettingsTab =
  | 'general'
  | 'team'
  | 'rules'
  | 'notifications'
  | 'fanpoints';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general',       label: 'Geral' },
  { id: 'team',          label: 'Usuários' },
  { id: 'rules',         label: 'Registro de regras' },
  { id: 'notifications', label: 'Notificações' },
  { id: 'fanpoints',     label: 'Fanpoints' },
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
        {tab === 'general'       && <GeneralTab />}
        {tab === 'team'          && <TeamTab />}
        {tab === 'rules'         && <RulesTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'fanpoints'     && <FanpointsTab />}
      </div>
    </>
  );
}

/* ============================================================
   Stub tabs — placeholders pros 3 novos tabs adicionados per
   product feedback. Mantém o vocabulário visual (Card +
   CardHeader + body descritivo) pra que os tabs já leiam como
   "vão receber conteúdo aqui" em vez de cair em página vazia.
   Trocar pelo conteúdo real assim que o backend / spec cair.
   ============================================================ */

function RulesTab() {
  return (
    <Card>
      <CardHeader
        title="Registro de regras"
        description="Histórico de criação, alteração e revogação de regras de moderação, automação e visibilidade aplicadas ao Fanverse."
      />
      <div className={styles.formBody}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mute)' }}>
          Em breve: timeline cronológica com cada regra editada, autor,
          motivo da mudança e estado anterior / atual lado a lado.
        </p>
      </div>
    </Card>
  );
}

function NotificationsTab() {
  return (
    <Card>
      <CardHeader
        title="Notificações"
        description="Modelos e canais de notificação enviados aos usuários — push, e-mail e in-app."
      />
      <div className={styles.formBody}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mute)' }}>
          Em breve: lista de templates por evento (novo seguidor, wave
          recebido, milestone de Fanpoints etc.) com toggle por canal e
          preview antes de enviar.
        </p>
      </div>
    </Card>
  );
}

/* ============================================================
   Tab: Fanpoints — CRUD de regras de pontuação
   ============================================================ */

const FANPOINT_CATEGORY_TONE: Record<FanpointCategory, BadgeTone> = {
  playback:   'info',
  social:     'brand',
  engagement: 'success',
  events:     'warning',
  first_time: 'neutral',
};

const FANPOINT_CATEGORY_OPTIONS: { value: FanpointCategory; label: string }[] = [
  { value: 'playback',   label: 'Player' },
  { value: 'social',     label: 'Social' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'events',     label: 'Eventos' },
  { value: 'first_time', label: 'Primeira vez' },
];

/** Estado do dialog de edição/criação de regra. */
type RuleDraft = {
  id: string | null; // null = criando uma nova
  key: string;
  label: string;
  description: string;
  points: number;
  dailyCap: number;
  category: FanpointCategory;
  enabled: boolean;
};

function emptyDraft(): RuleDraft {
  return {
    id: null,
    key: '',
    label: '',
    description: '',
    points: 0,
    dailyCap: 0,
    category: 'engagement',
    enabled: true,
  };
}

function FanpointsTab() {
  const { push } = useToast();
  const [rules, setRules] = useState<FanpointRule[]>(() => loadFanpointRules());
  const [editing, setEditing] = useState<RuleDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FanpointRule | null>(null);

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.label.localeCompare(b.label)),
    [rules],
  );

  function toggleEnabled(rule: FanpointRule) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === rule.id
          ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
    push({
      type: 'info',
      title: `${rule.label} ${rule.enabled ? 'pausada' : 'reativada'}`,
      description: rule.enabled
        ? 'A ação para de creditar pontos imediatamente.'
        : 'A ação volta a creditar pontos no próximo evento.',
    });
  }

  function openEdit(rule: FanpointRule) {
    setEditing({
      id: rule.id,
      key: rule.key,
      label: rule.label,
      description: rule.description,
      points: rule.points,
      dailyCap: rule.dailyCap,
      category: rule.category,
      enabled: rule.enabled,
    });
  }

  function openCreate() {
    setEditing(emptyDraft());
  }

  function saveDraft(draft: RuleDraft) {
    const now = new Date().toISOString();
    if (draft.id) {
      // Update
      setRules((prev) =>
        prev.map((r) =>
          r.id === draft.id
            ? {
                ...r,
                key: draft.key.trim(),
                label: draft.label.trim(),
                description: draft.description.trim(),
                points: draft.points,
                dailyCap: draft.dailyCap,
                category: draft.category,
                enabled: draft.enabled,
                updatedAt: now,
              }
            : r,
        ),
      );
      push({
        type: 'success',
        title: 'Regra atualizada',
        description: `${draft.label} salvo. As mudanças entram em vigor no próximo evento.`,
      });
    } else {
      // Create — `id` derivado do key pra ficar previsível.
      const id = `fp-${draft.key.trim()}-${Date.now().toString(36)}`;
      const newRule: FanpointRule = {
        id,
        key: draft.key.trim(),
        label: draft.label.trim(),
        description: draft.description.trim(),
        points: draft.points,
        dailyCap: draft.dailyCap,
        category: draft.category,
        enabled: draft.enabled,
        updatedAt: now,
      };
      setRules((prev) => [...prev, newRule]);
      push({
        type: 'success',
        title: 'Regra criada',
        description: `${draft.label} já está disponível para creditar pontos.`,
      });
    }
    setEditing(null);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    setRules((prev) => prev.filter((r) => r.id !== pendingDelete.id));
    push({
      type: 'warning',
      title: 'Regra removida',
      description: `${pendingDelete.label} não credita mais Fanpoints.`,
    });
    setPendingDelete(null);
  }

  const columns: Column<FanpointRule>[] = [
    {
      id: 'rule',
      header: 'Regra',
      sortKey: (r) => r.label,
      cell: (r) => (
        <div className={styles.fpRuleCell}>
          <span className={styles.fpRuleLabel}>{r.label}</span>
          <span className={styles.fpRuleKey}>
            <code>{r.key}</code> · {r.description}
          </span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Categoria',
      sortKey: (r) => r.category,
      cell: (r) => (
        <Badge tone={FANPOINT_CATEGORY_TONE[r.category]} size="sm">
          {FANPOINT_CATEGORY_LABEL[r.category]}
        </Badge>
      ),
      width: 140,
    },
    {
      id: 'points',
      header: 'Pontos',
      sortKey: (r) => r.points,
      align: 'right',
      cell: (r) => (
        <span className={r.points >= 0 ? styles.fpPointsPositive : styles.fpPointsNegative}>
          {r.points >= 0 ? '+' : ''}
          {r.points}
        </span>
      ),
      width: 90,
    },
    {
      id: 'dailyCap',
      header: 'Cap diário',
      sortKey: (r) => r.dailyCap,
      align: 'right',
      cell: (r) => (
        <span className={styles.fpDailyCap}>
          {r.dailyCap === 0 ? '—' : r.dailyCap}
        </span>
      ),
      width: 100,
    },
    {
      id: 'enabled',
      header: 'Ativa',
      sortKey: (r) => (r.enabled ? 0 : 1),
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={r.enabled}
            onChange={() => toggleEnabled(r)}
            aria-label={`Alternar ${r.label}`}
          />
        </div>
      ),
      width: 80,
    },
    {
      id: 'updatedAt',
      header: 'Atualizada',
      sortKey: (r) => r.updatedAt,
      cell: (r) => (
        <span className={styles.fpMute}>{formatRelative(r.updatedAt)}</span>
      ),
      width: 140,
    },
    {
      id: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (r) => (
        <div className={styles.fpActions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Editar ${r.label}`}
            title="Editar"
            onClick={() => openEdit(r)}
          >
            <IconEdit size={14} />
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Remover ${r.label}`}
            title="Remover"
            onClick={() => setPendingDelete(r)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
      width: 100,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader
          title="Fanpoints"
          description="Cadastre quais comportamentos do usuário rendem Fanpoints, quanto cada ação vale e o teto diário por usuário. Mudanças entram em vigor no próximo evento processado."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={openCreate}
            >
              Nova regra
            </Button>
          }
        />
        <Table<FanpointRule>
          columns={columns}
          data={sortedRules}
          rowId={(r) => r.id}
          pageSize={20}
        />
      </Card>

      <FanpointRuleDialog
        draft={editing}
        onCancel={() => setEditing(null)}
        onSave={saveDraft}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete ? `Remover "${pendingDelete.label}"?` : ''}
        description="A regra deixa de creditar Fanpoints imediatamente. O histórico de pontos já creditados continua intocado — apenas eventos futuros param de pontuar."
        confirmLabel="Remover regra"
        destructive
      />
    </>
  );
}

/** Dialog de criar/editar uma FanpointRule. Local state pra que o
 *  rascunho não sobrescreva a row real até o usuário salvar. */
function FanpointRuleDialog({
  draft,
  onCancel,
  onSave,
}: {
  draft: RuleDraft | null;
  onCancel: () => void;
  onSave: (draft: RuleDraft) => void;
}) {
  const [form, setForm] = useState<RuleDraft | null>(draft);

  useEffect(() => {
    setForm(draft);
  }, [draft]);

  if (!form) return null;

  const isCreating = form.id === null;
  const labelTrim = form.label.trim();
  const keyTrim = form.key.trim();
  const valid =
    labelTrim.length >= 3 &&
    keyTrim.length >= 2 &&
    /^[a-z0-9_]+$/.test(keyTrim);

  return (
    <Dialog
      open={draft !== null}
      onClose={onCancel}
      title={isCreating ? 'Nova regra de Fanpoints' : `Editar — ${draft?.label}`}
      description={
        isCreating
          ? 'Defina o evento que credita Fanpoints e os parâmetros da regra.'
          : 'Ajuste pontos, cap diário ou metadados desta regra.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!valid}
            leadingIcon={<IconCheck size={14} />}
            onClick={() => onSave(form)}
          >
            {isCreating ? 'Criar regra' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className={styles.formBody}>
        <div className={styles.formGrid}>
          <Input
            label="Nome da regra"
            required
            value={form.label}
            placeholder="Ex.: Play completo de uma faixa"
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <Input
            label="Chave do evento"
            required
            value={form.key}
            placeholder="Ex.: play_complete"
            helperText="Apenas minúsculas, números e underline. Usado pelo backend pra identificar o evento."
            onChange={(e) => setForm({ ...form, key: e.target.value })}
          />
        </div>

        <Textarea
          label="Descrição"
          helperText="Aparece na tabela e ajuda o time a entender o contexto da regra."
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className={styles.formGrid}>
          <Input
            label="Pontos"
            required
            type="number"
            value={String(form.points)}
            helperText="Pode ser negativo (penalidade)."
            onChange={(e) => setForm({ ...form, points: Number(e.target.value) || 0 })}
          />
          <Input
            label="Cap diário"
            type="number"
            value={String(form.dailyCap)}
            helperText="Máximo de pontos por usuário/dia. Use 0 para sem cap."
            onChange={(e) => setForm({ ...form, dailyCap: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>

        <div className={styles.formGrid}>
          <Select
            label="Categoria"
            required
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as FanpointCategory })
            }
            options={FANPOINT_CATEGORY_OPTIONS}
          />
          <div className={styles.fpEnabledRow}>
            <div>
              <div className={styles.fpEnabledLabel}>Ativa</div>
              <div className={styles.fpEnabledHelp}>
                Desligada, a regra continua existindo mas não credita pontos.
              </div>
            </div>
            <Switch
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              aria-label="Ativar regra"
            />
          </div>
        </div>
      </div>
    </Dialog>
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

