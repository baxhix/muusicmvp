'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Tabs.module.css';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'bordered' | 'pills' | 'plain';
  className?: string;
}

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'bordered',
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        styles.list,
        variant === 'bordered' && styles.bordered,
        variant === 'pills' && styles.pills,
        className
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={styles.tab}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' && (
              <span className={styles.count}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
