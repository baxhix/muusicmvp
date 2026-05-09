'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { checkAdminAuth, muusicAppUrl, type AuthCheckResult } from '@/lib/auth';

const POLL_MS = 60_000; // re-verify every minute

interface Props {
  children: ReactNode;
}

/**
 * Top-level gate for /admin/*. Verifies the visitor has an authenticated
 * muusic session AND role === 'admin'. Renders friendly fallbacks while
 * loading / when not allowed.
 *
 * In dev (when NEXT_PUBLIC_API_BASE_URL is unset), checkAdminAuth returns
 * a mock admin so the UI is usable standalone.
 */
export default function AdminAuthGate({ children }: Props) {
  const [auth, setAuth] = useState<AuthCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const res = await checkAdminAuth();
      if (!cancelled) setAuth(res);
    };
    verify();
    const id = setInterval(verify, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (auth === null) {
    return (
      <div style={fullScreen}>
        <div style={muted}>Verificando acesso…</div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return (
      <div style={fullScreen}>
        <div style={card}>
          <h1 style={title}>Acesso restrito</h1>
          <p style={muted}>Você precisa fazer login no muusic primeiro.</p>
          <a href={muusicAppUrl('/auth')} style={btn}>Ir pra tela de login</a>
        </div>
      </div>
    );
  }

  if (auth.status === 'forbidden') {
    return (
      <div style={fullScreen}>
        <div style={card}>
          <h1 style={title}>Sem permissão</h1>
          <p style={muted}>
            Sua conta ({auth.user?.email}) não tem perfil de administrador.
          </p>
          <p style={smallMuted}>
            Peça pra um admin rodar:
            <br />
            <code style={code}>UPDATE users SET role=&apos;admin&apos; WHERE email=&apos;{auth.user?.email}&apos;;</code>
          </p>
        </div>
      </div>
    );
  }

  if (auth.status === 'unreachable') {
    return (
      <div style={fullScreen}>
        <div style={card}>
          <h1 style={title}>API indisponível</h1>
          <p style={muted}>Não consegui falar com o backend muusic.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Inline styles to avoid pulling in an extra .module.css for a gate.
// Uses theme CSS vars so dark/light works automatically.
const fullScreen: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  color: 'var(--ink)',
  padding: '24px',
};
const card: React.CSSProperties = {
  maxWidth: 460,
  padding: '32px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  textAlign: 'center',
  boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
};
const title: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 22,
  fontWeight: 700,
};
const muted: React.CSSProperties = {
  color: 'var(--ink-mute)',
  fontSize: 14,
  margin: 0,
};
const smallMuted: React.CSSProperties = {
  color: 'var(--ink-mute)',
  fontSize: 12,
  margin: '16px 0 0',
};
const btn: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 20,
  padding: '10px 20px',
  background: 'var(--ink)',
  color: 'var(--bg)',
  borderRadius: 'var(--r-sm)',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: 14,
};
const code: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 8,
  padding: '6px 10px',
  background: 'var(--bg-subtle)',
  borderRadius: 'var(--r-xs)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--ink)',
  wordBreak: 'break-all',
};
