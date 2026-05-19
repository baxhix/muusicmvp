'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MentionableMember } from '@/hooks/useConversationMembers';
import styles from './MentionAutocomplete.module.css';

interface Props {
  /** Whole roster — already excludes the current user. */
  members: MentionableMember[] | null;
  /** Text after the active "@" that the user has typed so far. */
  query: string;
  onPick: (member: MentionableMember) => void;
  onClose: () => void;
}

/**
 * Floating popover that suggests members to @-mention while the
 * user types. Sits ABOVE the chat input so it doesn't push the
 * messages list around (anchored via the parent's positioning).
 *
 * Keyboard support:
 *   - ArrowUp / ArrowDown navigate the list
 *   - Enter / Tab picks the highlighted entry
 *   - Escape closes (parent decides whether to drop the partial)
 */
export default function MentionAutocomplete({
  members,
  query,
  onPick,
  onClose,
}: Props) {
  const [active, setActive] = useState(0);

  // Filter + cap to 5 — more than that becomes overwhelming inside
  // a chat input flyout. The query is matched as a prefix on the
  // display name OR email local-part (case-insensitive).
  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.toLowerCase().trim();
    const matches = (m: MentionableMember) => {
      const name = (m.name ?? '').toLowerCase();
      const local = m.email.split('@')[0]?.toLowerCase() ?? '';
      if (!q) return true;
      return name.includes(q) || local.includes(q);
    };
    return members.filter(matches).slice(0, 5);
  }, [members, query]);

  // Reset highlight to top whenever the filter changes — otherwise
  // arrow-key state can point at a filtered-out index.
  useEffect(() => {
    setActive(0);
  }, [query, members]);

  // Global keyboard handler — bound via window so the parent input
  // doesn't need to forward each keypress.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onPick(filtered[active]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, active, onPick, onClose]);

  // Loading state for groups whose roster hasn't arrived yet.
  if (members === null) {
    return (
      <div className={styles.popover}>
        <div className={styles.empty}>Carregando membros…</div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={styles.popover}>
        <div className={styles.empty}>Nenhum membro encontrado.</div>
      </div>
    );
  }

  return (
    <div className={styles.popover} role="listbox" aria-label="Mencionar">
      {filtered.map((m, i) => {
        const img = m.avatarUrl ?? '/avatar-placeholder.svg';
        const display = m.name ?? m.email.split('@')[0] ?? 'Anônimo';
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={i === active}
            className={`${styles.row} ${i === active ? styles.rowActive : ''}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(m)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className={styles.avatar} />
            <span className={styles.name}>{display}</span>
            {m.email && (
              <span className={styles.email}>@{m.email.split('@')[0]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
