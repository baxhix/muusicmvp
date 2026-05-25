'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Table, { type Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconHome,
  IconChevronRight,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheckCircle,
  IconUsers,
  IconStar,
  IconSearch,
} from '@/components/icons';
import {
  NIVEIS_DATA,
  KIND_LABEL,
  type NivelTier,
  type NivelTierData,
  type NivelBenefit,
  type NivelMember,
} from '@/data/mock/niveis';
import { formatRelative, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ tier: string }>;
}

type DetailTab = 'benefits' | 'members';

const VALID_TIERS: NivelTier[] = ['top1', 'top10', 'top50', 'top100'];

const KIND_OPTIONS: { value: NivelBenefit['kind']; label: string }[] = [
  { value: 'access',      label: KIND_LABEL.access },
  { value: 'item',        label: KIND_LABEL.item },
  { value: 'event',       label: KIND_LABEL.event },
  { value: 'discount',    label: KIND_LABEL.discount },
  { value: 'recognition', label: KIND_LABEL.recognition },
];

/**
 * Página dedicada de um tier (Top 1 / 10 / 50 / 100).
 *
 * Duas tabs:
 *  - Benefícios — CRUD do que esse tier recebe (criar/editar/
 *    excluir/togglar enabled)
 *  - Membros — lista de quem está atualmente no tier, ordenado
 *    por ranking
 *
 * Mock: tudo client-side via state. O `NIVEIS_DATA` é seed
 * inicial; mudanças vivem só na sessão. Quando o BE cair, troca
 * por hooks (useNivel(tier)) sem mudar a UX.
 */
export default function NivelDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { push } = useToast();
  const { tier: tierParam } = use(params);

  /* Valida slug — se URL veio com tier inexistente, volta pra hub. */
  const validTier = VALID_TIERS.includes(tierParam as NivelTier)
    ? (tierParam as NivelTier)
    : null;

  useEffect(() => {
    if (validTier === null) router.replace('/niveis');
  }, [validTier, router]);

  const seed = useMemo(
    () => NIVEIS_DATA.find((t) => t.tier === validTier),
    [validTier],
  );

  const [tab, setTab] = useState<DetailTab>('benefits');
  const [benefits, setBenefits] = useState<NivelBenefit[]>(
    seed?.benefits ?? [],
  );
  const [editingBenefit, setEditingBenefit] = useState<NivelBenefit | null>(
    null,
  );
  const [creatingBenefit, setCreatingBenefit] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<NivelBenefit | null>(
    null,
  );

  if (!validTier || !seed) return null;

  const activeCount = benefits.filter((b) => b.enabled).length;

  function toggleEnabled(id: string) {
    setBenefits((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)),
    );
  }

  function upsertBenefit(b: NivelBenefit) {
    setBenefits((prev) => {
      const exists = prev.some((x) => x.id === b.id);
      return exists ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b];
    });
    push({
      type: 'success',
      title: 'Benefício salvo',
      description: `"${b.title}" foi atualizado.`,
    });
    setEditingBenefit(null);
    setCreatingBenefit(false);
  }

  function removeBenefit(b: NivelBenefit) {
    setBenefits((prev) => prev.filter((x) => x.id !== b.id));
    push({
      type: 'warning',
      title: 'Benefício removido',
      description: `"${b.title}" foi excluído deste nível.`,
    });
    setPendingRemove(null);
  }

  return (
    <>
      <PageHeader
        title={
          <TierTitle
            label={seed.label}
            tagline={seed.tagline}
            color={seed.color}
          />
        }
        description={null}
        tabs={
          <Tabs<DetailTab>
            variant="bordered"
            items={[
              { id: 'benefits', label: `Benefícios (${benefits.length})` },
              { id: 'members',  label: `Membros (${seed.members.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <div className={styles.body}>
        {/* Breadcrumb estilo Materiais */}
        <nav className={styles.breadcrumb} aria-label="Caminho">
          <button
            type="button"
            className={styles.crumb}
            onClick={() => router.push('/niveis')}
          >
            <IconHome size={13} />
            <span>Níveis</span>
          </button>
          <span className={styles.crumbGroup}>
            <IconChevronRight size={12} className={styles.crumbSep} />
            <button
              type="button"
              className={cn(styles.crumb, styles.crumbActive)}
              disabled
              aria-current="page"
            >
              {seed.label}
            </button>
          </span>
        </nav>

        {tab === 'benefits' ? (
          <BenefitsTab
            tierColor={seed.color}
            benefits={benefits}
            activeCount={activeCount}
            onCreate={() => setCreatingBenefit(true)}
            onEdit={(b) => setEditingBenefit(b)}
            onRemove={(b) => setPendingRemove(b)}
            onToggle={toggleEnabled}
          />
        ) : (
          <MembersTab tierData={seed} />
        )}
      </div>

      <BenefitDialog
        open={creatingBenefit || editingBenefit !== null}
        mode={creatingBenefit ? 'create' : 'edit'}
        benefit={editingBenefit}
        onClose={() => {
          setEditingBenefit(null);
          setCreatingBenefit(false);
        }}
        onSubmit={upsertBenefit}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => pendingRemove && removeBenefit(pendingRemove)}
        title={pendingRemove ? `Remover "${pendingRemove.title}"?` : ''}
        description="O benefício será removido deste nível. Os usuários que recebiam vão perder o acesso imediatamente."
        confirmLabel="Remover benefício"
        destructive
      />
    </>
  );
}

/* ── Title custom (label + tagline com cor temática) ────────── */

function TierTitle({
  label,
  tagline,
  color,
}: {
  label: string;
  tagline: string;
  color: string;
}) {
  return (
    <span className={styles.titleWrap}>
      <span className={styles.titleBadge} style={{ background: color }}>
        <IconStar size={13} />
      </span>
      <span className={styles.titleText}>
        <span className={styles.titleLabel}>{label}</span>
        <span className={styles.titleTagline}>{tagline}</span>
      </span>
    </span>
  );
}

/* ── Tab: Benefícios ──────────────────────────────────────── */

function BenefitsTab({
  tierColor,
  benefits,
  activeCount,
  onCreate,
  onEdit,
  onRemove,
  onToggle,
}: {
  tierColor: string;
  benefits: NivelBenefit[];
  activeCount: number;
  onCreate: () => void;
  onEdit: (b: NivelBenefit) => void;
  onRemove: (b: NivelBenefit) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Benefícios do nível"
        description={`${activeCount} ativo${activeCount === 1 ? '' : 's'} de ${benefits.length}. Liga, desliga, cria e edita livremente.`}
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={onCreate}
          >
            Novo benefício
          </Button>
        }
      />
      {benefits.length === 0 ? (
        <div className={styles.emptyState}>
          <IconStar size={24} />
          <span>Nenhum benefício configurado pra este nível ainda.</span>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={onCreate}
          >
            Criar primeiro benefício
          </Button>
        </div>
      ) : (
        <div className={styles.benefitList}>
          {benefits.map((b) => (
            <div
              key={b.id}
              className={styles.benefitCard}
              data-disabled={!b.enabled}
              style={
                {
                  '--tier-color': tierColor,
                } as React.CSSProperties
              }
            >
              <div className={styles.benefitMain}>
                <div className={styles.benefitHead}>
                  <span className={styles.benefitTitle}>{b.title}</span>
                  <Badge tone="neutral" size="sm">
                    {KIND_LABEL[b.kind]}
                  </Badge>
                  {!b.enabled && (
                    <Badge tone="warning" size="sm">Desativado</Badge>
                  )}
                </div>
                <p className={styles.benefitDescription}>{b.description}</p>
              </div>

              <div className={styles.benefitActions}>
                <label className={styles.toggle} title={b.enabled ? 'Desativar' : 'Ativar'}>
                  <input
                    type="checkbox"
                    checked={b.enabled}
                    onChange={() => onToggle(b.id)}
                  />
                  <span className={styles.toggleTrack} aria-hidden="true">
                    <span className={styles.toggleThumb} />
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Editar"
                  title="Editar"
                  onClick={() => onEdit(b)}
                >
                  <IconEdit size={14} />
                </Button>
                <Button
                  variant="dangerGhost"
                  size="sm"
                  iconOnly
                  aria-label="Remover"
                  title="Remover"
                  onClick={() => onRemove(b)}
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Tab: Membros ─────────────────────────────────────────── */

function MembersTab({ tierData }: { tierData: NivelTierData }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tierData.members;
    return tierData.members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q),
    );
  }, [search, tierData.members]);

  const columns: Column<NivelMember>[] = [
    {
      id: 'rank',
      header: '#',
      sortKey: (m) => m.rank,
      cell: (m) => <span className={styles.rankCell}>#{m.rank}</span>,
      width: 60,
    },
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
      id: 'location',
      header: 'Localização',
      sortKey: (m) => m.location,
      cell: (m) => <span className={styles.memberMute}>{m.location}</span>,
      width: 120,
    },
    {
      id: 'fanpoints',
      header: 'Fanpoints',
      sortKey: (m) => m.fanpoints,
      cell: (m) => (
        <span className={styles.fpCell}>{formatNumber(m.fanpoints)}</span>
      ),
      width: 120,
    },
    {
      id: 'inTier',
      header: 'No tier desde',
      sortKey: (m) => m.inTierSince,
      cell: (m) => (
        <span className={styles.memberMute}>
          {formatRelative(m.inTierSince)}
        </span>
      ),
      width: 160,
    },
  ];

  const slotsUsed = tierData.members.length;
  const remainingSlots = tierData.capacity - slotsUsed;

  return (
    <>
      <Card>
        <CardHeader
          title={`Quem está no ${tierData.label}`}
          description={
            remainingSlots > 0
              ? `${slotsUsed} de ${tierData.capacity} slots preenchidos · ${remainingSlots} aguardando ranking.`
              : `${slotsUsed} de ${tierData.capacity} slots — tier completo.`
          }
          actions={
            <div className={styles.searchWrap}>
              <Input
                inputSize="sm"
                placeholder="Buscar por nome, email ou cidade…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingIcon={<IconSearch size={13} />}
              />
            </div>
          }
        />
        <Table<NivelMember>
          columns={columns}
          data={filtered}
          rowId={(m) => m.id}
          pageSize={15}
          emptyState={
            <div className={styles.emptyState}>
              <IconUsers size={20} />
              <span>
                {search
                  ? 'Nenhum membro corresponde à busca.'
                  : 'Nenhum membro neste tier ainda.'}
              </span>
            </div>
          }
        />
      </Card>
    </>
  );
}

/* ── Dialog: criar/editar benefício ───────────────────────── */

function BenefitDialog({
  open,
  mode,
  benefit,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  benefit: NivelBenefit | null;
  onClose: () => void;
  onSubmit: (b: NivelBenefit) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<NivelBenefit['kind']>('access');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && benefit) {
      setTitle(benefit.title);
      setDescription(benefit.description);
      setKind(benefit.kind);
      setEnabled(benefit.enabled);
    } else {
      setTitle('');
      setDescription('');
      setKind('access');
      setEnabled(true);
    }
  }, [open, mode, benefit]);

  const titleError = !title.trim() ? 'Obrigatório.' : null;
  const descError = !description.trim() ? 'Obrigatório.' : null;
  const canSubmit = !titleError && !descError;

  function handleSubmit() {
    if (!canSubmit) return;
    const id =
      benefit?.id ?? `b_${Math.random().toString(36).slice(2, 10)}`;
    onSubmit({
      id,
      title: title.trim(),
      description: description.trim(),
      kind,
      enabled,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? 'Novo benefício' : `Editar "${benefit?.title}"`}
      description={
        mode === 'create'
          ? 'Defina o que os membros deste tier vão receber. Você pode criar, editar e desativar a qualquer momento.'
          : 'Atualize título, descrição, categoria ou estado deste benefício.'
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconCheckCircle size={14} />}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {mode === 'create' ? 'Criar benefício' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <Input
          label="Título"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex: Acesso ao backstage"
          maxLength={120}
          errorText={title.length > 0 ? titleError ?? undefined : undefined}
        />
        <Textarea
          label="Descrição"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que o usuário recebe? Quando? Como acessa?"
          rows={3}
          maxLength={500}
          errorText={
            description.length > 0 ? descError ?? undefined : undefined
          }
        />
        <Select
          label="Categoria"
          value={kind}
          onChange={(e) => setKind(e.target.value as NivelBenefit['kind'])}
          options={KIND_OPTIONS}
          required
        />
        <label className={styles.dialogToggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Benefício ativo (entregue aos membros)</span>
        </label>
      </div>
    </Dialog>
  );
}
