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
  type MaterialNode,
} from '@/data/mock/materiais';
import styles from './dialogs.module.css';

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
  onConfirm: (payload: {
    name: string;
    description?: string;
    audience: MaterialAudience;
  }) => void;
}

export function NewFolderDialog({
  open,
  parentName,
  onClose,
  onConfirm,
}: NewFolderDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<MaterialAudience>('all');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setAudience('all');
    }
  }, [open]);

  const canSubmit = name.trim().length > 0;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      name: name.trim(),
      description: description.trim() || undefined,
      audience,
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
        <Select
          label="Quem pode acessar"
          value={audience}
          onChange={(e) => setAudience(e.target.value as MaterialAudience)}
          options={AUDIENCE_OPTIONS}
          helperText="Todos os arquivos enviados aqui dentro herdarão esta audiência. Pode ser editado depois."
        />
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
