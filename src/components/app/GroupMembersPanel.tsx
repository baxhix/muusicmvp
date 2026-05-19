'use client';

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '@/lib/api/client';
import type { ApiGroupMember } from '@/lib/api/types';
import styles from './GroupMembersPanel.module.css';

interface Props {
  open: boolean;
  /** Conversation id of the group. Null when closed. */
  conversationId: string | null;
  /** Caller's own user id — used to mark "Você" + show the leave button. */
  currentUserId: string;
  /** Caller's role inside this group. Drives kick + admin-only actions. */
  myRole: 'owner' | 'admin' | 'member' | null;
  onClose: () => void;
  /** Open the user picker to add a new member. Wired by the parent. */
  onAddMember: () => void;
  /** Fired after the caller successfully leaves the group. Parent
   *  should close the chat panel + refresh the conversations list. */
  onLeft: () => void;
  /** Fired after the group image is uploaded — parent refreshes the
   *  conversations list so the dock/sidebar/header pick up the new
   *  imageUrl. Receives the new URL for any UI that wants to apply
   *  it optimistically. */
  onImageUpdated?: (newImageUrl: string) => void;
}

/**
 * Slide-in panel showing a group's roster + actions:
 *   - List of all members (owner first, then admins, then members,
 *     each row showing role badge + name + avatar)
 *   - "Adicionar membro" button (owner/admin only)
 *   - "Sair do grupo" button at the bottom (current user, any role)
 *   - Per-row "Remover" button when caller is owner/admin AND target
 *     is not the owner (admins can't kick other admins).
 *
 * Fetches the roster on open + after each mutation so the list stays
 * consistent with the server.
 */
export default function GroupMembersPanel({
  open,
  conversationId,
  currentUserId,
  myRole,
  onClose,
  onAddMember,
  onLeft,
  onImageUpdated,
}: Props) {
  const [members, setMembers] = useState<ApiGroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ members: ApiGroupMember[] }>(
        `/api/conversations/${conversationId}/members`,
      );
      setMembers(res.members);
    } catch (err) {
      console.error('members fetch failed:', err);
      setError('Não foi possível carregar os membros.');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Close on Escape — standard floating UX.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const canManage = myRole === 'owner' || myRole === 'admin';

  const handleKick = async (userId: string) => {
    if (!conversationId || busy) return;
    if (!window.confirm('Remover esse membro do grupo?')) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/members/${userId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(
          data.error === 'cannot_kick_owner'
            ? 'O dono do grupo não pode ser removido.'
            : 'Não foi possível remover. Tente de novo.',
        );
        return;
      }
      await refresh();
    } catch (err) {
      console.error('kick failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handlePickImage = () => fileInputRef.current?.click();

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !conversationId || busy) return;

    // Mirror the server limits client-side for snappier feedback.
    if (file.size > 2 * 1024 * 1024) {
      window.alert('Imagem muito grande (máx 2 MB).');
      return;
    }
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.type)) {
      window.alert('Formato não suportado. Use JPG, PNG, WebP ou GIF.');
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `/api/conversations/${conversationId}/image`,
        { method: 'POST', body: form, credentials: 'include' },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(
          data.error === 'too_large'
            ? 'Imagem muito grande (máx 2 MB).'
            : data.error === 'unsupported_type'
              ? 'Formato não suportado.'
              : 'Falha no upload. Tente de novo.',
        );
        return;
      }
      const data = (await res.json()) as { imageUrl: string };
      onImageUpdated?.(data.imageUrl);
    } catch (err) {
      console.error('group image upload failed:', err);
      window.alert('Falha de conexão. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!conversationId || busy) return;
    if (!window.confirm('Sair desse grupo? Você não receberá mais mensagens dele.')) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/members/${currentUserId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        window.alert('Não foi possível sair do grupo. Tenta de novo.');
        return;
      }
      onLeft();
    } catch (err) {
      console.error('leave failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Membros do grupo"
      aria-hidden={!open}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Membros</h2>
        {canManage && (
          <>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handlePickImage}
              aria-label="Trocar imagem do grupo"
              title="Trocar imagem do grupo"
              disabled={busy}
            >
              {/* Camera icon — signals "upload image" without
                  competing with the + icon below it. */}
              <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5h2l1.5-2h5L13 5h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
                <circle cx="9" cy="10" r="3" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className={styles.addBtn}
              onClick={onAddMember}
              aria-label="Adicionar membro"
              title="Adicionar membro"
              disabled={busy}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          </>
        )}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar"
          disabled={busy}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className={styles.list}>
        {loading && members.length === 0 ? (
          <div className={styles.placeholder}>Carregando…</div>
        ) : error ? (
          <div className={styles.placeholder}>{error}</div>
        ) : members.length === 0 ? (
          <div className={styles.placeholder}>Nenhum membro.</div>
        ) : (
          members.map((m) => {
            const isMe = m.id === currentUserId;
            const img = m.avatarUrl ?? '/avatar-placeholder.svg';
            const canKickThis =
              canManage &&
              !isMe &&
              m.role !== 'owner' &&
              !(m.role === 'admin' && myRole !== 'owner');
            return (
              <div key={m.id} className={styles.row}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className={styles.avatar} />
                <div className={styles.info}>
                  <span className={styles.name}>
                    {m.name ?? m.email.split('@')[0] ?? 'Anônimo'}
                    {isMe && <span className={styles.youTag}> (você)</span>}
                  </span>
                  {m.role !== 'member' && (
                    <span
                      className={`${styles.roleBadge} ${m.role === 'owner' ? styles.roleOwner : styles.roleAdmin}`}
                    >
                      {m.role === 'owner' ? 'Dono' : 'Admin'}
                    </span>
                  )}
                </div>
                {canKickThis && (
                  <button
                    type="button"
                    className={styles.kickBtn}
                    onClick={() => handleKick(m.id)}
                    disabled={busy}
                    aria-label={`Remover ${m.name ?? 'membro'}`}
                    title="Remover do grupo"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M4 4l1 10h6l1-10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.leaveBtn}
          onClick={handleLeave}
          disabled={busy}
        >
          Sair do grupo
        </button>
      </footer>
    </aside>
  );
}
