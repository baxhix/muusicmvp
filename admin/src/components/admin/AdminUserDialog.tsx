'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { IconCheckCircle } from '@/components/icons';
import type { TeamMember, TeamRole } from '@/types';
import styles from './AdminUserDialog.module.css';

/** Mesma lista de grupos que aparece na Sidebar (incluindo entradas
 *  top-level como "Dashboard" e "Usuários" que não estão dentro de
 *  um group expansível). Mantido aqui em vez de derivar da Sidebar
 *  pra que o NAV continue podendo mudar sem ricochetar nos checks. */
export const SIDEBAR_GROUPS: { key: string; label: string; description: string }[] = [
  {
    key: 'Dashboard',
    label: 'Dashboard',
    description: 'Visão geral, KPIs e overview da plataforma.',
  },
  {
    key: 'Usuários',
    label: 'Usuários',
    description: 'Listagem e gerenciamento da base de usuários finais.',
  },
  {
    key: 'Plataforma',
    label: 'Plataforma',
    description: 'Moderação, Notificações, Músicas, E-mails, Lives, Presave.',
  },
  {
    key: 'Superfãs',
    label: 'Superfãs',
    description: 'Feed, Comunidades, Superchat, Materiais, Fanpoints.',
  },
  {
    key: 'Growth',
    label: 'Growth',
    description: 'Convites, Engajamento, Aquisição.',
  },
  {
    key: 'Site',
    label: 'Site',
    description: 'Blog institucional, landing pages.',
  },
  {
    key: 'Sistema',
    label: 'Sistema',
    description: 'Configurações, Desenvolvedor — acesso elevado.',
  },
];

export type AdminUserDialogMode = 'create' | 'edit';

export interface AdminUserDialogProps {
  open: boolean;
  mode: AdminUserDialogMode;
  member: TeamMember | null;
  /** Lista atual de emails (pra impedir duplicado no create). */
  existingEmails: string[];
  onClose: () => void;
  onSubmit: (member: TeamMember) => void;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'admin',     label: 'Admin' },
  { value: 'moderator', label: 'Moderador' },
  { value: 'readonly',  label: 'Leitura' },
  /* "Owner" não aparece — só existe 1 por workspace e não pode ser
   * criado/editado via dialog. */
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Dialog unificado de criar/editar admin user. Tudo client-side
 * (mock) — quando o backend cair, troca por chamadas reais sem
 * mudar a UX.
 *
 * Modo `create`: nome, email, role, acesso por grupo de sidebar.
 * Modo `edit`: tudo acima exceto email (campo fica disabled).
 *
 * Acesso por grupo: lista de checkboxes correspondente à NAV da
 * Sidebar. Marcado = pode ver e clicar; desmarcado = sumido pra
 * esse user. Owner sempre tem acesso total (não passa por aqui).
 */
export default function AdminUserDialog({
  open,
  mode,
  member,
  existingEmails,
  onClose,
  onSubmit,
}: AdminUserDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('admin');
  const [groupAccess, setGroupAccess] = useState<Set<string>>(
    new Set(['Dashboard']),
  );

  /* Re-popula o form sempre que abre — em create vira default
   * limpo; em edit puxa do member. Sem isto, state azedo entre
   * aberturas. */
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && member) {
      setName(member.name);
      setEmail(member.email);
      setRole(member.role === 'owner' ? 'admin' : member.role);
      setGroupAccess(
        new Set(member.groupAccess ?? SIDEBAR_GROUPS.map((g) => g.key)),
      );
    } else {
      setName('');
      setEmail('');
      setRole('admin');
      setGroupAccess(new Set(['Dashboard']));
    }
  }, [open, mode, member]);

  const trimmedEmail = email.trim().toLowerCase();
  const emailError = useMemo(() => {
    if (mode === 'edit') return null;
    if (!trimmedEmail) return 'Email obrigatório.';
    if (!EMAIL_REGEX.test(trimmedEmail)) return 'Formato de email inválido.';
    if (existingEmails.map((e) => e.toLowerCase()).includes(trimmedEmail))
      return 'Já existe um membro com esse email.';
    return null;
  }, [trimmedEmail, existingEmails, mode]);

  const nameError = !name.trim() ? 'Nome obrigatório.' : null;
  const accessError =
    groupAccess.size === 0 ? 'Selecione pelo menos uma área.' : null;

  const canSubmit = !nameError && !emailError && !accessError;

  function toggleGroup(key: string) {
    setGroupAccess((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setGroupAccess((prev) => {
      if (prev.size === SIDEBAR_GROUPS.length) return new Set();
      return new Set(SIDEBAR_GROUPS.map((g) => g.key));
    });
  }

  const allSelected = groupAccess.size === SIDEBAR_GROUPS.length;
  const someSelected = !allSelected && groupAccess.size > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const now = new Date().toISOString();
    const baseMember: TeamMember =
      mode === 'edit' && member
        ? {
            ...member,
            name: name.trim(),
            role,
            groupAccess: Array.from(groupAccess),
          }
        : {
            id: `tm_${Math.random().toString(36).slice(2, 10)}`,
            name: name.trim(),
            email: trimmedEmail,
            role,
            invitedAt: now,
            lastActiveAt: now,
            twoFactor: false,
            status: 'invited',
            groupAccess: Array.from(groupAccess),
          };
    onSubmit(baseMember);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? 'Convidar membro' : `Editar ${member?.name ?? 'membro'}`}
      description={
        mode === 'create'
          ? 'Defina nome, email e quais áreas da sidebar este membro pode acessar.'
          : 'Atualize função e áreas da sidebar acessíveis a este membro.'
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconCheckCircle size={14} />}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {mode === 'create' ? 'Criar membro' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.row}>
          <Input
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Helena Drummond"
            errorText={name.length > 0 ? (nameError ?? undefined) : undefined}
            maxLength={120}
          />
          <Input
            label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemplo@fanverse.app"
            errorText={email.length > 0 ? (emailError ?? undefined) : undefined}
            disabled={mode === 'edit'}
            type="email"
            maxLength={254}
          />
        </div>

        <Select
          label="Função"
          value={role}
          onChange={(e) => setRole(e.target.value as TeamRole)}
          options={ROLE_OPTIONS}
          required
          helperText="Define o nível de privilégio. Owner é único e não pode ser criado aqui."
        />

        <section className={styles.accessSection}>
          <div className={styles.accessHead}>
            <span className={styles.accessTitle}>
              Acesso aos grupos da sidebar <span className={styles.required}>*</span>
            </span>
            <button
              type="button"
              className={styles.toggleAllBtn}
              onClick={toggleAll}
            >
              {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <span className={styles.accessHelper}>
            Marque os grupos que este membro pode ver e clicar. Grupos
            desmarcados ficam ocultos pra ele.
          </span>

          <div className={styles.groupGrid}>
            {SIDEBAR_GROUPS.map((g) => {
              const active = groupAccess.has(g.key);
              return (
                <label
                  key={g.key}
                  className={styles.groupCard}
                  data-active={active}
                >
                  <Checkbox
                    checked={active}
                    indeterminate={false}
                    onChange={() => toggleGroup(g.key)}
                  />
                  <div className={styles.groupText}>
                    <span className={styles.groupLabel}>{g.label}</span>
                    <span className={styles.groupDescription}>
                      {g.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {accessError && (
            <span className={styles.accessError}>{accessError}</span>
          )}
          {someSelected && (
            <span className={styles.accessSummary}>
              {groupAccess.size} de {SIDEBAR_GROUPS.length} áreas selecionadas
            </span>
          )}
        </section>
      </div>
    </Dialog>
  );
}
