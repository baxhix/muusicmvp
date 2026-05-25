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
} from '@/components/icons';
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
  | 'notifications';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general',       label: 'Geral' },
  { id: 'team',          label: 'Usuários' },
  { id: 'rules',         label: 'Registro de regras' },
  { id: 'notifications', label: 'Notificações' },
  /* Fanpoints virou página própria em /fanpoints (sob "Superfãs"
   * no menu) — removido daqui pra evitar duplicação. */
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

/* Fanpoints — extraído pra /fanpoints (sob "Superfãs" no menu) */


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

