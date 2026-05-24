'use client';

import { useEffect, useRef, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { IconUpload, IconImage } from '@/components/icons';
import {
  MATERIAL_AUDIENCE_META,
  MATERIAL_AUDIENCE_ORDER,
  type MaterialAudience,
  type MaterialFormato,
  type MaterialNode,
} from '@/data/mock/materiais';
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

/** Lê o arquivo como data URL e redimensiona pra thumb 256×256
 *  via canvas (cover, mantém aspect ratio). Reduz o payload do
 *  localStorage drasticamente — uma imagem original de 5MB vira
 *  ~30KB de JPG base64. Resolve via Promise pra que o caller
 *  use async/await. */
function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Não é imagem'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao decodificar imagem'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível'));
          return;
        }
        // Cover: escala mantendo aspect ratio + crop centralizado.
        const sourceAspect = img.width / img.height;
        const targetAspect = 1;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (sourceAspect > targetAspect) {
          // Imagem mais larga que alta — corta laterais.
          sw = img.height * targetAspect;
          sx = (img.width - sw) / 2;
        } else if (sourceAspect < targetAspect) {
          // Imagem mais alta que larga — corta topo/baixo.
          sh = img.width / targetAspect;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        /* JPEG quality 0.82 é o sweet spot entre fidelidade e
         * tamanho. SVG/PNG/etc viram JPEG aqui mesmo — o thumb
         * é só preview, não a versão final. */
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* Thumbs default que existem em /public — usamos pra dar uma
 * capa razoável aos uploads mockados (sem precisar implementar
 * file storage de verdade). Ordem reflete diversidade visual. */
const DEFAULT_THUMB_OPTIONS = [
  '/ana-castela.png',
  '/ana-castela-box.jpg',
  '/central-anacastela.png',
  '/albuns/album-let-rodeo.jpg',
  '/albuns/album-pipoca.jpg',
  '/albuns/album-livin-deluxe.jpg',
  '/icon-chapeu-ac.svg',
];

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
 * UploadFileDialog — adiciona um arquivo (mock — só metadados,
 * sem upload real). O backend ainda vai precisar fazer storage;
 * aqui só preenche um nó na árvore.
 * ────────────────────────────────────────────────────────────── */

export interface UploadFileDialogProps {
  open: boolean;
  parentName: string;
  onClose: () => void;
  onConfirm: (payload: {
    name: string;
    formato: MaterialFormato;
    tamanhoBytes: number;
    audience: MaterialAudience;
    description: string;
    thumb: string;
    publishedToFeed: boolean;
  }) => void;
}

export function UploadFileDialog({
  open,
  parentName,
  onClose,
  onConfirm,
}: UploadFileDialogProps) {
  const [name, setName] = useState('');
  const [formato, setFormato] = useState<MaterialFormato>('jpg');
  const [tamanhoBytes, setTamanhoBytes] = useState(0);
  const [audience, setAudience] = useState<MaterialAudience>('all');
  const [description, setDescription] = useState('');
  const [thumb, setThumb] = useState(DEFAULT_THUMB_OPTIONS[0]);
  const [publishedToFeed, setPublishedToFeed] = useState(false);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setFormato('jpg');
      setTamanhoBytes(0);
      setAudience('all');
      setDescription('');
      setThumb(DEFAULT_THUMB_OPTIONS[0]);
      setPublishedToFeed(false);
      setPickedFileName(null);
      setProcessingFile(false);
      setFileError(null);
    }
  }, [open]);

  /** Quando o usuário seleciona um arquivo via input. Auto-fill
   *  metadados + gera thumb se for imagem. */
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setPickedFileName(file.name);
    setName((curr) => curr.trim() ? curr : file.name);
    setFormato(inferFormato(file.name));
    setTamanhoBytes(file.size);

    if (file.type.startsWith('image/')) {
      setProcessingFile(true);
      try {
        const dataUrl = await generateThumbnail(file);
        setThumb(dataUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao processar imagem';
        setFileError(`${msg}. Usando capa default.`);
      } finally {
        setProcessingFile(false);
      }
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    !processingFile;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      name: name.trim(),
      formato,
      tamanhoBytes: tamanhoBytes > 0 ? tamanhoBytes : 1_048_576, // 1MB default
      audience,
      description: description.trim(),
      thumb,
      publishedToFeed,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo arquivo"
      description={`Será publicado em "${parentName}". O arquivo binário NÃO é armazenado (backend de storage pendente) — só os metadados + thumb redimensionado ficam no acervo local.`}
      size="lg"
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
            Adicionar ao acervo
          </Button>
        </div>
      }
    >
      <form className={styles.body} onSubmit={submit}>
        {/* File picker — drop-zone clicável. Auto-preenche o
         *  resto dos campos quando um arquivo é selecionado. */}
        <div>
          <span className={styles.fieldLabel}>Arquivo</span>
          <button
            type="button"
            className={styles.dropzone}
            onClick={() => fileInputRef.current?.click()}
          >
            {pickedFileName ? (
              <div className={styles.dropzonePicked}>
                {thumb.startsWith('data:') ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumb} alt="" className={styles.dropzoneThumb} />
                ) : (
                  <span className={styles.dropzoneIcon}>
                    <IconImage size={20} />
                  </span>
                )}
                <div className={styles.dropzonePickedInfo}>
                  <span className={styles.dropzonePickedName}>{pickedFileName}</span>
                  <span className={styles.dropzonePickedMeta}>
                    {processingFile
                      ? 'Processando…'
                      : `${formatBytes(tamanhoBytes)} · ${formato.toUpperCase()}`}
                  </span>
                </div>
                <span className={styles.dropzoneSwap}>Trocar arquivo</span>
              </div>
            ) : (
              <div className={styles.dropzoneEmpty}>
                <span className={styles.dropzoneIcon}>
                  <IconUpload size={20} />
                </span>
                <span className={styles.dropzoneEmptyTitle}>
                  Clique para selecionar um arquivo
                </span>
                <span className={styles.dropzoneEmptyHint}>
                  Imagens (JPG, PNG, SVG), áudio (MP3), vídeo (MP4), documentos (PDF, ZIP).
                </span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/mpeg,video/mp4,application/pdf,application/zip"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
          />
          {fileError && <p className={styles.fileError}>{fileError}</p>}
        </div>

        <Input
          label="Nome no acervo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: palco-encerramento.jpg"
          required
          helperText="Edita aqui se quiser um nome diferente do arquivo original."
        />

        <div className={styles.row2}>
          <Select
            label="Formato"
            value={formato}
            onChange={(e) => setFormato(e.target.value as MaterialFormato)}
            options={FORMATO_OPTIONS}
          />
          <Input
            label="Tamanho"
            value={tamanhoBytes > 0 ? formatBytes(tamanhoBytes) : '—'}
            readOnly
            disabled
            helperText="Auto-detectado do arquivo."
          />
        </div>

        <Textarea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que este material entrega pro fã — contexto, exclusividade, mood."
          rows={3}
          required
        />

        <Select
          label="Quem pode acessar"
          value={audience}
          onChange={(e) => setAudience(e.target.value as MaterialAudience)}
          options={AUDIENCE_OPTIONS}
        />

        {/* Capa default só pra non-imagens. Pra imagens, o thumb
         *  é gerado a partir do arquivo enviado. */}
        {!thumb.startsWith('data:') && (
          <div>
            <span className={styles.fieldLabel}>Capa (thumb)</span>
            <p className={styles.fieldHint}>
              Como o arquivo não é imagem, escolha uma capa do banco visual.
            </p>
            <div className={styles.thumbGrid}>
              {DEFAULT_THUMB_OPTIONS.map((src) => (
                <button
                  key={src}
                  type="button"
                  className={`${styles.thumbOption} ${thumb === src ? styles.thumbOptionActive : ''}`}
                  onClick={() => setThumb(src)}
                  aria-pressed={thumb === src}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          </div>
        )}

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={publishedToFeed}
            onChange={(e) => setPublishedToFeed(e.target.checked)}
          />
          <span>
            <strong>Também publicar no feed</strong>
            <span className={styles.checkboxHint}>
              Cria automaticamente um post quando o arquivo é adicionado.
            </span>
          </span>
        </label>
      </form>
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
