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
   Tab: Fanpoints
   ----------------------------------------------------------------
   Duas seções:
     1. Integrado  — as 7 ActivityKinds reais do backend
        (stream, login, chat_started, post_liked, comment_posted,
        post_shared, three_streams). Somente o valor de pontos é
        editável + persistido. Display metadata (label,
        descrição, categoria) vive aqui no admin, não no DB.
     2. Brainstorm — wishlist de regras que ainda não estão
        implementadas no servidor (play_complete, wave_send,
        show_checkin etc.). Read-only; serve de roadmap pra ir
        promovendo conforme os usuários pedem. Quando uma virar
        real, basta adicionar ao enum de ActivityKind + ensinar
        o INTEGRATED_KIND_META abaixo + remover do mock.
   ============================================================ */

const FANPOINT_CATEGORY_TONE: Record<FanpointCategory, BadgeTone> = {
  playback:   'info',
  social:     'brand',
  engagement: 'success',
  events:     'warning',
  first_time: 'neutral',
};

interface IntegratedKindMeta {
  label: string;
  description: string;
  category: FanpointCategory;
}

/** Display metadata pras 7 kinds integradas. Mantém label/descrição
 *  em PT-BR aqui no admin (o servidor só conhece `kind` + `points`
 *  + `updated_at` + `updated_by`). */
const INTEGRATED_KIND_META: Record<FanpointRuleKind, IntegratedKindMeta> = {
  stream: {
    label: 'Reprodução de faixa',
    description: 'Cada play registrado no ledger. Por padrão vale 0 — o bônus real vem em "Cada 3 streams".',
    category: 'playback',
  },
  login: {
    label: 'Login com magic-link',
    description: 'Crédito de retorno: usuário autenticado abre uma nova sessão via link no e-mail.',
    category: 'engagement',
  },
  chat_started: {
    label: 'Iniciar uma DM',
    description: 'Primeira mensagem trocada com um novo fã. Conta uma vez por conversa.',
    category: 'social',
  },
  post_liked: {
    label: 'Curtir um post no feed',
    description: 'Coração em qualquer item do feed (post da Ana, post de fã, single, story).',
    category: 'social',
  },
  comment_posted: {
    label: 'Publicar comentário',
    description: 'Comentário de nível 1 ou resposta em qualquer surface do feed.',
    category: 'social',
  },
  post_shared: {
    label: 'Compartilhar um post',
    description: 'Botão de "send" (share) num post do feed — externo (link copiado) ou interno (DM).',
    category: 'social',
  },
  three_streams: {
    label: 'Cada 3 streams sequenciais',
    description: 'Bônus de engajamento que dispara a cada 3 reproduções acumuladas do usuário.',
    category: 'playback',
  },
};

function FanpointsTab() {
  const { push } = useToast();
  const [rules, setRules] = useState<ServerFanpointRule[] | null>(null);
  // Mapa kind → state local do input (pontos ainda não salvos).
  // Chave existe enquanto a row está com edição pendente.
  const [drafts, setDrafts] = useState<Partial<Record<FanpointRuleKind, number>>>({});
  // Mapa kind → "em vôo" (PATCH em andamento) pra travar UI por linha.
  const [saving, setSaving] = useState<Partial<Record<FanpointRuleKind, boolean>>>({});

  useEffect(() => {
    fanpointsService
      .list()
      .then((res) => setRules(res.items))
      .catch((err) => {
        console.error('fanpointsService.list failed:', err);
        push({
          type: 'error',
          title: 'Falha ao carregar Fanpoints',
          description: 'Tente recarregar a página.',
        });
        setRules([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveRow(rule: ServerFanpointRule, nextPoints: number) {
    if (nextPoints === rule.points) {
      // Nada mudou — limpa o draft e retorna.
      setDrafts((d) => {
        const next = { ...d };
        delete next[rule.kind];
        return next;
      });
      return;
    }
    setSaving((s) => ({ ...s, [rule.kind]: true }));
    try {
      await fanpointsService.save(rule.kind, nextPoints);
      setRules((prev) =>
        prev
          ? prev.map((r) =>
              r.kind === rule.kind
                ? { ...r, points: nextPoints, updatedAt: new Date().toISOString() }
                : r,
            )
          : prev,
      );
      setDrafts((d) => {
        const next = { ...d };
        delete next[rule.kind];
        return next;
      });
      const meta = INTEGRATED_KIND_META[rule.kind];
      push({
        type: 'success',
        title: `${meta.label} → ${nextPoints} pts`,
        description: 'Próximos eventos creditam o novo valor (até 60s pra propagar entre instâncias).',
      });
    } catch (err) {
      console.error('fanpointsService.save failed:', err);
      push({
        type: 'error',
        title: 'Falha ao salvar',
        description: 'O valor anterior foi mantido. Tente novamente.',
      });
    } finally {
      setSaving((s) => {
        const next = { ...s };
        delete next[rule.kind];
        return next;
      });
    }
  }

  const integratedColumns: Column<ServerFanpointRule>[] = [
    {
      id: 'rule',
      header: 'Comportamento',
      sortKey: (r) => INTEGRATED_KIND_META[r.kind].label,
      cell: (r) => {
        const meta = INTEGRATED_KIND_META[r.kind];
        return (
          <div className={styles.fpRuleCell}>
            <span className={styles.fpRuleLabel}>{meta.label}</span>
            <span className={styles.fpRuleKey}>
              <code>{r.kind}</code> · {meta.description}
            </span>
          </div>
        );
      },
    },
    {
      id: 'category',
      header: 'Categoria',
      cell: (r) => {
        const meta = INTEGRATED_KIND_META[r.kind];
        return (
          <Badge tone={FANPOINT_CATEGORY_TONE[meta.category]} size="sm">
            {FANPOINT_CATEGORY_LABEL[meta.category]}
          </Badge>
        );
      },
      width: 140,
    },
    {
      id: 'points',
      header: 'Pontos',
      align: 'right',
      cell: (r) => {
        const draftValue = drafts[r.kind];
        const value = draftValue !== undefined ? draftValue : r.points;
        const dirty = draftValue !== undefined && draftValue !== r.points;
        const isSaving = !!saving[r.kind];
        return (
          <div
            className={styles.fpPointsEditor}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="number"
              className={styles.fpPointsInput}
              value={String(value)}
              disabled={isSaving}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDrafts((d) => ({ ...d, [r.kind]: Number.isFinite(n) ? n : 0 }));
              }}
              onBlur={() => void saveRow(r, value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label={`Pontos para ${INTEGRATED_KIND_META[r.kind].label}`}
            />
            {dirty && <span className={styles.fpPointsHint}>↵</span>}
          </div>
        );
      },
      width: 110,
    },
    {
      id: 'updatedAt',
      header: 'Última edição',
      sortKey: (r) => r.updatedAt,
      cell: (r) => (
        <span className={styles.fpMute}>
          {r.updatedBy
            ? `${formatRelative(r.updatedAt)} · ${r.updatedBy.name ?? r.updatedBy.email}`
            : 'Padrão do sistema'}
        </span>
      ),
      width: 240,
    },
  ];

  // Brainstorm rules — mock-only. Read-only.
  const brainstormRules = useMemo(() => loadBrainstormRules(), []);
  const brainstormColumns: Column<BrainstormRule>[] = [
    {
      id: 'rule',
      header: 'Ideia',
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
      cell: (r) => (
        <Badge tone={FANPOINT_CATEGORY_TONE[r.category]} size="sm">
          {FANPOINT_CATEGORY_LABEL[r.category]}
        </Badge>
      ),
      width: 140,
    },
    {
      id: 'points',
      header: 'Pontos sugeridos',
      align: 'right',
      cell: (r) => (
        <span className={r.points >= 0 ? styles.fpPointsPositive : styles.fpPointsNegative}>
          {r.points >= 0 ? '+' : ''}
          {r.points}
        </span>
      ),
      width: 130,
    },
    {
      id: 'cap',
      header: 'Cap sugerido',
      align: 'right',
      cell: (r) => (
        <span className={styles.fpDailyCap}>{r.dailyCap === 0 ? '—' : r.dailyCap}</span>
      ),
      width: 110,
    },
  ];

  return (
    <div className={styles.fpStack}>
      <Card>
        <CardHeader
          title="Integrado"
          description="Comportamentos que JÁ creditam Fanpoints em runtime. Edite o valor diretamente na coluna 'Pontos' — Enter ou clique fora pra salvar. As mudanças entram em vigor no próximo evento processado (até 60s pra propagar entre instâncias do servidor)."
        />
        <Table<ServerFanpointRule>
          columns={integratedColumns}
          data={rules ?? []}
          rowId={(r) => r.kind}
          pageSize={20}
          loading={rules === null}
        />
      </Card>

      <Card className={styles.fpBrainstormCard}>
        <CardHeader
          title={
            <span className={styles.fpBrainstormTitle}>
              <Badge tone="neutral" size="sm">Brainstorm</Badge>
              Próximas regras (não integradas)
            </span>
          }
          description="Wishlist de comportamentos que valeriam Fanpoints. Cada item aqui ainda PRECISA de backend (novo enum em user_activities.kind + emissor no código). Edite o valor sugerido quando um usuário pedir, e quando implementar passe pra seção Integrado acima."
        />
        <Table<BrainstormRule>
          columns={brainstormColumns}
          data={brainstormRules}
          rowId={(r) => r.id}
          pageSize={20}
        />
      </Card>
    </div>
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

