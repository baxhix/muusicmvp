'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiOnlineUser, ApiSearchUser } from '@/lib/api/types';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import styles from './UserPicker.module.css';

/**
 * Two modes share this picker:
 *
 *   - 'single' (default): pick one user, calls onPick(userId) and
 *     closes immediately. Used for "start a DM" flows.
 *
 *   - 'group': pick N users + name the group, then calls
 *     onCreateGroup({ name, memberIds }). Used for the "Novo grupo"
 *     flow from the ConversationsSidebar. The modal grows a name
 *     input above the search + a footer with the count + "Criar
 *     grupo" CTA.
 *
 * Both modes reuse the same search/online-list code; the only
 * delta is the per-row affordance (button vs checkbox) and the
 * footer action.
 */
interface SingleProps {
  open: boolean;
  onClose: () => void;
  mode?: 'single';
  onPick: (userId: string) => void;
}
interface GroupProps {
  open: boolean;
  onClose: () => void;
  mode: 'group';
  onCreateGroup: (args: { name: string; memberIds: string[] }) => void;
}
type Props = SingleProps | GroupProps;

const SEARCH_DEBOUNCE_MS = 250;

export default function UserPicker(props: Props) {
  const { open, onClose } = props;
  const isGroupMode = props.mode === 'group';

  const { users: liveUsers } = useLiveUsers();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group-mode-only state — kept here so reopening the picker
  // doesn't drag the previous group's draft around.
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset everything on each open. Stale name + selections from a
  // previous session would confuse the next group creator.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSearchResults(null);
      setSearching(false);
      setGroupName('');
      setSelectedIds([]);
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [open]);

  // Debounced server-side search; falls back to online list when query empty
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ users: ApiSearchUser[] }>(
          `/api/users/search?q=${encodeURIComponent(q)}`,
        );
        setSearchResults(res.users);
      } catch (err) {
        console.error('search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // List shown: search results when query active, otherwise online users.
  type Item = { id: string; name: string | null; avatarUrl: string | null; subtitle: string };

  const items: Item[] = useMemo(() => {
    if (searchResults !== null) {
      return searchResults.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        subtitle: u.email,
      }));
    }
    return liveUsers.map((u: ApiOnlineUser) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      subtitle: [u.city, u.country].filter(Boolean).join(', ') || 'online',
    }));
  }, [searchResults, liveUsers]);

  const toggleSelect = (id: string) => {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const handleCreate = () => {
    if (!isGroupMode || submitting) return;
    const trimmed = groupName.trim();
    if (!trimmed || selectedIds.length === 0) return;
    setSubmitting(true);
    (props as GroupProps).onCreateGroup({
      name: trimmed,
      memberIds: selectedIds,
    });
  };

  if (!open) return null;

  const title = isGroupMode ? 'Novo grupo' : 'Iniciar conversa';
  const canCreate = isGroupMode && groupName.trim().length > 0 && selectedIds.length > 0;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-label={title}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {isGroupMode && (
          <div className={styles.nameRow}>
            <input
              className={styles.nameField}
              placeholder="Nome do grupo"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={80}
              disabled={submitting}
            />
          </div>
        )}

        <div className={styles.searchRow}>
          {/* Magnifier glyph aligned with the chat search icon —
              same viewBox / stroke width / circle + handle paths
              so the two fields look identical. */}
          <svg
            className={styles.searchIcon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M14 14l-3-3" />
          </svg>
          <input
            ref={inputRef}
            className={styles.searchField}
            placeholder={
              isGroupMode
                ? 'Buscar membros por nome ou email…'
                : 'Buscar por nome ou email…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className={styles.list}>
          {searching ? (
            <div className={styles.empty}>Buscando…</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              {searchResults !== null
                ? 'Nenhum usuário encontrado'
                : 'Ninguém online no momento'}
            </div>
          ) : (
            items.slice(0, 50).map((u) => {
              const img = u.avatarUrl ?? `https://i.pravatar.cc/72?u=${u.id}`;
              const isSelected = selectedIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                  onClick={() => {
                    if (isGroupMode) {
                      toggleSelect(u.id);
                    } else {
                      (props as SingleProps).onPick(u.id);
                      onClose();
                    }
                  }}
                  disabled={submitting}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={u.name ?? ''} className={styles.itemAvatar} />
                  <div className={styles.itemText}>
                    <span className={styles.itemName}>{u.name ?? 'Anônimo'}</span>
                    <span className={styles.itemSub}>{u.subtitle}</span>
                  </div>
                  {isGroupMode && (
                    <span
                      className={`${styles.checkBox} ${isSelected ? styles.checkBoxOn : ''}`}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {isGroupMode ? (
          <div className={styles.footer}>
            <span className={styles.footerCount}>
              {selectedIds.length === 0
                ? 'Nenhum membro selecionado'
                : `${selectedIds.length} membro${selectedIds.length === 1 ? '' : 's'} selecionado${selectedIds.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={!canCreate || submitting}
            >
              {submitting ? 'Criando…' : 'Criar grupo'}
            </button>
          </div>
        ) : searchResults === null ? (
          <div className={styles.hint}>
            {liveUsers.length > 0
              ? 'Mostrando usuários online — digite pra buscar todos'
              : 'Digite ao menos 2 caracteres pra buscar'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
