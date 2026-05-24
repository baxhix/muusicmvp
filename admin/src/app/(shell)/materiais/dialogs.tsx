'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { IconCheck } from '@/components/icons';
import type {
  MaterialAudience,
  MaterialFolder,
  MaterialNode,
} from '@/types/materiais';
import {
  MATERIAL_AUDIENCE_META,
  MATERIAL_AUDIENCE_ORDER,
} from '@/lib/materiais';
import { cn } from '@/lib/utils';
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


/* ──────────────────────────────────────────────────────────────
 * FolderPermissionsDialog — gerencia o tier de fãs que pode
 * acessar uma pasta-raiz (e tudo dentro dela).
 *
 * Regras de negócio:
 *   - Só pastas de PRIMEIRO NÍVEL (parentId === null) têm controle
 *     de acesso. Subpastas herdam da pasta-mãe.
 *   - Os 5 tiers (top1, top10, top50, top100, all) são MUTUAMENTE
 *     EXCLUSIVOS. Definir um tier seleciona QUEM pode acessar —
 *     ex: "Top 100" significa "fãs ranqueados em 1..100", o que
 *     inclui top 1, top 10, top 50.
 *   - UI usa checkboxes (per design feedback) mas se comporta como
 *     radio (clique em um desmarca os outros). Aceitar e descrever
 *     a opção é mais discoverable que radio buttons puros.
 * ────────────────────────────────────────────────────────────── */

export interface FolderPermissionsDialogProps {
  open: boolean;
  /** Pasta sendo editada. null = dialog fechado. Sempre primeiro-nível. */
  folder: MaterialFolder | null;
  onClose: () => void;
  onConfirm: (audience: MaterialAudience) => void;
}

export function FolderPermissionsDialog({
  open,
  folder,
  onClose,
  onConfirm,
}: FolderPermissionsDialogProps) {
  /* Estado local — começa com o tier atual da pasta. Reset toda
   * vez que abrir com folder diferente. */
  const [selected, setSelected] = useState<MaterialAudience>('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && folder) {
      setSelected(folder.audience ?? 'all');
      setSaving(false);
    }
  }, [open, folder]);

  if (!folder) return null;

  const currentAudience = folder.audience ?? 'all';
  const hasChanged = selected !== currentAudience;

  async function submit() {
    if (!hasChanged || saving) return;
    setSaving(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Permissões de acesso"
      description={`Defina quem pode acessar "${folder.name}" e tudo dentro dela. Subpastas herdam automaticamente.`}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={!hasChanged}
            loading={saving}
          >
            Confirmar
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <ul className={styles.permissionsList} role="radiogroup" aria-label="Tier de acesso">
          {MATERIAL_AUDIENCE_ORDER.map((tierId) => {
            const meta = MATERIAL_AUDIENCE_META[tierId];
            const isChecked = selected === tierId;
            return (
              <li key={tierId}>
                {/* Botão (não <input>) — controla visual e estado direto,
                 *  sem ambiguidade de label binding. Comportamento radio:
                 *  click seleciona, click no mesmo não desmarca (precisa
                 *  trocar pra outro). aria-checked + role=radio pra a11y. */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isChecked}
                  className={cn(
                    styles.permissionsOption,
                    isChecked && styles.permissionsOptionChecked,
                  )}
                  onClick={() => setSelected(tierId)}
                >
                  <span
                    className={cn(
                      styles.permissionsCheckbox,
                      isChecked && styles.permissionsCheckboxChecked,
                    )}
                    aria-hidden="true"
                  >
                    {isChecked && <IconCheck size={12} strokeWidth={3} />}
                  </span>
                  <span className={styles.permissionsLabel}>
                    <strong className={styles.permissionsLabelTitle}>{meta.label}</strong>
                    <span className={styles.permissionsLabelDesc}>{meta.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
