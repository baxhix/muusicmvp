'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table, { type Column } from '@/components/ui/Table';
import {
  IconPlus,
  IconSearch,
  IconArchive,
  IconDownload,
  IconHeart,
  IconFeed,
  IconImage,
} from '@/components/icons';
import {
  loadMateriais,
  summarizeByCategoria,
  MATERIAL_CATEGORIA_META,
  MATERIAL_STATUS_LABEL,
  type MaterialItem,
  type MaterialCategoria,
  type MaterialStatus,
} from '@/data/mock/materiais';
import { formatNumber, formatRelative, formatDate } from '@/lib/format';
import styles from './page.module.css';

/**
 * Materiais — acervo de conteúdo exclusivo da Ana Castela pros
 * superfãs do Fanverse.
 *
 * Concepção: este NÃO é o feed (cronológico, efêmero). É o
 * ACERVO permanente — álbuns de fotos de shows, álbuns musicais
 * exclusivos, wallpapers, figurinhas, templates, logotipos.
 * Algumas peças também viram posts no feed (flag
 * `publishedToFeed`), mas o acervo é a "biblioteca" sempre
 * acessível.
 *
 * Layout:
 *   1. PageHeader + ação "Novo material"
 *   2. KPIs (4 cards): total, downloads, no feed, categorias
 *   3. Grid de 6 categorias com count + downloads agregados
 *   4. Filtros (search + status + categoria)
 *   5. Tabela com lista filtrada de itens
 *
 * Dados mockados via `loadMateriais()`. Quando o backend cair,
 * troca-se a função sem mudar os renderers.
 */

const STATUS_TONE: Record<MaterialStatus, BadgeTone> = {
  rascunho:  'neutral',
  publicado: 'success',
  agendado:  'info',
  arquivado: 'warning',
};

const STATUS_OPTIONS: { value: MaterialStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todos os status' },
  { value: 'publicado', label: 'Publicados' },
  { value: 'agendado',  label: 'Agendados' },
  { value: 'rascunho',  label: 'Rascunhos' },
  { value: 'arquivado', label: 'Arquivados' },
];

const CATEGORIA_OPTIONS: { value: MaterialCategoria | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas as categorias' },
  ...(Object.values(MATERIAL_CATEGORIA_META).map((m) => ({
    value: m.id,
    label: m.label,
  }))),
];

/** Formata bytes em KB/MB/GB. Inline porque não é usado em outro
 *  lugar do admin ainda — quando virar, promove pra format.ts. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

export default function MateriaisPage() {
  const [items] = useState<MaterialItem[]>(() => loadMateriais());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MaterialStatus | 'all'>('all');
  const [categoria, setCategoria] = useState<MaterialCategoria | 'all'>('all');

  /* Sumário das categorias — usado pelos cards de visão geral
   * (independente dos filtros, sempre mostra o acervo inteiro). */
  const categoriaSummary = useMemo(() => summarizeByCategoria(items), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (status !== 'all' && m.status !== status) return false;
      if (categoria !== 'all' && m.categoria !== categoria) return false;
      if (q) {
        const hay = `${m.titulo} ${MATERIAL_CATEGORIA_META[m.categoria].label} ${m.descricao}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, status, categoria]);

  const summary = useMemo(() => {
    const total = items.length;
    const totalDownloads = items.reduce((sum, m) => sum + m.downloads, 0);
    const noFeed = items.filter((m) => m.publishedToFeed).length;
    const categoriasAtivas = Object.values(categoriaSummary).filter(
      (s) => s.count > 0,
    ).length;
    return { total, totalDownloads, noFeed, categoriasAtivas };
  }, [items, categoriaSummary]);

  const columns: Column<MaterialItem>[] = [
    {
      id: 'titulo',
      header: 'Material',
      sortKey: (m) => m.titulo,
      cell: (m) => (
        <div className={styles.cellMaterial}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.thumb} alt="" className={styles.cellThumb} />
          <div className={styles.cellInfo}>
            <span className={styles.cellTitulo}>{m.titulo}</span>
            <span className={styles.cellDesc}>{m.descricao}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'categoria',
      header: 'Categoria',
      sortKey: (m) => m.categoria,
      cell: (m) => (
        <span className={styles.categoriaChip}>
          {MATERIAL_CATEGORIA_META[m.categoria].label}
        </span>
      ),
      width: 160,
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (m) => m.status,
      cell: (m) => (
        <Badge tone={STATUS_TONE[m.status]} size="sm" dot>
          {MATERIAL_STATUS_LABEL[m.status]}
        </Badge>
      ),
      width: 120,
    },
    {
      id: 'downloads',
      header: 'Downloads',
      sortKey: (m) => m.downloads,
      align: 'right',
      cell: (m) => (
        <span className={styles.numCell}>{formatNumber(m.downloads)}</span>
      ),
      width: 110,
    },
    {
      id: 'favoritos',
      header: 'Favoritos',
      sortKey: (m) => m.favoritos,
      align: 'right',
      cell: (m) => (
        <span className={styles.numCellMute}>{formatNumber(m.favoritos)}</span>
      ),
      width: 110,
    },
    {
      id: 'tamanho',
      header: 'Tamanho',
      sortKey: (m) => m.tamanhoBytes,
      align: 'right',
      cell: (m) => (
        <span className={styles.muteCell}>{formatBytes(m.tamanhoBytes)}</span>
      ),
      width: 100,
    },
    {
      id: 'publicadoEm',
      header: 'Publicado',
      sortKey: (m) => m.publicadoEm,
      cell: (m) => (
        <div className={styles.dateCell}>
          <span className={styles.dateRel}>
            {m.status === 'agendado'
              ? `em ${formatDate(m.publicadoEm)}`
              : formatRelative(m.publicadoEm)}
          </span>
          {m.publishedToFeed && (
            <span className={styles.feedBadge} title="Também publicado no feed">
              <IconFeed size={11} /> No feed
            </span>
          )}
        </div>
      ),
      width: 160,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Materiais"
        description="Acervo de conteúdo exclusivo pros superfãs — fotos de shows, álbuns, wallpapers, figurinhas, templates e logotipos. Algumas peças também viram posts no feed; aqui é a biblioteca permanente."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            disabled
            title="Upload de material indisponível até a integração com storage ser ligada."
          >
            Novo material
          </Button>
        }
      />

      {/* ── KPIs ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Total no acervo"
          value={String(summary.total)}
          icon={<IconArchive size={14} />}
          trendLabel={`${summary.categoriasAtivas} categorias ativas`}
        />
        <StatCard
          label="Downloads totais"
          value={formatNumber(summary.totalDownloads)}
          icon={<IconDownload size={14} />}
          trendLabel="Somatório de todos os itens"
        />
        <StatCard
          label="Publicados no feed"
          value={String(summary.noFeed)}
          icon={<IconFeed size={14} />}
          trendLabel="Viraram post além de viverem no acervo"
        />
        <StatCard
          label="Favoritos"
          value={formatNumber(items.reduce((s, m) => s + m.favoritos, 0))}
          icon={<IconHeart size={14} />}
          trendLabel="Saves de fãs em todos os materiais"
        />
      </div>

      {/* ── Categoria overview ────────────────────────── */}
      <section className={styles.categoriaSection}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Por categoria</h2>
          <span className={styles.sectionHint}>
            Clique pra filtrar a tabela abaixo
          </span>
        </div>
        <div className={styles.categoriaGrid}>
          {Object.values(MATERIAL_CATEGORIA_META).map((cat) => {
            const stats = categoriaSummary[cat.id];
            const active = categoria === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.categoriaCard} ${active ? styles.categoriaCardActive : ''}`}
                onClick={() =>
                  setCategoria((prev) => (prev === cat.id ? 'all' : cat.id))
                }
                aria-pressed={active}
              >
                <span className={styles.categoriaIcon} aria-hidden="true">
                  <IconImage size={14} />
                </span>
                <span className={styles.categoriaLabel}>{cat.label}</span>
                <span className={styles.categoriaDesc}>{cat.description}</span>
                <div className={styles.categoriaStats}>
                  <span className={styles.categoriaCount}>
                    <strong>{stats.count}</strong> {stats.count === 1 ? 'item' : 'itens'}
                  </span>
                  <span className={styles.categoriaDownloads}>
                    {formatNumber(stats.downloads)} downloads
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Filters ───────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por título ou descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={categoria}
          onChange={(e) =>
            setCategoria(e.target.value as MaterialCategoria | 'all')
          }
          options={CATEGORIA_OPTIONS}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as MaterialStatus | 'all')}
          options={STATUS_OPTIONS}
        />
      </Card>

      {/* ── Tabela ────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        <Table<MaterialItem>
          columns={columns}
          data={filtered}
          rowId={(m) => m.id}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
