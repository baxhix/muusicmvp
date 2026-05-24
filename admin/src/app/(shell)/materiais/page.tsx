'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  IconEdit,
} from '@/components/icons';
import {
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
import { formatBytes, validateFile } from './shared';
import { NewFolderDialog, RenameDialog } from './dialogs';
import MaterialPreviewDrawer from './MaterialPreviewDrawer';
import FloatingUploadPanel, {
  type UploadItem,
} from './FloatingUploadPanel';
import {
  listMateriais,
  createFolder,
  uploadFile,
  updateNode,
  deleteNode,
  getDownloadUrl,
  describeError,
  MateriaisApiError,
} from '@/services/materiais';
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
  /* Árvore = source of truth do server. Carregada via
   * listMateriais() no mount; mudanças refletem aqui depois de
   * cada operação confirmada pelo backend (refetch ou
   * mutação direta do array com o node retornado). */
  const [nodes, setNodes] = useState<MaterialNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* Dialogs state — controlados aqui, montados no final do JSX. */
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<MaterialNode | null>(null);
  /* Visual feedback do drag-over no empty state. */
  const [emptyDragOver, setEmptyDragOver] = useState(false);

  /* Fila de uploads — controlada inteira aqui, renderizada no
   * FloatingUploadPanel bottom-right. Per product feedback "o
   * upload já deve começar, mostrar o andamento e o botão de
   * cancelar". State é único pra que múltiplas seleções
   * acumulem na mesma fila sem precisar de modal. */
  const [queue, setQueue] = useState<UploadItem[]>([]);
  /* AbortControllers por key — usados pra cancelar uploads em
   * progresso. Mantidos em ref pra não disparar re-renders. */
  const abortRef = useRef(new Map<string, AbortController>());
  /* Worker active count — limita concurrency a MAX_CONCURRENT. */
  const activeWorkersRef = useRef(0);
  const MAX_CONCURRENT_UPLOADS = 3;
  /* Input file global pra abrir o picker via header. Ref persistente
   * pra evitar montar/desmontar. */
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);

  /* Fetch inicial — pega a árvore do backend ao montar.
   * Idempotente (sem cache local que possa ficar stale entre
   * sessões). */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listMateriais()
      .then((tree) => {
        if (cancelled) return;
        setNodes(tree);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('materiais list failed:', err);
        setLoadError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Restore preferência de view salva — SSR safe começa em
   * 'grid' (default) e flipa no client se houver preferência. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(VIEW_PREF_KEY);
    if (stored === 'grid' || stored === 'list') setView(stored);
  }, []);

  function updateView(next: ViewMode) {
    setView(next);
    /* Fecha o preview drawer + limpa seleção em massa ao trocar
     * view. Sem o clear de selectedIds, items selecionados via
     * "Selecionar todos" da bulk bar continuavam destacados na
     * view nova — usuário interpretava como "o toggle de view
     * causou a seleção". navigateTo já faz o mesmo padrão. */
    setSelectedFileId(null);
    setSelectedIds(new Set());
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

  /** Helper genérico pra reportar erros do backend e logar no
   *  console. UI mostra a mensagem amigável; logger fica com o
   *  raw pra debug. */
  function reportError(operation: string, err: unknown) {
    console.error(`materiais ${operation} failed:`, err);
    alert(describeError(err));
  }

  /** Refetch — pega a árvore do servidor de novo. Usado depois
   *  de operações em massa onde mutação local seria error-prone
   *  (ex: delete cascateado). */
  async function refetchTree() {
    try {
      const tree = await listMateriais();
      setNodes(tree);
    } catch (err) {
      reportError('refetch', err);
    }
  }

  /* Helpers de atualização local — combina com o node devolvido
   * pelo backend pra evitar refetch quando a mutação é simples. */
  function upsertNode(node: MaterialNode) {
    setNodes((curr) => {
      const idx = curr.findIndex((n) => n.id === node.id);
      if (idx === -1) return [...curr, node];
      const next = curr.slice();
      next[idx] = node;
      return next;
    });
  }

  /** Download de arquivo — abre o endpoint do backend que serve
   *  o binário com Content-Disposition: attachment. O browser
   *  cuida do download. Não passa por fetch JS porque a resposta
   *  é binária. */
  function handleDownload(file: MaterialFile) {
    if (!file.id) return;
    window.open(getDownloadUrl(file.id), '_blank');
  }

  /** Apaga arquivo via DELETE. Mutação local após confirmação
   *  do server. */
  async function handleDelete(file: MaterialFile) {
    const ok = confirm(
      `Excluir "${file.name}"?\n\nEsta ação remove o arquivo do acervo e desfaz qualquer post no feed associado a ele.`,
    );
    if (!ok) return;
    try {
      await deleteNode(file.id);
      setNodes((curr) => curr.filter((n) => n.id !== file.id));
      setSelectedFileId(null);
      setSelectedIds((curr) => {
        const next = new Set(curr);
        next.delete(file.id);
        return next;
      });
    } catch (err) {
      reportError('delete file', err);
    }
  }

  /** Bulk download — abre uma aba por arquivo (browser limita a
   *  ~6 simultâneas; suficiente pro caso típico). Quando a
   *  feature de ZIP do backend cair, swap por single open de
   *  /api/admin/materiais/bulk-download. */
  function handleBulkDownload(targetFiles: MaterialFile[]) {
    if (targetFiles.length === 0) return;
    if (
      targetFiles.length > 1 &&
      !confirm(`Baixar ${targetFiles.length} arquivos? Cada um abrirá em uma aba.`)
    ) {
      return;
    }
    targetFiles.forEach((f, i) => {
      /* Pequeno stagger pra evitar que o browser bloqueie pop-ups
       * (vários window.open síncronos disparam o blocker). */
      setTimeout(() => window.open(getDownloadUrl(f.id), '_blank'), i * 250);
    });
  }

  /** Bulk delete — deleta cada um sequencialmente pra controlar
   *  o estado de forma confiável. Refetch ao final se houve
   *  qualquer mudança. */
  async function handleBulkDelete() {
    if (!hasSelection) return;
    const count = selectedIds.size;
    const ok = confirm(
      `Excluir ${count} ${count === 1 ? 'arquivo' : 'arquivos'} selecionados?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;

    const ids = Array.from(selectedIds);
    const failures: string[] = [];
    for (const id of ids) {
      try {
        await deleteNode(id);
      } catch (err) {
        failures.push(id);
        console.error(`bulk delete failed for ${id}:`, err);
      }
    }
    /* Refetch garante consistência mesmo com falhas parciais. */
    await refetchTree();
    clearSelection();
    if (failures.length > 0) {
      alert(
        `Falha ao excluir ${failures.length} de ${ids.length} arquivos. Lista re-sincronizada.`,
      );
    }
  }

  /** Cria pasta — POST /folder. Per product feedback, audience
   *  é definida na pasta (não nos arquivos). */
  async function handleCreateFolder(payload: {
    name: string;
    description?: string;
    audience: MaterialAudience;
  }) {
    try {
      const folder = await createFolder({
        name: payload.name,
        description: payload.description,
        parentId: currentFolderId,
        audience: payload.audience,
      });
      upsertNode(folder);
    } catch (err) {
      reportError('create folder', err);
    }
  }

  /* ── Upload queue management ────────────────────────────
   * Sem modal. Drop ou click no botão Upload → enqueue +
   * start worker pool. Items aparecem no FloatingUploadPanel
   * bottom-right; progresso real via XHR onProgress.
   * Cancelamento via AbortController.
   * ──────────────────────────────────────────────────────── */

  function updateQueueItem(key: string, patch: Partial<UploadItem>) {
    setQueue((curr) =>
      curr.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  /** Processa um único item. Marca uploading → faz o upload com
   *  progresso + abort signal → marca done ou error. Erros de
   *  rede ou validação aparecem na mensagem. */
  async function processItem(item: UploadItem, parentId: string) {
    const ctrl = new AbortController();
    abortRef.current.set(item.key, ctrl);
    updateQueueItem(item.key, { status: 'uploading', progress: 0 });

    try {
      const node = await uploadFile({
        file: item.file,
        parentId,
        /* Nome preservado direto do PC do usuário. */
        name: item.file.name,
        /* Sem audience — backend herda da pasta. */
        signal: ctrl.signal,
        onProgress: (percent) =>
          updateQueueItem(item.key, { progress: percent }),
      });
      updateQueueItem(item.key, {
        status: 'done',
        progress: 100,
      });
      upsertNode(node);
    } catch (err) {
      /* Detecta cancelamento via signal pra diferenciar de erro. */
      if (ctrl.signal.aborted) {
        updateQueueItem(item.key, {
          status: 'cancelled',
          message: 'Cancelado',
        });
      } else {
        const message =
          err instanceof MateriaisApiError
            ? describeError(err)
            : 'Falha no upload.';
        updateQueueItem(item.key, { status: 'error', message });
      }
    } finally {
      abortRef.current.delete(item.key);
      activeWorkersRef.current -= 1;
      /* Tenta pegar o próximo da fila. */
      pumpQueue();
    }
  }

  /** Worker pump — enquanto houver pending e capacidade,
   *  inicia o próximo. Lê o snapshot mais recente da queue via
   *  setQueue + callback identidade. */
  function pumpQueue() {
    if (!currentFolderId) return;
    setQueue((curr) => {
      let availableSlots = MAX_CONCURRENT_UPLOADS - activeWorkersRef.current;
      if (availableSlots <= 0) return curr;
      for (const item of curr) {
        if (availableSlots === 0) break;
        if (item.status !== 'pending') continue;
        availableSlots -= 1;
        activeWorkersRef.current += 1;
        /* Dispara o processItem em background — não awaitar
         * dentro do setQueue. */
        void processItem(item, currentFolderId);
      }
      return curr;
    });
  }

  /** Adiciona arquivos na fila + dispara workers se houver
   *  capacidade. Validação client-side: arquivos inválidos
   *  entram com status='invalid' (não tentam upload).
   *  Bloqueia se não há pasta atual (caso usuário arraste no
   *  root). */
  function enqueueFiles(files: File[] | FileList) {
    if (!currentFolderId) {
      alert(
        'Entre numa pasta antes de enviar arquivos. O acervo é organizado em pastas.',
      );
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;

    const newItems: UploadItem[] = list.map((file, i) => {
      const error = validateFile(file);
      return {
        key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        status: error ? 'invalid' : 'pending',
        progress: 0,
        message: error ?? undefined,
      };
    });
    setQueue((curr) => [...curr, ...newItems]);
    /* Próximo tick — garante que o setQueue acima já comitou. */
    queueMicrotask(pumpQueue);
  }

  /** Cancela um item específico — se uploading, aborta o XHR;
   *  se pending, só marca cancelled (worker nem chega a pegar). */
  function cancelItem(key: string) {
    const ctrl = abortRef.current.get(key);
    if (ctrl) {
      ctrl.abort();
      return; /* processItem catch marca como cancelled */
    }
    /* Pending — marca direto. */
    updateQueueItem(key, { status: 'cancelled', message: 'Cancelado' });
  }

  /** Cancela tudo que ainda não terminou. */
  function cancelAllUploads() {
    /* Abort dos uploading. */
    abortRef.current.forEach((ctrl: AbortController) => ctrl.abort());
    /* Marca os pending como cancelled (já que worker não vai
     * pegar — pumpQueue só pega pending). */
    setQueue((curr) =>
      curr.map((it) =>
        it.status === 'pending'
          ? { ...it, status: 'cancelled' as const, message: 'Cancelado' }
          : it,
      ),
    );
  }

  function dismissQueueItem(key: string) {
    setQueue((curr) => curr.filter((it) => it.key !== key));
  }

  function clearFinishedQueue() {
    setQueue((curr) =>
      curr.filter(
        (it) =>
          it.status === 'pending' || it.status === 'uploading',
      ),
    );
  }

  /** Abre o picker do OS quando o usuário clica em "Upload"
   *  no header. Multi-select default. */
  function openHeaderPicker() {
    headerFileInputRef.current?.click();
  }
  function handleHeaderPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) enqueueFiles(e.target.files);
    /* Reset value pra permitir selecionar o mesmo arquivo
     * de novo no futuro. */
    e.target.value = '';
  }

  /** Renomeia — PATCH. */
  async function handleRename(nextName: string) {
    if (!renameTarget) return;
    const id = renameTarget.id;
    try {
      const updated = await updateNode(id, { name: nextName });
      upsertNode(updated);
      setRenameTarget(null);
    } catch (err) {
      reportError('rename', err);
    }
  }

  /** Exclui pasta — DELETE; backend cuida do cascade. Refetch
   *  pra sincronizar (descendents foram removidos no servidor). */
  async function handleDeleteFolder(folder: MaterialFolder) {
    const fileCount = countFilesDeep(nodes, folder.id);
    const message =
      fileCount === 0
        ? `Excluir a pasta "${folder.name}"?`
        : `Excluir a pasta "${folder.name}" e ${fileCount} ${fileCount === 1 ? 'arquivo' : 'arquivos'} dentro dela?\n\nEsta ação não pode ser desfeita.`;
    const ok = confirm(message);
    if (!ok) return;
    try {
      await deleteNode(folder.id);
      /* Se estávamos navegados pra dentro da pasta excluída,
       *  volta pro parent ANTES do refetch (UI fica
       *  consistente). */
      if (currentFolderId === folder.id) {
        setCurrentFolderId(folder.parentId);
      }
      await refetchTree();
      clearSelection();
    } catch (err) {
      reportError('delete folder', err);
    }
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
              variant="secondary"
              size="sm"
              leadingIcon={<IconFolderOpen size={14} />}
              onClick={() => setNewFolderOpen(true)}
              disabled={loading}
            >
              Nova pasta
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={openHeaderPicker}
              disabled={loading || !currentFolderId}
              title={
                !currentFolderId
                  ? 'Entre numa pasta antes de adicionar arquivos.'
                  : 'Adiciona arquivos na pasta atual'
              }
            >
              Upload
            </Button>
            {/* Input invisível conectado ao botão Upload. Single
             *  source de file picker do header — multi-select, todos
             *  os formatos aceitos. */}
            <input
              ref={headerFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,audio/mpeg,video/mp4,application/pdf,application/zip,.jpg,.jpeg,.png,.svg,.mp3,.mp4,.pdf,.zip"
              multiple
              onChange={handleHeaderPickerChange}
              style={{ display: 'none' }}
            />
          </div>
        }
      />

      {/* ── Loading / Error states ─────────────────────── */}
      {loading && (
        <Card className={styles.emptyCard}>
          <div className={styles.emptyTitle}>Carregando acervo…</div>
        </Card>
      )}
      {loadError && (
        <Card className={styles.emptyCard}>
          <div className={styles.emptyTitle}>Não foi possível carregar</div>
          <div className={styles.emptyHint}>{loadError}</div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoadError(null);
              setLoading(true);
              listMateriais()
                .then((tree) => setNodes(tree))
                .catch((err) => setLoadError(describeError(err)))
                .finally(() => setLoading(false));
            }}
          >
            Tentar de novo
          </Button>
        </Card>
      )}

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
      {currentChildren.length === 0 && !loading && !loadError && (
        <>
          {search.trim() ? (
            /* Filtro ativo sem hits — não vira dropzone porque
             * o usuário tá buscando, não criando. */
            <Card className={styles.emptyCard}>
              <div className={styles.emptyIcon} aria-hidden="true">
                <IconFolder size={20} />
              </div>
              <div className={styles.emptyTitle}>Nada por aqui</div>
              <div className={styles.emptyHint}>
                Nenhum item corresponde a &quot;{search.trim()}&quot;.
              </div>
            </Card>
          ) : (
            /* Pasta vazia (não-busca) vira dropzone direto.
             * Per product feedback "onde está escrito Nada por
             * aqui, já deve ser o ambiente onde será feito o
             * upload". */
            <div
              className={`${styles.emptyDropzone} ${emptyDragOver ? styles.emptyDropzoneActive : ''} ${!currentFolderId ? styles.emptyDropzoneDisabled : ''}`}
              role="button"
              tabIndex={currentFolderId ? 0 : -1}
              onClick={() => currentFolderId && openHeaderPicker()}
              onDragOver={(e) => {
                if (!currentFolderId) return;
                e.preventDefault();
                setEmptyDragOver(true);
              }}
              onDragLeave={() => setEmptyDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setEmptyDragOver(false);
                if (!currentFolderId) return;
                const files = Array.from(e.dataTransfer?.files ?? []);
                if (files.length === 0) return;
                /* Drop → upload IMEDIATO (sem modal). Per product
                 *  feedback "o upload já deve começar". */
                enqueueFiles(files);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (currentFolderId) openHeaderPicker();
                }
              }}
            >
              <div className={styles.emptyIcon} aria-hidden="true">
                <IconPlus size={20} />
              </div>
              <div className={styles.emptyTitle}>
                {currentFolderId
                  ? 'Solte arquivos aqui pra começar'
                  : 'Crie uma pasta primeiro'}
              </div>
              <div className={styles.emptyHint}>
                {currentFolderId
                  ? 'Arraste arquivos do seu computador ou clique para selecionar. JPG, PNG, SVG, MP3, MP4, PDF, ZIP — até 50 MB cada. Vários ao mesmo tempo entram numa fila.'
                  : 'Os arquivos vivem dentro de pastas. Use "Nova pasta" no topo pra criar a primeira.'}
              </div>
            </div>
          )}
        </>
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
                <div key={folder.id} className={styles.folderCardWrap}>
                  <button
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
                  {/* Quick actions — Renomear + Excluir, visíveis no
                   *  hover. Botões absolute pra ficarem por cima do
                   *  link clicável da pasta. stopPropagation pra
                   *  não disparar a navegação. */}
                  <div className={styles.folderCardActions}>
                    <button
                      type="button"
                      className={styles.folderCardActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(folder);
                      }}
                      title="Renomear pasta"
                      aria-label={`Renomear ${folder.name}`}
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.folderCardActionBtn} ${styles.folderCardActionBtnDanger}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      title="Excluir pasta e todo o conteúdo"
                      aria-label={`Excluir ${folder.name}`}
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </div>
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
        onRename={(file) => setRenameTarget(file)}
      />

      {/* ── Dialogs CRUD ──────────────────────────────── */}
      <NewFolderDialog
        open={newFolderOpen}
        parentName={currentFolder?.name ?? 'Materiais'}
        onClose={() => setNewFolderOpen(false)}
        onConfirm={handleCreateFolder}
      />
      <RenameDialog
        open={renameTarget !== null}
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={handleRename}
      />

      {/* ── Painel flutuante de uploads ──────────────────
       *  Sempre montado; auto-hides quando queue está vazia.
       *  Acompanha o usuário através de navegação entre pastas
       *  (fica fixo na viewport). */}
      <FloatingUploadPanel
        items={queue}
        onCancelItem={cancelItem}
        onCancelAll={cancelAllUploads}
        onDismissItem={dismissQueueItem}
        onClearFinished={clearFinishedQueue}
      />
    </div>
  );
}
