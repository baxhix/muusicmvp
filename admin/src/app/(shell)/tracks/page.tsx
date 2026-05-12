'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconTrash, IconLink } from '@/components/icons';
import { tracksService, type AdminTrack } from '@/services/tracks';
import styles from './page.module.css';

/* ── URL helpers (mirror of the server-side parser) ────────────────
 * Used here only for the live "preview the thumb" feel while typing.
 * The server-side parser remains authoritative.
 * ──────────────────────────────────────────────────────────────────── */

function extractYouTubeId(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  let url: URL;
  try {
    url = new URL(t.startsWith('http') ? t : `https://${t}`);
  } catch {
    return null;
  }
  const h = url.hostname.toLowerCase();
  if (h === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (h === 'youtube.com' || h.endsWith('.youtube.com')) {
    const v = url.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['shorts', 'embed', 'v'].includes(parts[0])) {
      const id = parts[1];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }
  }
  return null;
}

function thumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function TracksPage() {
  const [tracks, setTracks] = useState<AdminTrack[] | null>(null);
  const [draft, setDraft] = useState({ url: '', title: '', artist: '', album: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminTrack | null>(null);
  const { push } = useToast();

  const refresh = useCallback(() => {
    tracksService
      .list()
      .then(setTracks)
      .catch((err) => {
        console.error('tracksService.list failed:', err);
        setTracks([]);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const previewId = useMemo(
    () => (draft.url ? extractYouTubeId(draft.url) : null),
    [draft.url],
  );

  // Disable submit until the URL parses + both title and artist are
  // filled — the backend would reject otherwise anyway, but blocking
  // up front prevents a wasted round-trip and improves perceived snap.
  const canSubmit =
    !!previewId &&
    draft.title.trim().length > 0 &&
    draft.artist.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await tracksService.create({
        url: draft.url.trim(),
        title: draft.title.trim(),
        artist: draft.artist.trim(),
        album: draft.album.trim() || undefined,
      });
      if (res.created) {
        push({
          type: 'success',
          title: 'Música adicionada',
          description: `${res.track.title} — ${res.track.artist} já está no catálogo.`,
        });
      } else {
        push({
          type: 'info',
          title: 'Música já estava no catálogo',
          description: 'Esse vídeo do YouTube já tinha sido cadastrado antes.',
        });
      }
      setDraft({ url: '', title: '', artist: '', album: '' });
      refresh();
    } catch (err) {
      console.error('tracksService.create failed:', err);
      push({
        type: 'error',
        title: 'Falha ao adicionar',
        description:
          'O backend rejeitou o cadastro. Confere a URL e tenta de novo.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await tracksService.remove(target.id);
      push({
        type: 'success',
        title: 'Música removida',
        description: `${target.title} — ${target.artist} saiu do catálogo.`,
      });
      // Optimistic update so the row disappears immediately even if a
      // refresh is in flight.
      setTracks((prev) =>
        prev ? prev.filter((t) => t.id !== target.id) : prev,
      );
      refresh();
    } catch (err) {
      console.error('tracksService.remove failed:', err);
      push({
        type: 'error',
        title: 'Falha ao remover',
        description: 'Tenta de novo em alguns segundos.',
      });
    }
  };

  const columns: Column<AdminTrack>[] = [
    {
      id: 'track',
      header: 'Música',
      sortKey: (t) => t.title,
      cell: (t) => (
        <div className={styles.cellTrack}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl(t.youtubeId)}
            alt=""
            className={styles.cellThumb}
            onError={(e) => {
              e.currentTarget.style.opacity = '0.3';
            }}
          />
          <div className={styles.cellTrackText}>
            <span className={styles.cellTrackTitle}>{t.title}</span>
            <span className={styles.cellTrackArtist}>{t.artist}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'youtubeId',
      header: 'YouTube',
      cell: (t) => (
        <a
          href={`https://youtu.be/${t.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cellYoutubeLink}
          onClick={(e) => e.stopPropagation()}
        >
          {t.youtubeId}
        </a>
      ),
      width: 160,
    },
    {
      id: 'createdAt',
      header: 'Adicionado em',
      sortKey: (t) => t.createdAt,
      cell: (t) => (
        <span className={styles.cellDate}>{formatDate(t.createdAt)}</span>
      ),
      width: 130,
    },
    {
      id: 'actions',
      header: 'Ação',
      align: 'right',
      cell: (t) => (
        <div className={styles.cellActions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Remover ${t.title}`}
            title="Remover"
            onClick={() => setPendingDelete(t)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
      width: 80,
    },
  ];

  return (
    <>
      <PageHeader
        title="Músicas"
        description="Catálogo do player — todo cadastro daqui aparece na plataforma na próxima carga do hook useTracksCatalog."
      />

      <div className={styles.body}>
        {/* ── Add form ────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Adicionar música"
            description="Cole a URL de um vídeo no YouTube (qualquer formato: youtu.be, watch?v=, shorts/). Título e artista são manuais por enquanto."
          />
          <form onSubmit={handleSubmit} className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="track-url">
                URL do YouTube
              </label>
              <Input
                id="track-url"
                inputSize="md"
                placeholder="https://youtu.be/dQw4w9WgXcQ"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                leadingIcon={<IconLink size={14} />}
              />
              {draft.url && !previewId && (
                <span className={styles.formError}>
                  URL inválida — verifique o link.
                </span>
              )}
              {previewId && (
                <span className={styles.formSuccess}>
                  ID detectado: {previewId}
                </span>
              )}
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="track-title">
                Título
              </label>
              <Input
                id="track-title"
                inputSize="md"
                placeholder="Boiadeira"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="track-artist">
                Artista
              </label>
              <Input
                id="track-artist"
                inputSize="md"
                placeholder="Ana Castela"
                value={draft.artist}
                onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="track-album">
                Álbum (opcional)
              </label>
              <Input
                id="track-album"
                inputSize="md"
                placeholder="—"
                value={draft.album}
                onChange={(e) => setDraft({ ...draft, album: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                leadingIcon={<IconPlus size={14} />}
                disabled={!canSubmit}
              >
                {submitting ? 'Adicionando…' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Card>

        {/* ── Table ──────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={`Catálogo (${tracks?.length ?? '—'})`}
            description="Cada faixa aqui aparece na playlist do player muusic. Novos cadastros ficam no topo."
          />
          <Table<AdminTrack>
            columns={columns}
            data={tracks ?? []}
            rowId={(t) => t.id}
            pageSize={20}
            loading={tracks === null}
          />
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        destructive
        title={pendingDelete ? `Remover ${pendingDelete.title}?` : ''}
        description="A música sai do catálogo da plataforma. O histórico de reproduções dos usuários é preservado, mas a faixa não aparece mais na playlist."
        confirmLabel="Remover do catálogo"
      />
    </>
  );
}
