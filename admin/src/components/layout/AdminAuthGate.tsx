'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { checkAdminAuth, type AuthCheckResult } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

const POLL_MS = 60_000; // re-verify every minute

interface Props {
  children: ReactNode;
}

/**
 * Top-level gate for /admin/*. Verifies the visitor has an authenticated
 * muusic session AND role === 'admin'. Renders friendly fallbacks while
 * loading / when not allowed — including a magic-link sign-in form so
 * the admin can be logged into directly without bouncing through the
 * main app.
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
        <SignInCard />
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

/* ── Sign-in card ───────────────────────────────────────────
 * Direct magic-link login from inside the admin app. POSTs to
 * /api/auth/request with `returnTo` set to the admin URL so the
 * verify redirect lands back here. Cookies are scoped to
 * .muusic.live, so once the session lands AdminAuthGate's poll
 * picks it up on the next interval (or immediately on reload).
 * ──────────────────────────────────────────────────────────── */
function SignInCard() {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setPhase('sending');
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          // Bring the user back to admin (not muusic.live/app) after they
          // click the magic link in their inbox.
          returnTo:
            typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(
          body?.error === 'email_failed'
            ? 'Falha no envio do email. Tenta de novo em alguns segundos.'
            : 'Algo deu errado. Verifica o email e tenta novamente.',
        );
        setPhase('error');
        return;
      }
      setPhase('sent');
    } catch {
      setErrorMsg('Não consegui falar com o backend.');
      setPhase('error');
    }
  };

  if (phase === 'sent') {
    return (
      <div style={card}>
        <h1 style={title}>Confere seu email</h1>
        <p style={muted}>
          Mandei um link de acesso pra <strong>{email}</strong>. O link
          expira em 15 minutos. Depois de clicar, você volta pra cá já
          logado.
        </p>
        <button
          type="button"
          style={{ ...secondaryBtn, marginTop: 24 }}
          onClick={() => {
            setPhase('idle');
            setEmail('');
            setErrorMsg(null);
          }}
        >
          Enviar pra outro email
        </button>
      </div>
    );
  }

  return (
    <div style={card}>
      <h1 style={title}>Acesso ao painel</h1>
      <p style={{ ...muted, textAlign: 'left' }}>
        Entra com o email que tem perfil de admin. Você recebe um link
        único pra fazer login — sem senha.
      </p>
      <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={phase === 'sending'}
          style={input}
        />
        {phase === 'error' && errorMsg && (
          <p style={errorText}>{errorMsg}</p>
        )}
        <button
          type="submit"
          disabled={phase === 'sending' || !email.trim()}
          style={{
            ...btn,
            marginTop: 16,
            width: '100%',
            opacity: phase === 'sending' || !email.trim() ? 0.55 : 1,
            cursor:
              phase === 'sending' || !email.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {phase === 'sending' ? 'Enviando…' : 'Mandar link de acesso'}
        </button>
      </form>
    </div>
  );
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
  border: 'none',
  borderRadius: 'var(--r-sm)',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--ink-mute)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg-subtle, var(--bg))',
  color: 'var(--ink)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
const errorText: React.CSSProperties = {
  margin: '12px 0 0',
  color: '#dc2626',
  fontSize: 13,
  textAlign: 'left',
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
