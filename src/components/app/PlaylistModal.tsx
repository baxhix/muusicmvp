'use client';

import { useEffect, useMemo, useState, type AnimationEvent } from 'react';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import { ANA_ALBUMS, type AnaAlbum } from '@/data/anaAlbums';
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

type TabId = 'recentes' | 'albums';

export default function PlaylistModal({
  open,
  onClose,
  currentIdx,
  onSelect,
}: PlaylistModalProps) {
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [tab, setTab] = useState<TabId>('recentes');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  /** Truncate the list to a small "above the fold" set by default;
   *  user expands via the "Ver mais" CTA below. Reset on close so
   *  reopening the modal starts at 7 again. */
  const PREVIEW_COUNT = 7;
  const [showAll, setShowAll] = useState(false);
  // Live catalog — replaces the old static `SONGS` import. We derive
  // the cover image from the YouTube id right here so the modal stays
  // self-contained (matches the shape NowPlaying composes too).
  const { tracks: catalog } = useTracksCatalog();
  const SONGS = useMemo(
    () =>
      catalog.map((s) => ({
        ...s,
        img: `https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg`,
      })),
    [catalog],
  );

  // Reseta estados ao fechar — incluindo o tab e o álbum selecionado
  // pra que reabrir comece sempre em "Recentes" no nível raiz.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setQuery('');
        setHighlightIdx(0);
        setShowAll(false);
        setTab('recentes');
        setSelectedAlbumId(null);
      }, 360);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Searching always expands the visible list — a 7-item cap on a
  // searched result set hides matches the user is actively looking
  // for. Once the user types, "Ver mais" disappears.
  useEffect(() => {
    if (query) setShowAll(true);
  }, [query]);

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

  // Álbum atualmente aberto (se houver). Resolve a referência pelo id
  // — undefined se nenhum álbum aberto ou se o id ficou stale.
  const selectedAlbum: AnaAlbum | undefined = useMemo(
    () => ANA_ALBUMS.find((a) => a.id === selectedAlbumId),
    [selectedAlbumId],
  );

  // Base de músicas que alimenta a lista visível:
  //   - busca preenchida → SEMPRE catálogo inteiro (engloba todos
  //     resultados, ignorando tab/álbum, per pedido do produto).
  //   - tab "Recentes"  → catálogo inteiro.
  //   - álbum aberto    → só as faixas do álbum (resolvidas pelo
  //     youtubeId contra o catálogo; faixas que não existem no
  //     catálogo são naturalmente descartadas).
  //   - tab "Álbuns" sem busca e sem álbum aberto → renderiza o grid
  //     de álbuns, não a lista; o array `tracksBase` fica vazio.
  const tracksBase = useMemo(() => {
    if (query) return SONGS;
    if (selectedAlbum) {
      const byId = new Map(SONGS.map((s) => [s.youtubeId, s]));
      return selectedAlbum.trackYoutubeIds
        .map((id) => byId.get(id))
        .filter((s): s is (typeof SONGS)[number] => Boolean(s));
    }
    if (tab === 'recentes') return SONGS;
    return [];
  }, [SONGS, query, selectedAlbum, tab]);

  // Filtragem por título + artista (sem acentos / case-insensitive).
  // Cada item carrega `originalIdx` apontando para o índice no
  // catálogo do player — é o número que o `onSelect` espera.
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const enriched = tracksBase.map((s) => ({
      ...s,
      originalIdx: SONGS.findIndex((c) => c.youtubeId === s.youtubeId),
    }));
    if (!q) return enriched;
    return enriched.filter((s) => {
      const haystack = normalize(`${s.title} ${s.artist}`);
      return haystack.includes(q);
    });
  }, [tracksBase, SONGS, query]);
  const filteredCount = filtered.length;
  // Visible slice — capped at PREVIEW_COUNT until the user clicks
  // "Ver mais" (or types a search, which auto-expands).
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filteredCount - visible.length;

  // Reset highlight quando a query / tab / álbum mudam.
  useEffect(() => { setHighlightIdx(0); }, [query, tab, selectedAlbumId]);

  // ESC fecha; setas navegam; Enter seleciona. Só ativa a navegação
  // por teclado quando a lista de músicas está visível (não no grid
  // de álbuns).
  const listVisible = filtered.length > 0;
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedAlbumId) {
          setSelectedAlbumId(null);
          return;
        }
        onClose();
        return;
      }
      if (!listVisible) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filteredCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const item = filtered[highlightIdx];
        if (item && item.originalIdx >= 0) {
          onSelect(item.originalIdx);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, highlightIdx, query, listVisible, selectedAlbumId]);

  if (phase === 'idle') return null;

  const isIn = phase === 'in';
  const isOut = phase === 'out';

  // Grid de álbuns aparece quando: tab=Álbuns + sem álbum aberto +
  // sem busca ativa. Qualquer busca cai pra lista unificada de
  // resultados (englobando catálogo inteiro).
  const showAlbumGrid =
    tab === 'albums' && !selectedAlbumId && !query;

  // Header dinâmico: dentro do detalhe de álbum mostramos seta de
  // voltar à esquerda em vez do título centralizado.
  const headerTitle = selectedAlbum ? selectedAlbum.name : 'Playlist';

  // Subtitle do corpo:
  //   - busca ativa → "X resultados de Y"
  //   - álbum aberto → contagem do álbum
  //   - tab Recentes → contagem total do catálogo
  //   - tab Álbuns sem álbum aberto → contagem de álbuns
  const subtitleText = (() => {
    if (query) {
      return `${filteredCount} resultado${filteredCount === 1 ? '' : 's'} de ${SONGS.length}`;
    }
    if (selectedAlbum) {
      return `${filteredCount} faixa${filteredCount === 1 ? '' : 's'} · clique pra tocar`;
    }
    if (tab === 'albums') {
      return `${ANA_ALBUMS.length} álbuns · escolha pra ver as faixas`;
    }
    return `${SONGS.length} faixas · clique pra tocar`;
  })();

  return (
    <>
      {/* Backdrop removed per product feedback — was covering the
          BottomNav and dimming the rest of the page. PlaylistModal
          now mirrors SuperfansPanel: just the panel, dismissible
          via the close button or Escape (handled above). The
          backdrop CSS classes stay in the module for the closing
          animation hook on the panel itself. */}
      <aside
        className={`${styles.panel} ${isIn ? styles.panelEntering : ''} ${isOut ? styles.panelClosing : ''}`}
        onAnimationEnd={handleAnimationEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Playlist"
      >
        <header className={styles.header}>
          {selectedAlbumId && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setSelectedAlbumId(null)}
              aria-label="Voltar para a lista de álbuns"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h2 className={styles.title}>{headerTitle}</h2>
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
          {/* Tabs Recentes / Álbuns — escondidos quando dentro de um
              álbum, porque a seta de voltar no header já navega o
              contexto e o tab não faria sentido ali. */}
          {!selectedAlbumId && (
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'recentes'}
                className={`${styles.tab} ${tab === 'recentes' ? styles.tabActive : ''}`}
                onClick={() => setTab('recentes')}
              >
                Recentes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'albums'}
                className={`${styles.tab} ${tab === 'albums' ? styles.tabActive : ''}`}
                onClick={() => setTab('albums')}
              >
                Álbuns
              </button>
            </div>
          )}

          {/* Campo de busca com autocomplete */}
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              {/* Magnifier glyph aligned with the chat search icon
                  (ConversationsSidebar) — same 16×16 viewBox + 1.8
                  stroke + circle/handle proportions so the two
                  search fields look identical. */}
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="M14 14l-3-3" />
              </svg>
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Buscar música ou artista…"
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

          <p className={styles.subtitle}>{subtitleText}</p>

          {/* Cabeçalho do álbum aberto — capa grande + nome — fica
              dentro do body, logo abaixo do subtitle. Reaproveita a
              estética dos `.thumbWrap` da lista (canto arredondado +
              sombra) só que num tamanho maior. */}
          {selectedAlbum && (
            <div className={styles.albumHeader}>
              <div className={styles.albumHeaderCover}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedAlbum.cover} alt="" className={styles.albumHeaderImg} />
              </div>
              <div className={styles.albumHeaderInfo}>
                <span className={styles.albumHeaderEyebrow}>Álbum</span>
                <span className={styles.albumHeaderName}>{selectedAlbum.name}</span>
              </div>
            </div>
          )}

          {showAlbumGrid ? (
            <ul className={styles.albumGrid}>
              {ANA_ALBUMS.map((album) => (
                <li key={album.id}>
                  <button
                    type="button"
                    className={styles.albumCard}
                    onClick={() => setSelectedAlbumId(album.id)}
                    aria-label={`Abrir álbum ${album.name}`}
                  >
                    <div className={styles.albumCardCover}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={album.cover} alt="" className={styles.albumCardImg} />
                    </div>
                    <span className={styles.albumCardName}>{album.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : filteredCount === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhuma faixa encontrada</p>
              <span>
                {query
                  ? 'Tente outro termo'
                  : selectedAlbum
                  ? 'Esse álbum ainda não tem faixas no catálogo'
                  : 'O catálogo está vazio'}
              </span>
            </div>
          ) : (
            <ul id="playlist-suggestions" className={styles.list} role="listbox">
              {visible.map((s, i) => {
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
          {hiddenCount > 0 && !showAlbumGrid && (
            <button
              type="button"
              className={styles.viewMoreBtn}
              onClick={() => setShowAll(true)}
            >
              Ver mais ({hiddenCount})
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
