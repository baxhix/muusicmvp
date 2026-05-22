'use client';

import styles from './NowPlayingPreview.module.css';

/**
 * NowPlayingPreview — versão display-only do player pra exibir
 * o que OUTRO usuário está ouvindo no painel de perfil dele.
 *
 * Motivação (per product feedback "quando eu visitar o perfil
 * de outro usuário e abrir o modal, não devem ser exibidos os
 * controles do player de outro usuário. Apenas a informação
 * do que o outro usuário está ouvindo"):
 *
 * - O <NowPlaying /> antigo é fortemente acoplado ao player do
 *   USUÁRIO LOGADO — lê de hooks como useNowPlaying,
 *   useSpotifyNowPlaying, useListeningTracker. Renderizá-lo no
 *   <ProfilePanel /> de outra pessoa mostrava controles +
 *   dados do logged-in (não do perfil visitado), gerando dupla
 *   confusão.
 *
 * - Esta versão é "burra": recebe `track` (título + artista +
 *   capa opcional) e renderiza um pill estático em layout
 *   idêntico ao .playerEmbed do NowPlaying real. Sem botões,
 *   sem progress bar, sem Spotify badge. Visual + leitura
 *   100% consistentes com o original.
 *
 * - Se `track` for null/undefined, o componente não renderiza
 *   nada — o consumer pode passar `user.nowPlaying` direto.
 */

export interface NowPlayingPreviewProps {
  track: {
    title: string;
    artist: string;
    /** Capa opcional. Se ausente, mostra um gradiente sutil. */
    cover?: string;
    /** YouTube ID — quando presente e sem `cover`, derivamos
     *  a thumbnail oficial automaticamente (mesma URL que o
     *  NowPlaying real usa). */
    youtubeId?: string | null;
  } | null | undefined;
  className?: string;
}

function deriveCover(
  cover: string | undefined,
  youtubeId: string | null | undefined,
): string | null {
  if (cover) return cover;
  if (youtubeId) return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  return null;
}

export default function NowPlayingPreview({
  track,
  className,
}: NowPlayingPreviewProps) {
  if (!track) return null;
  const cover = deriveCover(track.cover, track.youtubeId);

  return (
    <div
      className={[styles.preview, className].filter(Boolean).join(' ')}
      role="region"
      aria-label={`${track.title} — ${track.artist}, tocando agora`}
    >
      <div className={styles.art} aria-hidden="true">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className={styles.artImg} />
        ) : (
          <div className={styles.artFallback} />
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title} title={track.title}>
          {track.title}
        </div>
        <div className={styles.artist} title={track.artist}>
          {track.artist}
        </div>
      </div>
      {/* Wave bars discretas — sinal de que é "ao vivo", sem
       *  oferecer affordance de controle. Mesma vibe do
       *  indicador "ouvindo agora" do FloatingAvatar. */}
      <span className={styles.wave} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
