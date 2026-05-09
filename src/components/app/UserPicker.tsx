'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiOnlineUser, ApiSearchUser } from '@/lib/api/types';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import styles from './UserPicker.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (userId: string) => void;
}

const SEARCH_DEBOUNCE_MS = 250;

export default function UserPicker({ open, onClose, onPick }: Props) {
  const { users: liveUsers } = useLiveUsers();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus search field when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
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
  // Both shapes render the same way (id, name, avatarUrl, city/email).
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

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-label="Iniciar conversa">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Iniciar conversa</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.searchRow}>
          <svg className={styles.searchIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="7" cy="7" r="5" />
            <path d="M14 14l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className={styles.searchField}
            placeholder="Buscar por nome ou email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              return (
                <button
                  key={u.id}
                  className={styles.item}
                  onClick={() => {
                    onPick(u.id);
                    onClose();
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={u.name ?? ''} className={styles.itemAvatar} />
                  <div className={styles.itemText}>
                    <span className={styles.itemName}>{u.name ?? 'Anônimo'}</span>
                    <span className={styles.itemSub}>{u.subtitle}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {searchResults === null && (
          <div className={styles.hint}>
            {liveUsers.length > 0
              ? 'Mostrando usuários online — digite pra buscar todos'
              : 'Digite ao menos 2 caracteres pra buscar'}
          </div>
        )}
      </div>
    </div>
  );
}
