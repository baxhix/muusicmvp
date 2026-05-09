'use client';

import { useEffect, useState } from 'react';
import styles from './StatusBar.module.css';

function pad(n: number) { return n.toString().padStart(2, '0'); }

export default function StatusBar() {
  const [time, setTime] = useState('9:41');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(`${now.getHours()}:${pad(now.getMinutes())}`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.bar}>
      <span className={styles.time}>{time}</span>
      <div className={styles.icons}>
        {/* Signal */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
          <rect x="0"  y="9" width="3" height="3" rx="1" fill="currentColor"/>
          <rect x="4"  y="6" width="3" height="6" rx="1" fill="currentColor"/>
          <rect x="8"  y="3" width="3" height="9" rx="1" fill="currentColor"/>
          <rect x="12" y="0" width="3" height="12" rx="1" fill="currentColor"/>
        </svg>
        {/* WiFi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
          <path d="M7.5 8.5a1 1 0 100 2 1 1 0 000-2z" fill="currentColor"/>
          <path d="M4.5 6.2a4.5 4.5 0 016 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
          <path d="M2 3.8a8 8 0 0111 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
        </svg>
        {/* Battery */}
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="20" height="11" rx="3" stroke="currentColor" strokeOpacity="0.35"/>
          <rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor"/>
          <path d="M22 4v4a2 2 0 000-4z" fill="currentColor" opacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}
