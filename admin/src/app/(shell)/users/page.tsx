'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import StatCard from '@/components/ui/StatCard';
import UserDetailDrawer from '@/components/admin/UserDetailDrawer';
import {
  IconUsers,
  IconCheckCircle,
  IconShield,
  IconMusic,
  IconBan,
  IconDownload,
  IconCalendar,
} from '@/components/icons';
import { formatNumber, formatPercent } from '@/lib/format';
import { usersService } from '@/services/users';
import type { User, UserSex } from '@/types';
import { cn } from '@/lib/utils';
import styles from './page.module.css';

/* ── Filter helpers ─────────────────────────────────────── */

type AgeRange = '' | 'minor' | '18-24' | '25-34' | '35-44' | '45+';

const AGE_RANGE_OPTIONS = [
  { value: '',       label: 'Todas as idades' },
  { value: 'minor',  label: 'Menor de idade' },
  { value: '18-24',  label: '18–24 anos' },
  { value: '25-34',  label: '25–34 anos' },
  { value: '35-44',  label: '35–44 anos' },
  { value: '45+',    label: '45+ anos' },
];

const SEX_OPTIONS = [
  { value: '',             label: 'Todos os sexos' },
  { value: 'M',            label: 'Masculino' },
  { value: 'F',            label: 'Feminino' },
  { value: 'Outro',        label: 'Outro' },
  { value: 'NaoInformado', label: 'Prefere não informar' },
];

function ageInRange(age: number, range: AgeRange): boolean {
  switch (range) {
    case '':       return true;
    case 'minor':  return age < 18;
    case '18-24':  return age >= 18 && age <= 24;
    case '25-34':  return age >= 25 && age <= 34;
    case '35-44':  return age >= 35 && age <= 44;
    case '45+':    return age >= 45;
  }
}

function formatStreamDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

function parseInputDate(value: string): string | null {
  // Accepts DD/MM/YY, DD/MM/YYYY, or YYYY-MM-DD (native date)
  if (!value) return null;
  const native = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (native) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  }
  const parts = value.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.length === 4 ? y.slice(2) : y.padStart(2, '0')}`;
    }
  }
  return null;
}

/* ── Page ───────────────────────────────────────────────── */

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [filters, setFilters] = useState({
    name: '',
    location: '',
    age: '' as AgeRange,
    sex: '' as '' | UserSex,
    streamDate: '',
    streamSong: '',
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'ban' | 'block'; user: User }
    | null
  >(null);
  const { push } = useToast();

  useEffect(() => {
    usersService
      .list()
      .then(setUsers)
      .catch((err) => {
        // Surface fetch failures instead of leaving the table stuck in
        // loading state forever. Falling back to [] also flips the
        // Table out of skeleton mode so the user sees the empty-state
        // copy rather than spinning indefinitely.
        console.error('usersService.list failed:', err);
        setUsers([]);
      });
  }, []);

  /* ── Aggregates for KPIs ─────────────────────────────── */
  const kpis = useMemo(() => {
    if (!users) return null;
    const total = users.length;
    const active = users.filter((u) => u.status === 'active').length;
    const minors = users.filter((u) => u.age < 18).length;
    const totalStreams = users.reduce((acc, u) => acc + u.totalStreams, 0);
    const avgStreams = total > 0 ? Math.round(totalStreams / total) : 0;
    return {
      total,
      active,
      minors,
      avgStreams,
      activeRatio: total > 0 ? active / total : 0,
      minorsRatio: total > 0 ? minors / total : 0,
    };
  }, [users]);

  /* ── Filtered list ──────────────────────────────────────
   *
   * useDeferredValue desacopla a digitação dos filtros do recálculo
   * pesado do filter — o input fica snappy enquanto a tabela
   * atualiza de forma async. Crítico em bases com milhares de
   * usuários. Sem isto, cada keystroke ia rodar o filter loop
   * inteiro + re-render da Table como prioridade alta. */
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => {
    if (!users) return [];
    const name = deferredFilters.name.trim().toLowerCase();
    const location = deferredFilters.location.trim().toLowerCase();
    const song = deferredFilters.streamSong.trim().toLowerCase();
    const targetDate = parseInputDate(deferredFilters.streamDate);

    return users.filter((u) => {
      if (name && !u.name.toLowerCase().includes(name) && !u.email.toLowerCase().includes(name)) return false;
      if (location) {
        const hay = `${u.city} ${u.state} ${u.city.toLowerCase()}-${u.state.toLowerCase()}`.toLowerCase();
        if (!hay.includes(location)) return false;
      }
      if (deferredFilters.age && !ageInRange(u.age, deferredFilters.age)) return false;
      if (deferredFilters.sex && u.sex !== deferredFilters.sex) return false;
      if (targetDate) {
        if (!u.lastStream || formatStreamDate(u.lastStream.playedAt) !== targetDate) return false;
      }
      if (song) {
        if (!u.lastStream || !u.lastStream.title.toLowerCase().includes(song)) return false;
      }
      return true;
    });
  }, [users, deferredFilters]);

  /* ── Actions ──────────────────────────────────────────── */
  function handleBan(user: User) {
    setPendingAction({ kind: 'ban', user });
  }
  function handleBlock(user: User) {
    setPendingAction({ kind: 'block', user });
  }
  function confirmAction() {
    if (!pendingAction || !users) return;
    const { kind, user } = pendingAction;
    const newStatus = kind === 'ban' ? 'banned' : 'suspended';
    setUsers(users.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
    if (selectedUser?.id === user.id) {
      setSelectedUser({ ...user, status: newStatus });
    }
    push({
      type: kind === 'ban' ? 'error' : 'warning',
      title: kind === 'ban' ? `${user.name} foi banido` : `${user.name} foi bloqueado`,
      description:
        kind === 'ban'
          ? 'Acesso permanente revogado. Conta marcada como banida.'
          : 'Acesso suspenso temporariamente. Pode ser reativado depois.',
    });
    setPendingAction(null);
  }

  function openDrawer(user: User) {
    setSelectedUser(user);
    setDrawerOpen(true);
  }

  /* ── Table columns ──────────────────────────────────────
   *
   * useMemo([]) porque a definição é estática — as cell functions
   * só fecham sobre handleBan/handleBlock, que por sua vez chamam
   * setPendingAction (referência estável do useState setter). Sem
   * o memo, cada keystroke do filtro recria todas as cell functions,
   * forçando a Table a remontar todas as células. */
  const columns: Column<User>[] = useMemo(() => [
    {
      id: 'user',
      header: 'Usuário',
      sortKey: (u) => u.name,
      cell: (u) => {
        // Surface blocked / banned status loud and early so an
        // operator scrolling the list spots offenders without
        // having to read the actions column. Ring on the avatar +
        // pill chip under the email = two visual hooks per row.
        const isBanned    = u.status === 'banned';
        const isSuspended = u.status === 'suspended';
        const isFlagged   = isBanned || isSuspended;
        return (
          <div className={cn(styles.cellUser, isFlagged && styles.cellUserFlagged)}>
            <Avatar
              name={u.name}
              src={u.avatar}
              size="md"
              className={cn(
                isBanned    && styles.avatarBanned,
                isSuspended && styles.avatarBlocked,
              )}
            />
            <div className={styles.cellUserText}>
              <span className={styles.cellUserName}>{u.name}</span>
              <span className={styles.cellUserEmail}>{u.email}</span>
              {isFlagged && (
                <Badge tone="danger" size="sm" className={styles.moderationBadge}>
                  {isBanned ? 'Banido' : 'Bloqueado'}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'location',
      header: 'Cidade-Estado',
      sortKey: (u) => `${u.city}-${u.state}`,
      cell: (u) => (
        <span className={styles.cellLocation}>
          {u.city}-{u.state}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Idade',
      sortKey: (u) => u.age,
      cell: (u) => <span className={styles.cellAge}>{u.age} anos</span>,
      width: 90,
    },
    {
      id: 'lastStream',
      header: 'Último stream',
      sortKey: (u) => u.lastStream?.playedAt ?? '',
      cell: (u) =>
        u.lastStream ? (
          <div className={styles.cellStream}>
            <span className={styles.cellStreamDate}>
              {formatStreamDate(u.lastStream.playedAt)}
            </span>
            <span className={styles.cellStreamSong}>{u.lastStream.title}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (u) => (u.isOnline ? 0 : 1),
      cell: (u) => (
        <span className={cn(u.isOnline ? styles.statusOnline : styles.statusOffline)}>
          <span className={styles.statusDot} />
          {u.isOnline ? 'Online' : 'Offline'}
        </span>
      ),
      width: 110,
    },
    {
      id: 'superfan',
      header: 'Superfã',
      sortKey: (u) => u.fanpoints,
      cell: (u) => (
        <div className={styles.cellSuperfan}>
          {u.plan === 'superfan' && (
            <Badge tone="brand" size="sm" dot>
              Superfã
            </Badge>
          )}
          <span className={styles.cellFP}>
            {formatNumber(u.fanpoints)} FP
          </span>
        </div>
      ),
      width: 140,
    },
    {
      id: 'actions',
      header: 'Ação',
      align: 'right',
      cell: (u) => (
        <div className={styles.cellActions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            className={styles.blockBtn}
            aria-label={`Bloquear ${u.name}`}
            title="Bloquear"
            onClick={() => handleBlock(u)}
            disabled={u.status === 'suspended' || u.status === 'banned'}
          >
            <IconShield size={14} />
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Banir ${u.name}`}
            title="Banir"
            onClick={() => handleBan(u)}
            disabled={u.status === 'banned'}
          >
            <IconBan size={14} />
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Base detalhada para leitura compacta, filtros operacionais e investigação individual sem perder contexto."
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<IconDownload size={14} />}>
            Exportar
          </Button>
        }
      />

      <div className={styles.body}>
        <div className={styles.kpiGrid}>
          <StatCard
            icon={<IconUsers size={14} />}
            value={kpis ? formatNumber(kpis.total) : '—'}
            label="Total de usuários"
          />
          <StatCard
            icon={<IconCheckCircle size={14} />}
            value={kpis ? formatNumber(kpis.active) : '—'}
            secondary={kpis ? formatPercent(kpis.activeRatio) : undefined}
            label="Usuários ativos"
          />
          <StatCard
            icon={<IconShield size={14} />}
            value={kpis ? formatNumber(kpis.minors) : '—'}
            secondary={kpis ? formatPercent(kpis.minorsRatio) : undefined}
            label="Menores de idade"
          />
          <StatCard
            icon={<IconMusic size={14} />}
            value={kpis ? formatNumber(kpis.avgStreams) : '—'}
            label="Média de reproduções por usuário"
          />
        </div>

        <Card>
          <CardHeader
            title="Base de usuários"
            description="Lista compacta com filtros analíticos e acesso rápido ao histórico individual."
          />

          <div className={styles.filters}>
            <Input
              inputSize="md"
              placeholder="Nome do usuário"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            />
            <Input
              inputSize="md"
              placeholder="Cidade/Estado"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
            <Select
              inputSize="md"
              value={filters.age}
              onChange={(e) =>
                setFilters({ ...filters, age: e.target.value as AgeRange })
              }
              options={AGE_RANGE_OPTIONS}
            />
            <Select
              inputSize="md"
              value={filters.sex}
              onChange={(e) =>
                setFilters({ ...filters, sex: e.target.value as '' | UserSex })
              }
              options={SEX_OPTIONS}
            />
            <Input
              inputSize="md"
              placeholder="Último stream (DD/MM/AA)"
              value={filters.streamDate}
              onChange={(e) => setFilters({ ...filters, streamDate: e.target.value })}
              leadingIcon={<IconCalendar size={14} />}
            />
            <Input
              inputSize="md"
              placeholder="Música do último stream"
              value={filters.streamSong}
              onChange={(e) => setFilters({ ...filters, streamSong: e.target.value })}
            />
          </div>

          <Table<User>
            columns={columns}
            data={filtered}
            rowId={(u) => u.id}
            onRowClick={openDrawer}
            pageSize={12}
            loading={users === null}
          />
        </Card>
      </div>

      <UserDetailDrawer
        user={selectedUser}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onBan={handleBan}
        onBlock={handleBlock}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmAction}
        destructive={pendingAction?.kind === 'ban'}
        title={
          pendingAction?.kind === 'ban'
            ? `Banir ${pendingAction.user.name}?`
            : pendingAction?.kind === 'block'
              ? `Bloquear ${pendingAction.user.name}?`
              : ''
        }
        description={
          pendingAction?.kind === 'ban'
            ? 'A conta perde acesso permanente à plataforma. Essa ação pode ser revertida só por um admin senior.'
            : pendingAction?.kind === 'block'
              ? 'O acesso é suspenso temporariamente. Você pode reativar depois pela tela de detalhe.'
              : ''
        }
        confirmLabel={pendingAction?.kind === 'ban' ? 'Banir conta' : 'Bloquear conta'}
      />
    </>
  );
}
