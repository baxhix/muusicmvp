'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table, { type Column } from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import {
  IconPlus,
  IconTrash,
  IconLink,
  IconUsers,
  IconBan,
} from '@/components/icons';
import {
  acquisitionService,
  buildShareableUrl,
  type AdminArtistLink,
} from '@/services/acquisition';
import { formatNumber } from '@/lib/format';
import styles from './page.module.css';

/**
 * Aquisição — listagem de signup links por artista.
 *
 * Cada link tem um slug único (`/r/{slug}`) compartilhável nas
 * redes. Usuários que entram via esse link e completam signup
 * ficam atribuídos via users.signup_link_id — o admin vê quantos
 * vieram de cada um. Clicar numa linha abre o detail com a lista
 * de users atribuídos.
 */
export default function AquisicaoPage() {
  const router = useRouter();
  const { push } = useToast();
  const [items, setItems] = useState<AdminArtistLink[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<AdminArtistLink | null>(
    null,
  );
  const [archiving, setArchiving] = useState(false);

  const loadAll = useCallback(() => {
    acquisitionService
      .list()
      .then((res) => setItems(res.items))
      .catch((err: unknown) => {
        push({
          type: 'error',
          title: 'Erro ao carregar links',
          description: err instanceof Error ? err.message : '',
        });
        setItems([]);
      });
  }, [push]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const stats = useMemo(() => {
    if (!items) return null;
    const active = items.filter((i) => !i.archivedAt).length;
    const totalSignups = items.reduce((acc, i) => acc + i.signupCount, 0);
    return { total: items.length, active, totalSignups };
  }, [items]);

  /* Click na linha → detail page. Trash button stopPropagation
   * pra não disparar isso. */
  function openDetail(link: AdminArtistLink) {
    router.push(`/aquisicao/${link.id}`);
  }

  async function handleArchive() {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await acquisitionService.archive(pendingArchive.id);
      push({
        type: 'success',
        title: 'Link arquivado',
        description: `"${pendingArchive.slug}" não receberá novos signups.`,
      });
      setPendingArchive(null);
      loadAll();
    } catch (err: unknown) {
      push({
        type: 'error',
        title: 'Erro ao arquivar',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setArchiving(false);
    }
  }

  async function copyToClipboard(slug: string) {
    const url = buildShareableUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      push({
        type: 'success',
        title: 'Link copiado',
        description: url,
      });
    } catch {
      push({
        type: 'error',
        title: 'Não foi possível copiar',
        description: 'Selecione e copie manualmente.',
      });
    }
  }

  const columns: Column<AdminArtistLink>[] = useMemo(
    () => [
      {
        id: 'artist',
        header: 'Artista / Campanha',
        sortKey: (i) => i.artistName,
        cell: (i) => (
          <div className={styles.cellMain}>
            <div className={styles.cellHead}>
              <span className={styles.cellTitle}>{i.artistName}</span>
              {i.archivedAt && (
                <Badge tone="neutral" size="sm">
                  Arquivado
                </Badge>
              )}
            </div>
            {i.label && (
              <span className={styles.cellSub}>{i.label}</span>
            )}
            <code className={styles.cellSlug}>/r/{i.slug}</code>
          </div>
        ),
      },
      {
        id: 'signups',
        header: 'Signups',
        sortKey: (i) => i.signupCount,
        cell: (i) => (
          <span className={styles.signupCount}>
            {formatNumber(i.signupCount)}
          </span>
        ),
        width: 120,
      },
      {
        id: 'created',
        header: 'Criado em',
        sortKey: (i) => i.createdAt,
        cell: (i) =>
          new Date(i.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
        width: 140,
      },
      {
        id: 'actions',
        header: '',
        cell: (i) => (
          <div className={styles.rowActions}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Copiar link"
              title="Copiar link compartilhável"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(i.slug);
              }}
            >
              <IconLink size={14} />
            </Button>
            {!i.archivedAt && (
              <Button
                variant="dangerGhost"
                size="sm"
                iconOnly
                aria-label="Arquivar"
                title="Arquivar (não recebe novos signups)"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingArchive(i);
                }}
              >
                <IconTrash size={14} />
              </Button>
            )}
          </div>
        ),
        width: 100,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <PageHeader
        title="Aquisição"
        description="Links exclusivos por artista. Cada signup feito via /r/{slug} fica atribuído ao link de origem."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={() => setCreateOpen(true)}
          >
            Novo link
          </Button>
        }
      />

      <div className={styles.body}>
        <div className={styles.kpiGrid}>
          <StatCard
            icon={<IconLink size={14} />}
            value={stats ? formatNumber(stats.total) : '—'}
            label="Links no total"
          />
          <StatCard
            icon={<IconUsers size={14} />}
            value={stats ? formatNumber(stats.active) : '—'}
            label="Ativos"
          />
          <StatCard
            icon={<IconBan size={14} />}
            value={stats ? formatNumber(stats.totalSignups) : '—'}
            label="Signups atribuídos"
          />
        </div>

        <Card>
          <CardHeader
            title="Links de aquisição"
            description="Clique numa linha pra ver os usuários que entraram por aquele link."
          />
          <Table<AdminArtistLink>
            columns={columns}
            data={items ?? []}
            rowId={(i) => i.id}
            onRowClick={openDetail}
            pageSize={20}
            loading={items === null}
            emptyState={
              <div className={styles.emptyState}>
                <IconLink size={20} />
                <span>
                  Nenhum link ainda. Clique em <b>Novo link</b> pra
                  criar o primeiro.
                </span>
              </div>
            }
          />
        </Card>
      </div>

      <CreateLinkDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          loadAll();
        }}
      />

      <ConfirmDialog
        open={pendingArchive !== null}
        onClose={() => !archiving && setPendingArchive(null)}
        title={
          pendingArchive
            ? `Arquivar "${pendingArchive.artistName}"?`
            : 'Arquivar'
        }
        description={
          pendingArchive
            ? `O link /r/${pendingArchive.slug} para de receber novos signups. Os ${pendingArchive.signupCount} usuário(s) já atribuídos continuam vinculados ao histórico.`
            : ''
        }
        confirmLabel={archiving ? 'Arquivando…' : 'Arquivar'}
        destructive
        onConfirm={handleArchive}
        loading={archiving}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateLinkDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const { push } = useToast();
  const [slug, setSlug] = useState('');
  const [artistName, setArtistName] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug('');
      setArtistName('');
      setLabel('');
    }
  }, [open]);

  /* Slug auto-suggestion: normaliza o artistName pra lowercase
   * kebab-case na primeira digitação. Usuário pode sobrescrever. */
  function onArtistNameChange(v: string) {
    setArtistName(v);
    if (!slug) {
      const auto = v
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(auto.slice(0, 60));
    }
  }

  async function handleSave() {
    if (!slug.trim() || !artistName.trim()) return;
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      push({
        type: 'error',
        title: 'Slug inválido',
        description: 'Use só letras minúsculas, números, hífen e underscore.',
      });
      return;
    }
    setSaving(true);
    try {
      await acquisitionService.create({
        slug: slug.trim(),
        artistName: artistName.trim(),
        label: label.trim() || null,
      });
      push({
        type: 'success',
        title: 'Link criado',
        description: `Compartilhável em ${buildShareableUrl(slug)}.`,
      });
      onCreated();
    } catch (err: unknown) {
      push({
        type: 'error',
        title: 'Erro ao criar',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo link de aquisição"
      description="Cria um link compartilhável para um artista. Usuários que entrarem por ele ficam atribuídos."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!slug.trim() || !artistName.trim()}
          >
            Criar link
          </Button>
        </>
      }
    >
      <div className={styles.dialogForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Artista / Campanha</span>
          <Input
            value={artistName}
            onChange={(e) => onArtistNameChange(e.target.value)}
            placeholder="Ex: Ana Castela"
            maxLength={120}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Slug (URL)</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="ana-castela"
            maxLength={60}
          />
          {slug && (
            <span className={styles.fieldHint}>
              Link público: <code>{buildShareableUrl(slug)}</code>
            </span>
          )}
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Rótulo interno <span className={styles.optional}>(opcional)</span>
          </span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Story do Insta — semana 3"
            maxLength={200}
          />
        </label>
      </div>
    </Dialog>
  );
}
