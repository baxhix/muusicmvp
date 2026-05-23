'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import StatCard from '@/components/ui/StatCard';
import {
  IconPlus,
  IconSearch,
  IconArchive,
  IconDownload,
  IconFeed,
  IconFolder,
  IconFolderOpen,
  IconHome,
  IconFile,
  IconImage,
  IconMusic,
  IconVideo,
  IconChevronRight,
  IconTrash,
} from '@/components/icons';
import {
  loadMateriaisTree,
  childrenOf,
  pathOf,
  findNode,
  countFilesDeep,
  summarizeTree,
  type MaterialNode,
  type MaterialFolder,
  type MaterialFile,
  type MaterialFormato,
} from '@/data/mock/materiais';
import { formatNumber, formatRelative } from '@/lib/format';
import { formatBytes } from './shared';
import MaterialPreviewDrawer from './MaterialPreviewDrawer';
import styles from './page.module.css';

/**
 * Materiais — navegador de arquivos hierárquico do acervo da
 * artista. Per product feedback "estilo pastas e subpastas, como
 * do Google Drive, finder, etc. Com caminho em forma de
 * breadcrumb, preview e cta para download e exclusão".
 *
 * Arquitetura:
 *   - State `currentFolderId` (null = raiz) navega na árvore
 *   - State `selectedFileId` abre o preview drawer com Download +
 *     Excluir
 *   - Breadcrumb mostra o caminho da raiz até a pasta atual
 *   - Grid view por padrão (cards de pasta + cards de arquivo)
 *
 * Backend pendente — handleDownload e handleDelete são stubs
 * informativos. Quando ligados, basta swap as funções por
 * fetches; o shape dos nós é estável.
 */

/** Mapeia formato → ícone usado no card do arquivo. */
function fileFormatIcon(formato: MaterialFormato) {
  switch (formato) {
    case 'jpg':
    case 'png':
    case 'svg':
      return IconImage;
    case 'mp3':
      return IconMusic;
    case 'mp4':
      return IconVideo;
    default:
      return IconFile;
  }
}

export default function MateriaisPage() {
  const [nodes] = useState<MaterialNode[]>(() => loadMateriaisTree());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  /* Derived: caminho de pastas do root até a atual (pra breadcrumb)
   * e filhos diretos do folder atual (pra grid). */
  const breadcrumb = useMemo(
    () => pathOf(nodes, currentFolderId),
    [nodes, currentFolderId],
  );
  const currentChildren = useMemo(() => {
    const all = childrenOf(nodes, currentFolderId);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((n) => {
      const hay = `${n.name} ${n.type === 'file' ? n.description : (n as MaterialFolder).description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [nodes, currentFolderId, search]);

  const folders = currentChildren.filter(
    (n): n is MaterialFolder => n.type === 'folder',
  );
  const files = currentChildren.filter(
    (n): n is MaterialFile => n.type === 'file',
  );

  /* Sumário global pros KPIs no header — não depende do folder
   * atual; sempre reflete o acervo inteiro. */
  const summary = useMemo(() => summarizeTree(nodes), [nodes]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    const n = findNode(nodes, selectedFileId);
    return n && n.type === 'file' ? n : null;
  }, [nodes, selectedFileId]);

  /* Handlers — backend stubs. Quando ligados, swap pelas chamadas
   * reais. Por ora `alert` cumpre o papel de feedback. */
  function handleDownload(file: MaterialFile) {
    // TODO: GET /api/admin/materiais/{id}/download → blob
    alert(
      `Download mockado: ${file.name}\n(${formatBytes(file.tamanhoBytes)})\n\nQuando o backend ligar, substitua o stub por\nfetch('/api/admin/materiais/${file.id}/download').`,
    );
  }

  function handleDelete(file: MaterialFile) {
    const ok = confirm(
      `Excluir "${file.name}"?\n\nEsta ação remove o arquivo do acervo e desfaz qualquer post no feed associado a ele.`,
    );
    if (!ok) return;
    // TODO: DELETE /api/admin/materiais/{id}
    alert('Exclusão mockada — backend pendente.');
    setSelectedFileId(null);
  }

  function navigateTo(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSearch('');
  }

  const currentFolder = breadcrumb[breadcrumb.length - 1] ?? null;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Materiais"
        description="Acervo de conteúdo exclusivo pros superfãs. Navegue por pastas — fotos de shows, álbuns, wallpapers, figurinhas, templates e logotipos."
        actions={
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<IconFolderOpen size={14} />}
              disabled
              title="Criar pasta indisponível até a integração com storage ser ligada."
            >
              Nova pasta
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              disabled
              title="Upload indisponível até a integração com storage ser ligada."
            >
              Upload
            </Button>
          </div>
        }
      />

      {/* ── KPIs ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Arquivos no acervo"
          value={formatNumber(summary.totalFiles)}
          icon={<IconArchive size={14} />}
          trendLabel={`${summary.totalFolders} pastas`}
        />
        <StatCard
          label="Downloads totais"
          value={formatNumber(summary.totalDownloads)}
          icon={<IconDownload size={14} />}
          trendLabel="Somatório de todos os arquivos"
        />
        <StatCard
          label="Publicados no feed"
          value={String(summary.noFeed)}
          icon={<IconFeed size={14} />}
          trendLabel="Viraram post além do acervo"
        />
        <StatCard
          label="Tamanho total"
          value={formatBytes(summary.totalBytes)}
          trendLabel={`${formatNumber(summary.totalFavoritos)} favoritos`}
        />
      </div>

      {/* ── Breadcrumb + search ───────────────────────── */}
      <Card className={styles.toolbar}>
        <nav className={styles.breadcrumb} aria-label="Caminho">
          {/* Root crumb — sempre presente. */}
          <button
            type="button"
            className={`${styles.crumb} ${currentFolderId === null ? styles.crumbActive : ''}`}
            onClick={() => navigateTo(null)}
          >
            <IconHome size={13} />
            <span>Materiais</span>
          </button>

          {breadcrumb.map((folder, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <span key={folder.id} className={styles.crumbGroup}>
                <IconChevronRight size={12} className={styles.crumbSep} />
                <button
                  type="button"
                  className={`${styles.crumb} ${isLast ? styles.crumbActive : ''}`}
                  onClick={() => navigateTo(folder.id)}
                  disabled={isLast}
                >
                  {folder.name}
                </button>
              </span>
            );
          })}
        </nav>

        <Input
          inputSize="sm"
          placeholder="Buscar nesta pasta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={13} />}
          className={styles.searchInput}
        />
      </Card>

      {/* ── Folder header (when inside a folder) ──────── */}
      {currentFolder && (
        <header className={styles.folderHeader}>
          <div className={styles.folderHeaderLeft}>
            <div className={styles.folderIconBig}>
              <IconFolderOpen size={18} />
            </div>
            <div>
              <h2 className={styles.folderTitle}>{currentFolder.name}</h2>
              {currentFolder.description && (
                <p className={styles.folderDesc}>{currentFolder.description}</p>
              )}
            </div>
          </div>
          <div className={styles.folderMeta}>
            <span>{folders.length} {folders.length === 1 ? 'subpasta' : 'subpastas'}</span>
            <span className={styles.folderMetaSep}>·</span>
            <span>{files.length} {files.length === 1 ? 'arquivo' : 'arquivos'}</span>
          </div>
        </header>
      )}

      {/* ── Empty state ───────────────────────────────── */}
      {currentChildren.length === 0 && (
        <Card className={styles.emptyCard}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <IconFolder size={20} />
          </div>
          <div className={styles.emptyTitle}>Nada por aqui</div>
          <div className={styles.emptyHint}>
            {search.trim()
              ? `Nenhum item corresponde a "${search.trim()}".`
              : 'Esta pasta está vazia. Use "Upload" pra adicionar o primeiro arquivo.'}
          </div>
        </Card>
      )}

      {/* ── Folder grid ───────────────────────────────── */}
      {folders.length > 0 && (
        <section className={styles.gridSection}>
          <h3 className={styles.sectionLabel}>Pastas</h3>
          <div className={styles.folderGrid}>
            {folders.map((folder) => {
              const count = countFilesDeep(nodes, folder.id);
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={styles.folderCard}
                  onDoubleClick={() => navigateTo(folder.id)}
                  onClick={() => navigateTo(folder.id)}
                >
                  <div className={styles.folderCardTop}>
                    <span className={styles.folderCardIcon}>
                      <IconFolder size={14} />
                    </span>
                  </div>
                  <span className={styles.folderCardName}>{folder.name}</span>
                  <span className={styles.folderCardMeta}>
                    {count} {count === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── File grid ─────────────────────────────────── */}
      {files.length > 0 && (
        <section className={styles.gridSection}>
          <h3 className={styles.sectionLabel}>Arquivos</h3>
          <div className={styles.fileGrid}>
            {files.map((file) => {
              const FormatIcon = fileFormatIcon(file.formato);
              const isSelected = selectedFileId === file.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  className={`${styles.fileCard} ${isSelected ? styles.fileCardSelected : ''}`}
                  onClick={() => setSelectedFileId(file.id)}
                  aria-label={`Abrir preview de ${file.name}`}
                >
                  {/* Thumbnail */}
                  <div className={styles.fileThumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.thumb} alt="" />
                    <span className={styles.fileBadge}>
                      <FormatIcon size={11} />
                      <span>{file.formato.toUpperCase()}</span>
                    </span>
                    {file.publishedToFeed && (
                      <span className={styles.fileFeedBadge} title="Publicado no feed">
                        <IconFeed size={10} />
                      </span>
                    )}
                  </div>
                  {/* Footer card */}
                  <div className={styles.fileBody}>
                    <span className={styles.fileName}>{file.name}</span>
                    <div className={styles.fileMeta}>
                      <span>{formatBytes(file.tamanhoBytes)}</span>
                      <span className={styles.fileMetaSep}>·</span>
                      <span>{formatRelative(file.publicadoEm)}</span>
                    </div>
                  </div>
                  {/* Quick actions visíveis no hover. */}
                  <div className={styles.fileActions}>
                    <span
                      role="button"
                      tabIndex={-1}
                      className={styles.fileActionBtn}
                      title="Download"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file);
                      }}
                    >
                      <IconDownload size={13} />
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      className={`${styles.fileActionBtn} ${styles.fileActionBtnDanger}`}
                      title="Excluir"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                    >
                      <IconTrash size={13} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Preview drawer ────────────────────────────── */}
      <MaterialPreviewDrawer
        file={selectedFile}
        onClose={() => setSelectedFileId(null)}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </div>
  );
}
