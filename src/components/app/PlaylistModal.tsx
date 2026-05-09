'use client';

import { useEffect, useMemo, useState, type AnimationEvent } from 'react';
import { SONGS } from './NowPlaying';
import styles from './PlaylistModal.module.css';

/** Normaliza string pra busca: minúsculas + sem acentos */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface PlaylistModalProps {
  open: boolean;
  onClose: () => void;
  /** Índice da música atualmente tocando (pra destacar) */
  currentIdx: number;
  /** Callback quando o usuário escolhe uma música */
  onSelect: (idx: number) => void;
}

export default function PlaylistModal({
  open,
  onClose,
  currentIdx,
  onSelect,
}: PlaylistModalProps) {
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);

  // Limpa a busca ao fechar
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setQuery(''); setHighlightIdx(0); }, 360);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setPhase((p) => (p === 'idle' || p === 'out' ? 'in' : p));
    } else {
      setPhase((p) => (p === 'idle' ? 'idle' : 'out'));
    }
  }, [open]);

  const handleAnimationEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'in' && e.animationName.includes('playlist-rise')) setPhase('open');
    if (phase === 'out' && e.animationName.includes('playlist-fall')) setPhase('idle');
  };

  // ESC fecha; setas navegam; Enter seleciona
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filteredCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const item = filtered[highlightIdx];
        if (item) {
          onSelect(item.originalIdx);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, highlightIdx, query]);

  // Filtragem por título + artista (sem acentos / case-insensitive)
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const all = SONGS.map((s, i) => ({ ...s, originalIdx: i }));
    if (!q) return all;
    return all.filter((s) => {
      const haystack = normalize(`${s.title} ${s.artist}`);
      return haystack.includes(q);
    });
  }, [query]);
  const filteredCount = filtered.length;

  // Reset highlight quando a query muda
  useEffect(() => { setHighlightIdx(0); }, [query]);

  if (phase === 'idle') return null;

  const isIn = phase === 'in';
  const isOut = phase === 'out';

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOut ? styles.backdropOut : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${isIn ? styles.panelEntering : ''} ${isOut ? styles.panelClosing : ''}`}
        onAnimationEnd={handleAnimationEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Playlist"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Playlist</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {/* Campo de busca com autocomplete */}
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Buscar música ou artista..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Buscar na playlist"
              aria-autocomplete="list"
              aria-controls="playlist-suggestions"
              aria-activedescendant={
                filtered[highlightIdx]
                  ? `playlist-item-${filtered[highlightIdx].originalIdx}`
                  : undefined
              }
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          <p className={styles.subtitle}>
            {query
              ? `${filteredCount} resultado${filteredCount === 1 ? '' : 's'} de ${SONGS.length}`
              : `${SONGS.length} faixas · clique pra tocar`}
          </p>

          {filteredCount === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhuma faixa encontrada</p>
              <span>Tente outro termo</span>
            </div>
          ) : (
            <ul id="playlist-suggestions" className={styles.list} role="listbox">
              {filtered.map((s, i) => {
                const isCurrent = s.originalIdx === currentIdx;
                const isHighlighted = i === highlightIdx;
                return (
                  <li key={s.youtubeId}>
                    <button
                      type="button"
                      id={`playlist-item-${s.originalIdx}`}
                      role="option"
                      aria-selected={isCurrent}
                      className={`${styles.item} ${isCurrent ? styles.itemActive : ''} ${isHighlighted ? styles.itemHighlight : ''}`}
                      onClick={() => {
                        onSelect(s.originalIdx);
                        onClose();
                      }}
                      onMouseEnter={() => setHighlightIdx(i)}
                    >
                      <div className={styles.thumbWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.img}
                          alt=""
                          className={styles.thumb}
                        />
                        {isCurrent && (
                          <span className={styles.nowPlayingBadge} aria-hidden="true">
                            <span /><span /><span />
                          </span>
                        )}
                      </div>
                      <div className={styles.info}>
                        <span className={styles.itemTitle}>{s.title}</span>
                        <span className={styles.itemArtist}>
                          {s.artist}
                          {'year' in s && s.year ? (
                            <>
                              <span className={styles.itemSep}> · </span>
                              <span className={styles.itemYear}>{s.year}</span>
                            </>
                          ) : null}
                        </span>
                      </div>
                      <span className={styles.playBtn} aria-hidden="true">
                        {isCurrent ? (
                          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <rect x="3.5" y="2.5" width="3" height="11" rx="1"/>
                            <rect x="9.5" y="2.5" width="3" height="11" rx="1"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M4 3l9 5-9 5V3z"/>
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
