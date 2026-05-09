'use client';

import { useState, useEffect, useRef } from 'react';
import { globeStore } from '@/lib/globeStore';
import styles from './FloatingUsers.module.css';

interface FloatingUser {
  id: string;
  name: string;
  city: string;
  song: string;
  artist: string;
  img: string;
  left: string;
  top: string;
  floatDuration: number;
  floatDelay: number;
  center?: [number, number];
  zoom?: number;
}

const POOL: FloatingUser[] = [
  { id: 'fu1',  name: 'Isabela M.',  city: 'São Paulo, SP',      song: 'Forro da Despedida', artist: 'Ana Castela',         img: 'https://i.pravatar.cc/72?img=5',  left: '22%', top: '18%', floatDuration: 4.2, floatDelay: 0,    center: [-46.6333, -23.5505], zoom: 10 },
  { id: 'fu2',  name: 'Pedro H.',    city: 'Curitiba, PR',       song: 'Bem Bolado',         artist: 'Zé Neto & Cristiano', img: 'https://i.pravatar.cc/72?img=18', left: '38%', top: '42%', floatDuration: 3.8, floatDelay: -1.2 },
  { id: 'fu3',  name: 'Sofia A.',    city: 'Paris, França',      song: 'Solteiro Feliz',     artist: 'Turma do Pagode',     img: 'https://i.pravatar.cc/72?img=32', left: '54%', top: '24%', floatDuration: 4.6, floatDelay: -2.5, center: [2.3522, 48.8566],    zoom: 10 },
  { id: 'fu4',  name: 'Mateus C.',   city: 'Rio de Janeiro, RJ', song: 'Amei Te Ver',        artist: 'Tiago Iorc',          img: 'https://i.pravatar.cc/72?img=7',  left: '70%', top: '55%', floatDuration: 3.5, floatDelay: -0.7, center: [-43.1729, -22.9068], zoom: 10 },
  { id: 'fu5',  name: 'Larissa B.',  city: 'Fortaleza, CE',      song: 'Olha Onde Eu Tô',    artist: 'Ana Castela',         img: 'https://i.pravatar.cc/72?img=38', left: '14%', top: '62%', floatDuration: 4.9, floatDelay: -3.1 },
  { id: 'fu6',  name: 'Gabriel L.',  city: 'Porto Alegre, RS',   song: 'Ai Ai Ai',           artist: 'Ana Castela',         img: 'https://i.pravatar.cc/72?img=25', left: '46%', top: '68%', floatDuration: 4.1, floatDelay: -1.8, center: [-51.2177, -30.0277], zoom: 10 },
  { id: 'fu7',  name: 'Vitória S.',  city: 'Tóquio, Japão',     song: 'Nosso Quadro',       artist: 'Ana Castela',         img: 'https://i.pravatar.cc/72?img=53', left: '78%', top: '30%', floatDuration: 3.7, floatDelay: -0.4, center: [139.6917, 35.6895],  zoom: 10 },
  { id: 'fu8',  name: 'Felipe O.',   city: 'Salvador, BA',       song: 'Mal Feito',          artist: 'Hugo & Guilherme',    img: 'https://i.pravatar.cc/72?img=14', left: '30%', top: '75%', floatDuration: 5.0, floatDelay: -2.2 },
  { id: 'fu9',  name: 'Camille N.',  city: 'Recife, PE',         song: 'Tá OK',              artist: 'Ana Castela',         img: 'https://i.pravatar.cc/72?img=41', left: '62%', top: '14%', floatDuration: 4.4, floatDelay: -1.0, center: [-34.8813, -8.0539],  zoom: 10 },
  { id: 'fu10', name: 'Rodrigo V.',  city: 'Belo Horizonte, MG', song: 'Erro Gostoso',       artist: 'Ana Castela',         img: 'https://i.pravatar.cc/72?img=3',  left: '86%', top: '70%', floatDuration: 3.9, floatDelay: -3.6, center: [-43.9378, -19.9167], zoom: 10 },
];

const MAX_VISIBLE = 4;

function getRandMs(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

type Phase = 'hidden' | 'entering' | 'visible' | 'exiting';
interface UserState { phase: Phase; }

export default function FloatingUsers() {
  const [states, setStates] = useState<UserState[]>(
    POOL.map(() => ({ phase: 'hidden' as Phase }))
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const timers  = useRef<(ReturnType<typeof setTimeout> | null)[]>(POOL.map(() => null));
  const visCount = useRef(0);

  const scheduleUser = (idx: number, delay?: number) => {
    timers.current[idx] = setTimeout(() => {
      if (visCount.current >= MAX_VISIBLE) {
        scheduleUser(idx, getRandMs(2, 5));
        return;
      }
      visCount.current++;
      setStates(s => s.map((u, i) => i === idx ? { phase: 'entering' } : u));
      timers.current[idx] = setTimeout(() => {
        setStates(s => s.map((u, i) => i === idx ? { phase: 'visible' } : u));
        timers.current[idx] = setTimeout(() => {
          setStates(s => s.map((u, i) => i === idx ? { phase: 'exiting' } : u));
          timers.current[idx] = setTimeout(() => {
            visCount.current--;
            setStates(s => s.map((u, i) => i === idx ? { phase: 'hidden' } : u));
            scheduleUser(idx, getRandMs(3, 9));
          }, 800);
        }, getRandMs(6, 14));
      }, 900);
    }, delay ?? getRandMs(0, 8));
  };

  useEffect(() => {
    POOL.forEach((_, i) => scheduleUser(i, getRandMs(0, 10)));
    return () => { timers.current.forEach(t => t && clearTimeout(t)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {POOL.map((user, i) => {
        const { phase } = states[i];
        if (phase === 'hidden') return null;
        const isHovered = hoveredId === user.id;
        return (
          <div
            key={user.id}
            className={`${styles.wrapper} ${user.center ? styles.wrapperClickable : ''}`}
            style={{
              left: user.left,
              top: user.top,
              '--float-dur': `${user.floatDuration}s`,
              '--float-del': `${user.floatDelay}s`,
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredId(user.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => user.center && globeStore.flyTo(user.center, user.zoom ?? 10)}
          >
            {/* Badge pill */}
            <div className={`${styles.badge} ${styles[phase]}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.img} alt={user.name} className={styles.avatar} />
              <div className={styles.info}>
                <span className={styles.name}>{user.name}</span>
                <span className={styles.song}>{user.song}</span>
              </div>
            </div>

            {/* Hover preview card */}
            {isHovered && (
              <div className={styles.preview}>
                <div className={styles.previewTop}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user.img} alt={user.name} className={styles.previewAvatar} />
                  <div className={styles.previewMeta}>
                    <div className={styles.previewNameRow}>
                      <span className={styles.previewName}>{user.name}</span>
                    </div>
                    <span className={styles.previewCity}>
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 1a3.5 3.5 0 00-3.5 3.5C2.5 7.5 6 11 6 11s3.5-3.5 3.5-6.5A3.5 3.5 0 006 1z"/>
                        <circle cx="6" cy="4.5" r="1"/>
                      </svg>
                      {user.city}
                    </span>
                  </div>
                </div>
                <div className={styles.previewDivider} />
                <div className={styles.previewSongRow}>
                  <svg className={styles.previewMusicIcon} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 1v7"/>
                    <path d="M5 3v7"/>
                    <circle cx="3.5" cy="10" r="1.5"/>
                    <circle cx="7.5" cy="8" r="1.5"/>
                    <path d="M5 3l4-2"/>
                  </svg>
                  <div className={styles.previewSongInfo}>
                    <span className={styles.previewSongTitle}>{user.song}</span>
                    <span className={styles.previewArtist}>{user.artist}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
