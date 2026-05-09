'use client';

import { useEffect, useState } from 'react';
import { IconSun, IconMoon, IconMonitor } from '@/components/icons';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';
import styles from './ThemeToggle.module.css';

interface Option {
  value: ThemePreference;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const OPTIONS: Option[] = [
  { value: 'light',  icon: IconSun,     label: 'Claro' },
  { value: 'system', icon: IconMonitor, label: 'Sistema' },
  { value: 'dark',   icon: IconMoon,    label: 'Escuro' },
];

/** Three-segment switcher: Light · System · Dark. */
export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <div role="radiogroup" aria-label="Tema" className={styles.toggle}>
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = hydrated && preference === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            type="button"
            className={cn(styles.option, active && styles.optionActive)}
            onClick={() => setPreference(value)}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
