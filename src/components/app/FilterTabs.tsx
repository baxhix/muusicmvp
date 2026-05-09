'use client';

import { useState, useCallback } from 'react';
import styles from './FilterTabs.module.css';
import type { FilterTabId } from '@/types';

const TABS: { id: FilterTabId; label: string }[] = [
  { id: 'all',    label: 'Todos' },
  { id: 'nearby', label: 'Fãs próximos' },
  { id: 'taste',  label: 'Mesmo gosto' },
];

interface FilterTabsProps {
  onTabChange?: (tabIndex: number, tabId: FilterTabId) => void;
}

export default function FilterTabs({ onTabChange }: FilterTabsProps) {
  const [active, setActive] = useState<FilterTabId>('all');

  const handleClick = useCallback((tab: { id: FilterTabId; label: string }, idx: number) => {
    setActive(tab.id);
    onTabChange?.(idx, tab.id);
  }, [onTabChange]);

  return (
    <div className={styles.tabs} role="tablist">
      {TABS.map((tab, idx) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`${styles.tab} ${active === tab.id ? styles.tabActive : ''}`}
          onClick={() => handleClick(tab, idx)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
