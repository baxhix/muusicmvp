'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import {
  MATERIAL_AUDIENCE_META,
  MATERIAL_AUDIENCE_ORDER,
  type MaterialAudience,
  type MaterialFormato,
  type MaterialNode,
} from '@/data/mock/materiais';
import styles from './dialogs.module.css';

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
  const [tamanhoMB, setTamanhoMB] = useState('5');
  const [audience, setAudience] = useState<MaterialAudience>('all');
  const [description, setDescription] = useState('');
  const [thumb, setThumb] = useState(DEFAULT_THUMB_OPTIONS[0]);
  const [publishedToFeed, setPublishedToFeed] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setFormato('jpg');
      setTamanhoMB('5');
      setAudience('all');
      setDescription('');
      setThumb(DEFAULT_THUMB_OPTIONS[0]);
      setPublishedToFeed(false);
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && description.trim().length > 0;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    const sizeMb = Math.max(0.1, parseFloat(tamanhoMB) || 0);
    onConfirm({
      name: name.trim(),
      formato,
      tamanhoBytes: Math.round(sizeMb * 1_048_576),
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
      description={`Será publicado em "${parentName}". Mock — quando o storage real estiver ligado, o upload de arquivo binário entra aqui.`}
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
        <Input
          label="Nome do arquivo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: palco-encerramento.jpg"
          autoFocus
          required
        />

        <div className={styles.row2}>
          <Select
            label="Formato"
            value={formato}
            onChange={(e) => setFormato(e.target.value as MaterialFormato)}
            options={FORMATO_OPTIONS}
          />
          <Input
            label="Tamanho (MB)"
            type="number"
            min="0.1"
            step="0.1"
            value={tamanhoMB}
            onChange={(e) => setTamanhoMB(e.target.value)}
            placeholder="5"
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

        <div>
          <span className={styles.fieldLabel}>Capa (thumb)</span>
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
