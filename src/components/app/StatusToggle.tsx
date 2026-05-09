'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './StatusToggle.module.css';

type Status = 'online' | 'away' | 'offline';

interface Option { id: Status; label: string; }

const OPTIONS: Option[] = [
  { id: 'online',  label: 'Ativo'   },
  { id: 'away',    label: 'Ausente' },
  { id: 'offline', label: 'Offline' },
];

export default function StatusToggle() {
  const [status, setStatus] = useState<Status>('online');
  const [open,   setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = OPTIONS.find(o => o.id === status)!;

  return (
    <div className={styles.wrap} ref={ref}>
      {/* Pill trigger */}
      <button
        className={styles.pill}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`${styles.dot} ${styles[status]}`} />
        <span className={styles.label}>{current.label}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          viewBox="0 0 10 10" fill="none"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown} role="listbox">
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`${styles.option} ${status === opt.id ? styles.optionActive : ''}`}
              role="option"
              aria-selected={status === opt.id}
              onClick={() => { setStatus(opt.id); setOpen(false); }}
            >
              <span className={`${styles.dot} ${styles[opt.id]}`} />
              <span className={styles.optionLabel}>{opt.label}</span>
              {status === opt.id && (
                <svg className={styles.check} viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
