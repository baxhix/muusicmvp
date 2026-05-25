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
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconCheck,
  IconTrash,
  IconEdit,
} from '@/components/icons';
import AdminUserDialog, {
  SIDEBAR_GROUPS,
  type AdminUserDialogMode,
} from '@/components/admin/AdminUserDialog';
import { teamService } from '@/services/team';
import { workspaceService } from '@/services/billing';
import {
  fanpointsService,
  type FanpointRule as ServerFanpointRule,
  type FanpointRuleKind,
} from '@/services/fanpoints';
import type {
  TeamMember,
  TeamRole,
  WorkspaceSettings,
} from '@/types';
import {
  CATEGORY_LABEL as FANPOINT_CATEGORY_LABEL,
  loadFanpointRules as loadBrainstormRules,
  type FanpointCategory,
  type FanpointRule as BrainstormRule,
} from '@/data/mock/fanpoints';
import { formatRelative } from '@/lib/format';
import styles from './page.module.css';

// Scope:
//   - Geral — workspace settings
//   - Usuários — CRUD completo de admins (convidar, editar, excluir,
//     bulk delete, acesso por grupo da sidebar)
//
// Removidos daqui:
//   - "Registro de regras" e "Notificações" foram movidos pras suas
//     próprias páginas no menu (Notificações tem rota dedicada
//     /notificacoes; regras agora não tem mais espaço aqui — vão
//     pra outras abas conforme produto). Esta aba ficou enxuta:
//     workspace + usuários.
//   - Fanpoints virou /fanpoints sob "Superfãs".
//   - Tags foi pra /desenvolvedor.
type SettingsTab =
  | 'general'
  | 'team';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'Geral' },
  { id: 'team',    label: 'Usuários' },
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
        {tab === 'general' && <GeneralTab />}
        {tab === 'team'    && <TeamTab />}
      </div>
    </>
  );
}

/* "Registro de regras" e "Notificações" — antes eram stub-tabs aqui,
 * agora vivem em outras páginas do menu (Notificações tem rota
 * própria em /notificacoes). Removidos daqui pra evitar duplicação
 * conforme product feedback. */


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
  const [pendingBulkRemove, setPendingBulkRemove] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* Dialog de criar/editar — controlado por modo + member-alvo.
   * member=null em create (form em branco), populated em edit. */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<AdminUserDialogMode>('create');
  const [dialogMember, setDialogMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    teamService.list().then(setMembers);
  }, []);

  function openCreate() {
    setDialogMode('create');
    setDialogMember(null);
    setDialogOpen(true);
  }

  function openEdit(m: TeamMember) {
    if (m.role === 'owner') {
      /* Owner não passa pelo fluxo de edição via dialog — protege a
       * conta principal de mudanças acidentais de role/access. */
      push({
        type: 'info',
        title: 'Owner não pode ser editado',
        description: 'A conta owner só pode ser ajustada pelo CLI/DB.',
      });
      return;
    }
    setDialogMode('edit');
    setDialogMember(m);
    setDialogOpen(true);
  }

  function handleSubmit(next: TeamMember) {
    if (!members) return;
    setMembers((prev) => {
      if (!prev) return prev;
      const exists = prev.some((m) => m.id === next.id);
      return exists
        ? prev.map((m) => (m.id === next.id ? next : m))
        : [...prev, next];
    });
    push({
      type: 'success',
      title: dialogMode === 'create' ? 'Membro criado' : 'Membro atualizado',
      description:
        dialogMode === 'create'
          ? `${next.name} recebeu acesso ao painel.`
          : `${next.name} foi atualizado com sucesso.`,
    });
    setDialogOpen(false);
    setDialogMember(null);
  }

  function handleBulkRemove() {
    if (!members) return;
    const toRemove = members.filter(
      (m) => selectedIds.includes(m.id) && m.role !== 'owner',
    );
    setMembers(members.filter((m) => !selectedIds.includes(m.id) || m.role === 'owner'));
    push({
      type: 'warning',
      title: `${toRemove.length} membro(s) removido(s)`,
      description: 'Eles perderam acesso ao painel administrativo.',
    });
    setSelectedIds([]);
    setPendingBulkRemove(false);
  }

  /* Quantos selecionados podem ser efetivamente removidos (owner
   * fica fora). Usado pra desabilitar o botão de bulk delete e
   * mostrar contagem honesta. */
  const removableSelectedCount = useMemo(() => {
    if (!members) return 0;
    return members.filter(
      (m) => selectedIds.includes(m.id) && m.role !== 'owner',
    ).length;
  }, [members, selectedIds]);

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
      id: 'access',
      header: 'Acesso',
      sortKey: (m) => (m.groupAccess?.length ?? SIDEBAR_GROUPS.length),
      cell: (m) => {
        /* Owner não tem groupAccess (acesso total). Members novos
         * sem groupAccess também caem aqui — interpretamos como
         * "todas as áreas" pra não bloquear acidentalmente. */
        if (m.role === 'owner' || !m.groupAccess) {
          return <span className={styles.memberMute}>Todas as áreas</span>;
        }
        const count = m.groupAccess.length;
        if (count === SIDEBAR_GROUPS.length) {
          return <span className={styles.memberMute}>Todas as áreas</span>;
        }
        return (
          <span className={styles.accessCount}>
            {count} de {SIDEBAR_GROUPS.length} áreas
          </span>
        );
      },
      width: 160,
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
        <div
          className={styles.actionCell}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Editar ${m.name}`}
            title="Editar acesso e função"
            onClick={() => openEdit(m)}
            disabled={m.role === 'owner'}
          >
            <IconEdit size={14} />
          </Button>
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
          title="Usuários do admin"
          description="Quem tem acesso ao painel administrativo do Fanverse. Defina nome, função e quais áreas da sidebar cada membro pode visualizar."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={openCreate}
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
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={openEdit}
          bulkActions={
            <Button
              variant="dangerGhost"
              size="sm"
              leadingIcon={<IconTrash size={14} />}
              disabled={removableSelectedCount === 0}
              onClick={() => setPendingBulkRemove(true)}
            >
              Remover {removableSelectedCount} membro(s)
            </Button>
          }
        />
      </Card>

      <AdminUserDialog
        open={dialogOpen}
        mode={dialogMode}
        member={dialogMember}
        existingEmails={
          members?.map((m) => m.email).filter((e) => e !== dialogMember?.email) ??
          []
        }
        onClose={() => {
          setDialogOpen(false);
          setDialogMember(null);
        }}
        onSubmit={handleSubmit}
      />

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

      <ConfirmDialog
        open={pendingBulkRemove}
        onClose={() => setPendingBulkRemove(false)}
        onConfirm={handleBulkRemove}
        title={`Remover ${removableSelectedCount} membro(s)?`}
        description="Todos os selecionados perdem acesso imediato ao painel. A conta owner (se selecionada) é preservada."
        confirmLabel="Remover acesso"
        destructive
      />
    </>
  );
}

