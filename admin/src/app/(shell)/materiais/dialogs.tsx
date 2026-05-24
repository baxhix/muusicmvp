'use client';

import { useEffect, useRef, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import {
  IconUpload,
  IconCheck,
  IconX,
  IconLoader,
  IconAlert,
  IconTrash,
} from '@/components/icons';
import {
  MATERIAL_AUDIENCE_META,
  MATERIAL_AUDIENCE_ORDER,
  type MaterialAudience,
  type MaterialFormato,
  type MaterialNode,
} from '@/data/mock/materiais';
import {
  uploadFile,
  describeError,
  MateriaisApiError,
} from '@/services/materiais';
import { formatBytes } from './shared';
import styles from './dialogs.module.css';

/** Mapeia extensão → formato do nosso enum. Default ao 'jpg'. */
function inferFormato(filename: string): MaterialFormato {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'jpg': case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'svg':
      return 'svg';
    case 'mp3': case 'wav': case 'flac': case 'm4a':
      return 'mp3';
    case 'mp4': case 'mov': case 'webm':
      return 'mp4';
    case 'pdf':
      return 'pdf';
    case 'zip': case 'rar': case '7z':
      return 'zip';
    default:
      return 'jpg';
  }
}

/* MIMEs aceitos pelo backend — mantemos uma cópia client-side
 * pra rejeitar arquivos inválidos ANTES do upload (UX melhor que
 * receber 415 do servidor depois de subir o arquivo todo). */
const ACCEPTED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/svg+xml',
  'audio/mpeg', 'audio/mp3',
  'video/mp4',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
]);
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/* Atributo `accept` do <input type="file"> — agrega os MIMEs +
 * extensões pra que o seletor do OS filtre nativamente. */
const FILE_PICKER_ACCEPT =
  'image/jpeg,image/png,image/svg+xml,audio/mpeg,video/mp4,application/pdf,application/zip,.jpg,.jpeg,.png,.svg,.mp3,.mp4,.pdf,.zip';

const FORMATO_OPTIONS: { value: MaterialFormato; label: string }[] = [
  { value: 'jpg', label: 'JPG (imagem)' },
  { value: 'png', label: 'PNG (imagem)' },
  { value: 'svg', label: 'SVG (vetor)' },
  { value: 'mp3', label: 'MP3 (áudio)' },
  { value: 'mp4', label: 'MP4 (vídeo)' },
  { value: 'pdf', label: 'PDF (documento)' },
  { value: 'zip', label: 'ZIP (pacote)' },
];

const AUDIENCE_OPTIONS = MATERIAL_AUDIENCE_ORDER.map((id) => ({
  value: id,
  label: MATERIAL_AUDIENCE_META[id].label,
}));

/* ──────────────────────────────────────────────────────────────
 * NewFolderDialog — criar uma subpasta dentro da pasta atual.
 * ────────────────────────────────────────────────────────────── */

export interface NewFolderDialogProps {
  open: boolean;
  parentName: string;
  onClose: () => void;
  onConfirm: (payload: { name: string; description?: string }) => void;
}

export function NewFolderDialog({
  open,
  parentName,
  onClose,
  onConfirm,
}: NewFolderDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const canSubmit = name.trim().length > 0;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nova pasta"
      description={`Será criada dentro de "${parentName}".`}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => submit()}
            disabled={!canSubmit}
          >
            Criar pasta
          </Button>
        </div>
      }
    >
      <form className={styles.body} onSubmit={submit}>
        <Input
          label="Nome da pasta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Festival de Verão 2026"
          autoFocus
          required
        />
        <Textarea
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contexto pra equipe — onde, quando, por quê."
          rows={3}
        />
      </form>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────
 * UploadFileDialog — fila de uploads multi-arquivo com progresso
 *
 * Comportamento:
 *   - Aceita N arquivos por vez (file picker múltiplo + drag/drop
 *     interno na própria lista do dialog).
 *   - Cada arquivo entra na fila com status `pending`.
 *   - Validação client-side: tamanho ≤ 50 MB + MIME na whitelist;
 *     falhas marcam o item como `invalid` (não tenta upload, mas
 *     fica visível com o motivo).
 *   - Audiência (Top 1/10/50/100/Todos) e publishedToFeed são
 *     COMPARTILHADOS pra todos os arquivos da fila — UX rápida
 *     pra upload em massa. Edição per-arquivo fica no drawer
 *     depois.
 *   - Nome no acervo = file.name original (preservado). Sem
 *     edição inline aqui — o admin pode renomear via drawer.
 *   - Concurrency: 3 uploads simultâneos máximo (evita esgotar
 *     o pool de conexões do browser).
 *   - Progresso real por arquivo via XHR upload.onprogress.
 *   - Falhas não bloqueiam a fila — os erros aparecem inline e
 *     a fila continua nos próximos.
 * ────────────────────────────────────────────────────────────── */

const MAX_CONCURRENT = 3;

type QueueStatus =
  | 'pending'   // ainda não começou
  | 'invalid'   // falhou pré-validação (não vai tentar)
  | 'uploading' // em progresso
  | 'done'      // sucesso
  | 'error';    // tentou e falhou

interface QueueItem {
  /** id estável (timestamp+random) pra key do React e cancelamento. */
  key: string;
  file: File;
  formato: MaterialFormato;
  status: QueueStatus;
  /** 0–100 — progresso real do XHR; 0 quando pending, 100 quando done. */
  progress: number;
  /** Mensagem amigável quando status='invalid' ou 'error'. */
  message?: string;
  /** Node retornado pelo backend após sucesso — useful pra
   *  inserir na árvore sem refetch. */
  node?: MaterialNode;
}

/** Valida um arquivo client-side. Retorna mensagem de erro
 *  ou null se válido. Espelha as regras do backend (storage.ts)
 *  pra evitar uploads que vão ser rejeitados. */
function validateFile(file: File): string | null {
  if (file.size === 0) return 'Arquivo vazio.';
  if (file.size > MAX_BYTES) {
    return `Arquivo grande demais (${formatBytes(file.size)}). Limite: 50 MB.`;
  }
  if (!ACCEPTED_MIMES.has(file.type)) {
    return `Formato não suportado (${file.type || 'desconhecido'}).`;
  }
  return null;
}

export interface UploadFileDialogProps {
  open: boolean;
  parentName: string;
  parentId: string | null;
  /** Arquivos iniciais — usado quando o dialog é aberto via
   *  drag-and-drop no empty state. */
  initialFiles?: File[];
  onClose: () => void;
  /** Disparado após cada arquivo terminar com sucesso. Recebe o
   *  node retornado pelo backend — o page faz upsert na árvore. */
  onFileUploaded: (node: MaterialNode) => void;
  /** Disparado quando a fila termina (todos os arquivos chegaram
   *  a um estado terminal). */
  onComplete?: (summary: { ok: number; failed: number }) => void;
}

export function UploadFileDialog({
  open,
  parentName,
  parentId,
  initialFiles,
  onClose,
  onFileUploaded,
  onComplete,
}: UploadFileDialogProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [audience, setAudience] = useState<MaterialAudience>('all');
  const [publishedToFeed, setPublishedToFeed] = useState(false);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** Cria QueueItems a partir de uma lista de File — aplica
   *  validação e marca inválidos sem tentar upload. */
  function ingestFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const items: QueueItem[] = list.map((file, i) => {
      const error = validateFile(file);
      return {
        key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        formato: inferFormato(file.name),
        status: error ? 'invalid' : 'pending',
        progress: 0,
        message: error ?? undefined,
      };
    });
    setQueue((curr) => [...curr, ...items]);
  }

  /* Reset ao abrir + ingestão dos initialFiles (vindos do drop
   * zone). */
  useEffect(() => {
    if (open) {
      setQueue([]);
      setAudience('all');
      setPublishedToFeed(false);
      setRunning(false);
      if (initialFiles && initialFiles.length > 0) {
        ingestFiles(initialFiles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    ingestFiles(e.target.files);
    /* Reset do value pra que selecionar o mesmo arquivo de
     * novo dispare o change. */
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!e.dataTransfer?.files) return;
    ingestFiles(e.dataTransfer.files);
  }

  function removeItem(key: string) {
    setQueue((curr) => curr.filter((it) => it.key !== key));
  }

  function updateItem(key: string, patch: Partial<QueueItem>) {
    setQueue((curr) =>
      curr.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  /** Workers paralelos limitados — pega o próximo `pending` da
   *  fila, processa, repete até a fila não ter mais pendentes. */
  async function startQueue() {
    if (!parentId) return;
    if (running) return;
    setRunning(true);

    /* Snapshot fechado dos itens pendentes no momento do click.
     * Como state-driven, usamos o queue mais recente via ref-like
     * pattern: usa setQueue(curr => ...) em cada step. */
    const getPending = (): QueueItem[] => {
      let snapshot: QueueItem[] = [];
      setQueue((curr) => {
        snapshot = curr.filter((it) => it.status === 'pending');
        return curr;
      });
      return snapshot;
    };

    async function processOne(item: QueueItem) {
      updateItem(item.key, { status: 'uploading', progress: 0 });
      try {
        const node = await uploadFile({
          file: item.file,
          parentId: parentId!,
          /* Nome preservado do PC do usuário per product feedback. */
          name: item.file.name,
          audience,
          publishedToFeed,
          onProgress: (percent) => updateItem(item.key, { progress: percent }),
        });
        updateItem(item.key, {
          status: 'done',
          progress: 100,
          node,
        });
        onFileUploaded(node);
      } catch (err) {
        const message =
          err instanceof MateriaisApiError
            ? describeError(err)
            : 'Falha no upload.';
        updateItem(item.key, { status: 'error', message });
      }
    }

    /* Worker pool: lança até MAX_CONCURRENT em paralelo,
     * repetindo enquanto houver pendentes. */
    async function worker() {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const pending = getPending();
        if (pending.length === 0) return;
        const next = pending[0];
        /* Marca como uploading IMEDIATAMENTE pra que outros
         * workers não peguem o mesmo. processOne re-marca como
         * done/error no fim. */
        updateItem(next.key, { status: 'uploading' });
        await processOne(next);
      }
    }

    const workers = Array.from({ length: MAX_CONCURRENT }, () => worker());
    await Promise.all(workers);

    setRunning(false);

    /* Conta sucesso/falha após todos os workers terminarem. */
    setQueue((curr) => {
      const ok = curr.filter((it) => it.status === 'done').length;
      const failed = curr.filter(
        (it) => it.status === 'error' || it.status === 'invalid',
      ).length;
      onComplete?.({ ok, failed });
      return curr;
    });
  }

  const hasPending = queue.some((it) => it.status === 'pending');
  const validCount = queue.filter((it) => it.status === 'pending').length;
  const doneCount = queue.filter((it) => it.status === 'done').length;
  const totalCount = queue.length;
  const allFinished =
    queue.length > 0 &&
    queue.every(
      (it) =>
        it.status === 'done' ||
        it.status === 'error' ||
        it.status === 'invalid',
    );

  const closeLabel = running
    ? 'Aguarde…'
    : allFinished
      ? 'Concluir'
      : 'Cancelar';

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (running) return;
        onClose();
      }}
      title="Upload de arquivos"
      description={`Serão publicados em "${parentName}". Os nomes originais dos arquivos são preservados.`}
      size="lg"
      footer={
        <div className={styles.footer}>
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={running}
          >
            {closeLabel}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={startQueue}
            disabled={!parentId || !hasPending || running}
          >
            {running
              ? `Enviando ${doneCount}/${totalCount}…`
              : hasPending
                ? `Enviar ${validCount} ${validCount === 1 ? 'arquivo' : 'arquivos'}`
                : 'Selecione arquivos'}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {/* Dropzone — sempre clicável e aceita drag/drop. */}
        <div
          className={styles.dropzone}
          onClick={() => !running && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          aria-disabled={running}
        >
          <div className={styles.dropzoneEmpty}>
            <span className={styles.dropzoneIcon}>
              <IconUpload size={20} />
            </span>
            <span className={styles.dropzoneEmptyTitle}>
              Clique ou arraste arquivos aqui
            </span>
            <span className={styles.dropzoneEmptyHint}>
              JPG, PNG, SVG, MP3, MP4, PDF, ZIP — até 50 MB cada.
            </span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_PICKER_ACCEPT}
          multiple
          onChange={handlePickerChange}
          style={{ display: 'none' }}
        />

        {/* Lista da fila — só aparece quando há arquivos. */}
        {queue.length > 0 && (
          <ul className={styles.queueList}>
            {queue.map((it) => (
              <li
                key={it.key}
                className={`${styles.queueItem} ${styles[`queueItem_${it.status}`]}`}
              >
                <span className={styles.queueItemIcon}>
                  {it.status === 'pending' && <IconUpload size={14} />}
                  {it.status === 'uploading' && (
                    <IconLoader size={14} className={styles.queueSpin} />
                  )}
                  {it.status === 'done' && <IconCheck size={14} />}
                  {it.status === 'error' && <IconAlert size={14} />}
                  {it.status === 'invalid' && <IconAlert size={14} />}
                </span>
                <div className={styles.queueItemBody}>
                  <span className={styles.queueItemName}>{it.file.name}</span>
                  <span className={styles.queueItemMeta}>
                    {formatBytes(it.file.size)} · {it.formato.toUpperCase()}
                    {it.message && (
                      <span className={styles.queueItemError}>
                        {' '}— {it.message}
                      </span>
                    )}
                  </span>
                  {it.status === 'uploading' && (
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${it.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {(it.status === 'pending' ||
                  it.status === 'invalid' ||
                  it.status === 'error') && (
                  <button
                    type="button"
                    className={styles.queueItemRemove}
                    onClick={() => removeItem(it.key)}
                    aria-label={`Remover ${it.file.name} da fila`}
                    disabled={running}
                  >
                    <IconTrash size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Form compartilhado — audiência aplica a todos. */}
        <Select
          label="Quem pode acessar"
          value={audience}
          onChange={(e) => setAudience(e.target.value as MaterialAudience)}
          options={AUDIENCE_OPTIONS}
          disabled={running}
          helperText="Aplicado a todos os arquivos deste upload. Pode ser editado por arquivo depois."
        />

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={publishedToFeed}
            onChange={(e) => setPublishedToFeed(e.target.checked)}
            disabled={running}
          />
          <span>
            <strong>Também publicar todos no feed</strong>
            <span className={styles.checkboxHint}>
              Cria automaticamente um post pra cada arquivo adicionado.
            </span>
          </span>
        </label>
      </div>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────
 * RenameDialog — renomeia uma pasta ou arquivo. Genérico — só
 * pede o novo nome.
 * ────────────────────────────────────────────────────────────── */

export interface RenameDialogProps {
  open: boolean;
  target: MaterialNode | null;
  onClose: () => void;
  onConfirm: (nextName: string) => void;
}

export function RenameDialog({ open, target, onClose, onConfirm }: RenameDialogProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open && target) setName(target.name);
  }, [open, target]);

  if (!target) return null;

  const canSubmit = name.trim().length > 0 && name.trim() !== target.name;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    onConfirm(name.trim());
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={target.type === 'folder' ? 'Renomear pasta' : 'Renomear arquivo'}
      description={
        target.type === 'folder'
          ? 'O nome aparece no breadcrumb e na navegação.'
          : 'Manter a extensão (.jpg, .mp3, etc.) ajuda no download.'
      }
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => submit()}
            disabled={!canSubmit}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <form className={styles.body} onSubmit={submit}>
        <Input
          label="Novo nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </form>
    </Dialog>
  );
}
