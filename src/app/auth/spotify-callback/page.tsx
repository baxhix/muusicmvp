'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { handleSpotifyCallback } from '@/lib/spotify';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const err = params.get('error');

    if (err) {
      setError(`Spotify retornou erro: ${err}`);
      return;
    }
    if (!code) {
      setError('Código de autorização ausente.');
      return;
    }

    handleSpotifyCallback(code)
      .then(() => router.replace('/app?spotify=connected'))
      .catch((e) => setError(e?.message || 'Falha ao trocar código por token.'));
  }, [params, router]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#08080A',
        color: '#F5F5F7',
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        {error ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Não consegui conectar ao Spotify
            </div>
            <div style={{ fontSize: 12, color: '#A1A1AA', marginBottom: 20 }}>{error}</div>
            <a
              href="/app"
              style={{
                display: 'inline-block',
                padding: '10px 18px',
                background: '#F5F5F7',
                color: '#08080A',
                borderRadius: 999,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Voltar ao app
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Conectando ao Spotify…</div>
            <div style={{ fontSize: 12, color: '#A1A1AA' }}>Só um instante.</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SpotifyCallback() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
