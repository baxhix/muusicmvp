/**
 * "Voltar de onde parou" no player de vídeo do NowPlaying.
 *
 * Como funciona:
 *   - Enquanto o iframe do YouTube envia eventos `infoDelivery`
 *     (já estamos escutando por outro motivo em NowPlaying.tsx),
 *     a gente captura o `info.currentTime` num ref e grava no
 *     localStorage uma vez por segundo. Custo: 1 write/s de uns
 *     ~120 bytes, irrelevante em qualquer disco/navegador.
 *   - Save também acontece em momentos-chave (mudança de faixa,
 *     visibilitychange='hidden', unmount) pra cobrir o caso do
 *     usuário fechar a aba/reload entre dois ticks do interval.
 *   - No mount, lê o snapshot, encontra a faixa no catálogo e
 *     injeta `start=<segundos>` no URL do embed do YouTube. O
 *     player abre exatamente naquele timestamp.
 *
 * Limitações herdadas do modelo SPA + YouTube embed:
 *   - O reload destrói o DOM, então tem um gap perceptível de
 *     ~200-500ms enquanto o iframe (re)carrega.
 *   - Autoplay policy: alguns navegadores (Safari, Chrome sem
 *     user gesture) bloqueiam autoplay após reload. O player
 *     abre PAUSADO no segundo certo — um clique retoma. Padrão
 *     da indústria (Spotify Web, YouTube Music etc. fazem igual).
 *
 * TTL de 24h: depois disso o usuário provavelmente voltou em
 * outra sessão e não espera continuar de onde parou.
 */

interface NowPlayingSnapshot {
  youtubeId: string;
  time: number;
  wasPlaying: boolean;
  ts: number; // Date.now()
}

const STORAGE_KEY = 'muusic.nowPlaying.v1';
const TTL_MS = 24 * 60 * 60 * 1000;

export function saveNowPlayingSnapshot(snapshot: {
  youtubeId: string | null | undefined;
  time: number;
  wasPlaying: boolean;
}): void {
  if (typeof window === 'undefined') return;
  if (!snapshot.youtubeId) return;
  try {
    const payload: NowPlayingSnapshot = {
      youtubeId: snapshot.youtubeId,
      time: Math.max(0, Math.floor(snapshot.time)),
      wasPlaying: snapshot.wasPlaying,
      ts: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode / iframe sandbox — silently ignore. The
    // user just won't have resume; nothing else breaks.
  }
}

export function loadNowPlayingSnapshot(): NowPlayingSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NowPlayingSnapshot>;
    if (
      typeof parsed?.youtubeId !== 'string' ||
      typeof parsed?.time !== 'number' ||
      typeof parsed?.ts !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return {
      youtubeId: parsed.youtubeId,
      time: parsed.time,
      wasPlaying: parsed.wasPlaying === true,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

export function clearNowPlayingSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
