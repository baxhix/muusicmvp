'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Checkbox from '@/components/ui/Checkbox';
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
  IconGrid,
  IconList,
} from '@/components/icons';
import {
  loadMateriaisTree,
  childrenOf,
  pathOf,
  findNode,
  countFilesDeep,
  summarizeTree,
  MATERIAL_STATUS_LABEL,
  MATERIAL_AUDIENCE_META,
  type MaterialNode,
  type MaterialFolder,
  type MaterialFile,
  type MaterialFormato,
  type MaterialAudience,
} from '@/data/mock/materiais';
import Badge from '@/components/ui/Badge';
import { formatNumber, formatRelative } from '@/lib/format';
import {
  formatBytes,
  generateId,
  loadFromStorage,
  saveToStorage,
  clearStorage,
  collectDescendantIds,
} from './shared';
import {
  NewFolderDialog,
  UploadFileDialog,
  RenameDialog,
} from './dialogs';
import MaterialPreviewDrawer from './MaterialPreviewDrawer';
import { cn } from '@/lib/utils';
import styles from './page.module.css';

/**
 * Materiais — navegador de arquivos hierárquico do acervo da
 * artista (per product feedback "estilo pastas e subpastas, como
 * do Google Drive, finder, etc.").
 *
 * Capabilities:
 *   - Navegação por pastas com breadcrumb clicável
 *   - Toggle de visualização Grid / Lista (persistido em
 *     localStorage por product feedback "inclua a opção de ver
 *     em formato de lista também e o usuário escolher")
 *   - Multi-seleção de arquivos com checkboxes — incluindo
 *     "Selecionar todos" e ações em massa (Baixar / Excluir)
 *     per product feedback "inclua a opção selecionar todos e
 *     baixar todos"
 *   - Preview drawer com Download + Excluir individual
 *
 * Seleção é por-pasta: navegar pra outra pasta limpa a seleção
 * (mesma UX do Finder/Drive — itens visíveis numa pasta não
 * "viajam" pra outra).
 */

const VIEW_PREF_KEY = 'materiais:view';

type ViewMode = 'grid' | 'list';

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
  /* Árvore inicial: tenta o localStorage primeiro (mudanças do
   * admin sobrevivem refresh); fallback no mock seed. SSR safe
   * porque loadFromStorage retorna null no servidor. */
  const [nodes, setNodes] = useState<MaterialNode[]>(() => {
    const stored = loadFromStorage();
    return stored && stored.length > 0 ? stored : loadMateriaisTree();
  });
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* Dialogs state — controlados aqui, montados no final do JSX. */
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<MaterialNode | null>(null);

  /* Persiste a árvore no localStorage a cada mudança. Roda em
   * efeito (não na mesma render) pra não bloquear o paint. */
  useEffect(() => {
    saveToStorage(nodes);
  }, [nodes]);

  /* Restore preferência de view salva — SSR safe começa em
   * 'grid' (default) e flipa no client se houver preferência. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(VIEW_PREF_KEY);
    if (stored === 'grid' || stored === 'list') setView(stored);
  }, []);

  function updateView(next: ViewMode) {
    setView(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(VIEW_PREF_KEY, next);
      } catch {
        // Quota / private mode — silent fallback.
      }
    }
  }

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

  /* Seleção state — boolean derivado pra ergonomia do JSX. */
  const allFileIds = useMemo(() => files.map((f) => f.id), [files]);
  const hasSelection = selectedIds.size > 0;
  const isAllSelected =
    allFileIds.length > 0 && allFileIds.every((id) => selectedIds.has(id));
  const isPartiallySelected = hasSelection && !isAllSelected;

  function toggleSelect(fileId: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFileIds));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  /* Handlers — backend stubs. */
  function handleDownload(file: MaterialFile) {
    alert(
      `Download mockado: ${file.name}\n(${formatBytes(file.tamanhoBytes)})\n\nQuando o backend ligar, swap por\nfetch('/api/admin/materiais/${file.id}/download').`,
    );
  }

  function handleDelete(file: MaterialFile) {
    const ok = confirm(
      `Excluir "${file.name}"?\n\nEsta ação remove o arquivo do acervo e desfaz qualquer post no feed associado a ele.`,
    );
    if (!ok) return;
    /* Remove de fato do state — persiste via effect. */
    setNodes((curr) => curr.filter((n) => n.id !== file.id));
    setSelectedFileId(null);
    setSelectedIds((curr) => {
      const next = new Set(curr);
      next.delete(file.id);
      return next;
    });
  }

  /** Baixa um conjunto de arquivos. Stub — backend pendente.
   *  Quando ligado, vira um POST /api/admin/materiais/bulk-download
   *  que devolve um ZIP. */
  function handleBulkDownload(targetFiles: MaterialFile[]) {
    if (targetFiles.length === 0) return;
    const totalBytes = targetFiles.reduce((s, f) => s + f.tamanhoBytes, 0);
    alert(
      `Baixar ${targetFiles.length} arquivos (${formatBytes(totalBytes)})?\n\nQuando o backend ligar, ele empacotará num ZIP único.\n\n${targetFiles
        .slice(0, 5)
        .map((f) => `• ${f.name}`)
        .join('\n')}${targetFiles.length > 5 ? `\n• …e mais ${targetFiles.length - 5}` : ''}`,
    );
  }

  function handleBulkDelete() {
    if (!hasSelection) return;
    const count = selectedIds.size;
    const ok = confirm(
      `Excluir ${count} ${count === 1 ? 'arquivo' : 'arquivos'} selecionados?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    /* Remove os selecionados de fato do state. */
    setNodes((curr) => curr.filter((n) => !selectedIds.has(n.id)));
    clearSelection();
  }

  /** Atualiza a audiência de um arquivo. Mock — quando o backend
   *  cair, vira PATCH /api/admin/materiais/{id} { audience }. */
  function handleAudienceChange(fileId: string, audience: MaterialAudience) {
    setNodes((curr) =>
      curr.map((n) =>
        n.type === 'file' && n.id === fileId ? { ...n, audience } : n,
      ),
    );
  }

  /** Cria uma nova subpasta dentro da pasta atual. */
  function handleCreateFolder(payload: { name: string; description?: string }) {
    const newFolder: MaterialFolder = {
      id: generateId('folder'),
      type: 'folder',
      name: payload.name,
      parentId: currentFolderId, // null se estamos no root
      description: payload.description,
    };
    setNodes((curr) => [...curr, newFolder]);
  }

  /** Adiciona um novo arquivo (mock — só metadados). */
  function handleUploadFile(payload: {
    name: string;
    formato: MaterialFormato;
    tamanhoBytes: number;
    audience: MaterialAudience;
    description: string;
    thumb: string;
    publishedToFeed: boolean;
  }) {
    /* Não dá pra adicionar arquivo no root — só dentro de pasta.
     *  Se o usuário tentou (botão deve estar disabled lá em
     *  cima), a gente bloqueia defensivamente. */
    if (!currentFolderId) return;
    const newFile: MaterialFile = {
      id: generateId('file'),
      type: 'file',
      name: payload.name,
      parentId: currentFolderId,
      formato: payload.formato,
      thumb: payload.thumb,
      tamanhoBytes: payload.tamanhoBytes,
      status: 'publicado',
      publicadoEm: new Date().toISOString(),
      publishedToFeed: payload.publishedToFeed,
      downloads: 0,
      favoritos: 0,
      description: payload.description,
      audience: payload.audience,
      createdBy: { id: 'admin-current', name: 'Equipe Admin' },
    };
    setNodes((curr) => [...curr, newFile]);
  }

  /** Renomeia um nó (pasta ou arquivo). */
  function handleRename(nextName: string) {
    if (!renameTarget) return;
    setNodes((curr) =>
      curr.map((n) => (n.id === renameTarget.id ? { ...n, name: nextName } : n)),
    );
    setRenameTarget(null);
  }

  /** Exclui uma pasta + cascateia todos os descendentes. */
  function handleDeleteFolder(folder: MaterialFolder) {
    const fileCount = countFilesDeep(nodes, folder.id);
    const message =
      fileCount === 0
        ? `Excluir a pasta "${folder.name}"?`
        : `Excluir a pasta "${folder.name}" e ${fileCount} ${fileCount === 1 ? 'arquivo' : 'arquivos'} dentro dela?\n\nEsta ação não pode ser desfeita.`;
    const ok = confirm(message);
    if (!ok) return;
    const idsToRemove = collectDescendantIds(nodes, folder.id);
    setNodes((curr) => curr.filter((n) => !idsToRemove.has(n.id)));
    /* Se estávamos navegados pra dentro da pasta excluída,
     *  volta pro parent. */
    if (currentFolderId && idsToRemove.has(currentFolderId)) {
      setCurrentFolderId(folder.parentId);
    }
    clearSelection();
  }

  /** Restaura o acervo pro mock inicial (limpa localStorage). */
  function handleResetAcervo() {
    const ok = confirm(
      'Restaurar o acervo pro estado inicial?\n\nTodas as mudanças locais (pastas criadas, arquivos adicionados, renomeações, exclusões e audiências editadas) serão descartadas.',
    );
    if (!ok) return;
    clearStorage();
    setNodes(loadMateriaisTree());
    setCurrentFolderId(null);
    clearSelection();
    setSelectedFileId(null);
  }

  /** Resolve os MaterialFile a partir dos ids selecionados. */
  function getSelectedFiles(): MaterialFile[] {
    return files.filter((f) => selectedIds.has(f.id));
  }

  function navigateTo(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSearch('');
    clearSelection(); // estilo Finder/Drive — seleção não persiste entre pastas
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
              variant="ghost"
              size="sm"
              onClick={handleResetAcervo}
              title="Limpa as mudanças locais e restaura o acervo seed."
            >
              Restaurar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<IconFolderOpen size={14} />}
              onClick={() => setNewFolderOpen(true)}
            >
              Nova pasta
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={() => setUploadOpen(true)}
              disabled={!currentFolderId}
              title={
                currentFolderId
                  ? 'Adiciona um arquivo na pasta atual'
                  : 'Entre numa pasta antes de adicionar arquivos.'
              }
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

      {/* ── Toolbar: breadcrumb + search + view toggle ──── */}
      <Card className={styles.toolbar}>
        <nav className={styles.breadcrumb} aria-label="Caminho">
          <button
            type="button"
            className={cn(styles.crumb, currentFolderId === null && styles.crumbActive)}
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
                  className={cn(styles.crumb, isLast && styles.crumbActive)}
                  onClick={() => navigateTo(folder.id)}
                  disabled={isLast}
                >
                  {folder.name}
                </button>
              </span>
            );
          })}
        </nav>

        <div className={styles.toolbarRight}>
          <Input
            inputSize="sm"
            placeholder="Buscar nesta pasta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<IconSearch size={13} />}
            className={styles.searchInput}
          />

          {/* Toggle de visualização — grid | list */}
          <div className={styles.viewToggle} role="group" aria-label="Visualização">
            <button
              type="button"
              className={cn(styles.viewBtn, view === 'grid' && styles.viewBtnActive)}
              onClick={() => updateView('grid')}
              aria-pressed={view === 'grid'}
              title="Visualização em grade"
            >
              <IconGrid size={14} />
            </button>
            <button
              type="button"
              className={cn(styles.viewBtn, view === 'list' && styles.viewBtnActive)}
              onClick={() => updateView('list')}
              aria-pressed={view === 'list'}
              title="Visualização em lista"
            >
              <IconList size={14} />
            </button>
          </div>
        </div>
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
          <div className={styles.folderHeaderRight}>
            <div className={styles.folderMeta}>
              <span>{folders.length} {folders.length === 1 ? 'subpasta' : 'subpastas'}</span>
              <span className={styles.folderMetaSep}>·</span>
              <span>{files.length} {files.length === 1 ? 'arquivo' : 'arquivos'}</span>
            </div>
            <div className={styles.folderHeaderActions}>
              <button
                type="button"
                className={styles.folderHeaderBtn}
                onClick={() => setRenameTarget(currentFolder)}
                title="Renomear pasta"
                aria-label="Renomear pasta"
              >
                Renomear
              </button>
              <button
                type="button"
                className={`${styles.folderHeaderBtn} ${styles.folderHeaderBtnDanger}`}
                onClick={() => handleDeleteFolder(currentFolder)}
                title="Excluir pasta e todo o conteúdo"
                aria-label="Excluir pasta"
              >
                <IconTrash size={12} />
                Excluir
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Bulk actions bar — sempre visível quando há
       *     arquivos. Quando seleção ativa, troca pra modo
       *     contextual com count + ações de massa. */}
      {files.length > 0 && (
        <div className={cn(styles.bulkBar, hasSelection && styles.bulkBarActive)}>
          <label className={styles.bulkSelectAll}>
            <Checkbox
              checked={isAllSelected}
              indeterminate={isPartiallySelected}
              onChange={toggleSelectAll}
              aria-label="Selecionar todos os arquivos"
            />
            <span className={styles.bulkSelectAllLabel}>
              {hasSelection ? (
                <>
                  <strong>{selectedIds.size}</strong> de {files.length} selecionado
                  {selectedIds.size === 1 ? '' : 's'}
                </>
              ) : (
                <>Selecionar todos ({files.length})</>
              )}
            </span>
          </label>

          <div className={styles.bulkActions}>
            {hasSelection ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Limpar seleção
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<IconDownload size={13} />}
                  onClick={() => handleBulkDownload(getSelectedFiles())}
                >
                  Baixar selecionados
                </Button>
                <Button
                  variant="dangerGhost"
                  size="sm"
                  leadingIcon={<IconTrash size={13} />}
                  onClick={handleBulkDelete}
                >
                  Excluir
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<IconDownload size={13} />}
                onClick={() => handleBulkDownload(files)}
                title="Empacota todos os arquivos desta pasta num ZIP"
              >
                Baixar tudo
              </Button>
            )}
          </div>
        </div>
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

      {/* ── Folder section — sempre em grid. Pastas são
       *     navegação, não candidatos a seleção. */}
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

      {/* ── Files: grid OR list, conforme view ────────── */}
      {files.length > 0 && view === 'grid' && (
        <section className={styles.gridSection}>
          <h3 className={styles.sectionLabel}>Arquivos</h3>
          <div className={styles.fileGrid}>
            {files.map((file) => {
              const FormatIcon = fileFormatIcon(file.formato);
              const isSelected = selectedIds.has(file.id);
              const isPreviewSelected = selectedFileId === file.id;
              return (
                <div
                  key={file.id}
                  className={cn(
                    styles.fileCard,
                    isPreviewSelected && styles.fileCardOpen,
                    isSelected && styles.fileCardSelected,
                  )}
                >
                  {/* Checkbox no canto top-left — sempre visível
                   *  quando há seleção ativa, ou no hover. */}
                  <div
                    className={cn(
                      styles.fileCheckbox,
                      hasSelection && styles.fileCheckboxAlwaysVisible,
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                      aria-label={`Selecionar ${file.name}`}
                    />
                  </div>

                  <button
                    type="button"
                    className={styles.fileCardClickable}
                    onClick={() => setSelectedFileId(file.id)}
                    aria-label={`Abrir preview de ${file.name}`}
                  >
                    <div className={styles.fileThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.thumb} alt="" />
                      <span className={styles.fileBadge}>
                        <FormatIcon size={11} />
                        <span>{file.formato.toUpperCase()}</span>
                      </span>
                      {/* Audiência — chip no canto inferior-direito.
                       *  Sempre visível. Visualiza quem pode acessar. */}
                      <span
                        className={`${styles.audienceChip} ${styles[`audience_${file.audience}`]}`}
                        title={MATERIAL_AUDIENCE_META[file.audience].description}
                      >
                        {MATERIAL_AUDIENCE_META[file.audience].shortLabel}
                      </span>
                      {file.publishedToFeed && (
                        <span className={styles.fileFeedBadge} title="Publicado no feed">
                          <IconFeed size={10} />
                        </span>
                      )}
                    </div>
                    <div className={styles.fileBody}>
                      <span className={styles.fileName}>{file.name}</span>
                      <div className={styles.fileMeta}>
                        <span>{formatBytes(file.tamanhoBytes)}</span>
                        <span className={styles.fileMetaSep}>·</span>
                        <span>{formatRelative(file.publicadoEm)}</span>
                      </div>
                    </div>
                  </button>

                  {/* Quick actions visíveis no hover. */}
                  <div className={styles.fileActions}>
                    <span
                      role="button"
                      tabIndex={-1}
                      className={styles.fileActionBtn}
                      title="Download"
                      onClick={() => handleDownload(file)}
                    >
                      <IconDownload size={13} />
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      className={cn(styles.fileActionBtn, styles.fileActionBtnDanger)}
                      title="Excluir"
                      onClick={() => handleDelete(file)}
                    >
                      <IconTrash size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Files: list view ──────────────────────────── */}
      {files.length > 0 && view === 'list' && (
        <section className={styles.listSection}>
          <h3 className={styles.sectionLabel}>Arquivos</h3>
          <Card className={styles.listCard}>
            <div className={styles.listHeader} role="row">
              <span className={styles.listColCheck}></span>
              <span className={styles.listColName}>Nome</span>
              <span className={styles.listColFormat}>Formato</span>
              <span className={styles.listColAudience}>Acesso</span>
              <span className={styles.listColSize}>Tamanho</span>
              <span className={styles.listColDl}>Downloads</span>
              <span className={styles.listColDate}>Publicado</span>
              <span className={styles.listColActions}></span>
            </div>
            {files.map((file) => {
              const FormatIcon = fileFormatIcon(file.formato);
              const isSelected = selectedIds.has(file.id);
              return (
                <div
                  key={file.id}
                  className={cn(styles.listRow, isSelected && styles.listRowSelected)}
                  role="row"
                >
                  <span
                    className={styles.listColCheck}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                      aria-label={`Selecionar ${file.name}`}
                    />
                  </span>
                  <button
                    type="button"
                    className={styles.listColName}
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.thumb} alt="" className={styles.listThumb} />
                    <span className={styles.listNameBody}>
                      <span className={styles.listNameText}>{file.name}</span>
                      <span className={styles.listNameDesc}>{file.description}</span>
                    </span>
                    {file.publishedToFeed && (
                      <span className={styles.listFeedFlag} title="Publicado no feed">
                        <IconFeed size={10} />
                      </span>
                    )}
                  </button>
                  <span className={styles.listColFormat}>
                    <span className={styles.listFormatBadge}>
                      <FormatIcon size={11} />
                      {file.formato.toUpperCase()}
                    </span>
                  </span>
                  <span className={styles.listColAudience}>
                    <Badge tone={MATERIAL_AUDIENCE_META[file.audience].tone} size="sm">
                      {MATERIAL_AUDIENCE_META[file.audience].shortLabel}
                    </Badge>
                  </span>
                  <span className={styles.listColSize}>
                    {formatBytes(file.tamanhoBytes)}
                  </span>
                  <span className={styles.listColDl}>
                    {formatNumber(file.downloads)}
                  </span>
                  <span className={styles.listColDate}>
                    {formatRelative(file.publicadoEm)}
                    <span className={styles.listStatusHint}>
                      {MATERIAL_STATUS_LABEL[file.status]}
                    </span>
                  </span>
                  <span className={styles.listColActions}>
                    <button
                      type="button"
                      className={styles.listIconBtn}
                      onClick={() => handleDownload(file)}
                      title="Download"
                    >
                      <IconDownload size={13} />
                    </button>
                    <button
                      type="button"
                      className={cn(styles.listIconBtn, styles.listIconBtnDanger)}
                      onClick={() => handleDelete(file)}
                      title="Excluir"
                    >
                      <IconTrash size={13} />
                    </button>
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* ── Preview drawer ────────────────────────────── */}
      <MaterialPreviewDrawer
        file={selectedFile}
        onClose={() => setSelectedFileId(null)}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onAudienceChange={handleAudienceChange}
        onRename={(file) => setRenameTarget(file)}
      />

      {/* ── Dialogs CRUD ──────────────────────────────── */}
      <NewFolderDialog
        open={newFolderOpen}
        parentName={currentFolder?.name ?? 'Materiais'}
        onClose={() => setNewFolderOpen(false)}
        onConfirm={handleCreateFolder}
      />
      <UploadFileDialog
        open={uploadOpen}
        parentName={currentFolder?.name ?? 'Materiais'}
        onClose={() => setUploadOpen(false)}
        onConfirm={handleUploadFile}
      />
      <RenameDialog
        open={renameTarget !== null}
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={handleRename}
      />
    </div>
  );
}
