'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ChatStack.module.css';
import type { ChatUser } from '@/types';

interface Props {
  users: ChatUser[];
  onUserClick: (user: ChatUser) => void;
}

/* ── Preview messages pool ── */
const MSGS = [
  ['Cara, ouviu a nova dela? 🔥', 'Tô no loop aqui 🎵', 'Que show que foi esse 😍', 'Mano essa faixa 🎶'],
  ['Oi! Que música linda 💕', 'Tô ouvindo agora também!', 'A gente tem gosto igual 😅', 'Que saudade 🥺'],
];

const SHOW_MS = 2200; // bubble stays visible
const GAP_MS  = 2400; // pause between messages

/* ── Mac Dock scale falloff ── */
function dockScale(idx: number, hovered: number | null): number {
  if (hovered === null) return 1;
  const d = Math.abs(idx - hovered);
  if (d === 0) return 1.22;
  if (d === 1) return 1.10;
  if (d === 2) return 1.04;
  return 1;
}

export default function ChatStack({ users, onUserClick }: Props) {
  const [hovered,     setHovered]     = useState<number | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [counts,   setCounts]   = useState(() => users.map(u => u.unreadCount ?? 0));
  const [preview,  setPreview]  = useState<{ idx: number; text: string } | null>(null);
  const [exiting,  setExiting]  = useState(false);

  const timer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef    = useRef(0);
  const previewIdx = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => { if (timer.current) clearTimeout(timer.current); };

    const hide = () => {
      if (previewIdx.current !== null) {
        const i = previewIdx.current;
        setCounts(c => c.map((v, j) => j === i ? v + 1 : v));
      }
      previewIdx.current = null;
      setExiting(false);
      setPreview(null);
      stepRef.current++;
      timer.current = setTimeout(show, GAP_MS);
    };

    const beginHide = () => {
      setExiting(true);
      timer.current = setTimeout(hide, 320);
    };

    const show = () => {
      const userIdx = stepRef.current % 2;
      const pool    = MSGS[userIdx];
      const msgIdx  = Math.floor(stepRef.current / 2) % pool.length;
      previewIdx.current = userIdx;
      setExiting(false);
      setPreview({ idx: userIdx, text: pool[msgIdx] });
      timer.current = setTimeout(beginHide, SHOW_MS);
    };

    timer.current = setTimeout(show, 1800);
    return clear;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.dock}>
      <span className={styles.label}>Chat</span>

      <div
        className={`${styles.list} ${listExpanded ? styles.listExpanded : ''}`}
        onMouseEnter={() => setListExpanded(true)}
        onMouseLeave={() => { setListExpanded(false); setHovered(null); }}
      >
        {users.map((user, idx) => {
          const status     = user.status ?? (user.online ? 'online' : 'offline');
          const scale      = listExpanded ? dockScale(idx, hovered) : 1;
          const imgSrc     = user.img ?? `https://i.pravatar.cc/72?img=${idx + 10}`;
          const count      = counts[idx];
          const hasPreview = preview?.idx === idx;

          return (
            <div
              key={user.id}
              className={styles.item}
              style={{
                transform: `scale(${scale}) translateX(${hovered === idx ? -6 : 0}px)`,
                zIndex: hovered === idx ? 30 : users.length - idx,
              }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              aria-label={user.name}
            >
              {/* iOS-style message bubble */}
              {hasPreview && (
                <div
                  key={preview!.text}
                  className={`${styles.bubble} ${exiting ? styles.bubbleOut : styles.bubbleIn}`}
                >
                  <span className={styles.bubbleText}>{preview!.text}</span>
                </div>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={user.name}
                className={`${styles.avatar} ${status === 'offline' ? styles.avatarOffline : ''}`}
              />

              <span className={`${styles.dot} ${styles[status]}`} />

              {count > 0 && (
                <span className={styles.badge}>{count}</span>
              )}

              <div className={styles.tooltip}>
                <span className={styles.tooltipName}>{user.name}</span>
                <span className={styles.tooltipSub}>
                  {user.currentSong ? `Ouvindo ${user.currentSong}` : user.statusText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
