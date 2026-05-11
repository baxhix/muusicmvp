'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional override for the fallback UI. Defaults to a friendly retry screen. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Root error boundary — catches errors thrown during render, lifecycle,
 * or constructors of descendants. Render errors otherwise tear down the
 * whole React tree to a blank screen.
 *
 * Must be a class component because hooks can't implement
 * componentDidCatch / getDerivedStateFromError. Wrap the whole app once
 * (in layout.tsx) so any unexpected crash stops at this boundary.
 *
 * Recovery: clicking "Tentar de novo" resets the state. If the same
 * error reappears immediately, the user can use the "Recarregar página"
 * link to do a full reload — typically required when the error is in a
 * deeper hook that won't re-mount cleanly.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the console for DevTools and any error-tracking proxy
    // a future PR may add (Sentry, etc.). Keep the payload small.
    console.error('[ErrorBoundary] caught a render error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private hardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div style={rootStyle}>
        <div style={cardStyle}>
          <div style={emojiStyle} aria-hidden="true">⚠️</div>
          <h1 style={titleStyle}>Algo quebrou aqui</h1>
          <p style={leadStyle}>
            Aconteceu um erro inesperado. A gente já registrou e seguimos
            corrigindo. Você pode tentar continuar de onde parou ou
            recarregar a página.
          </p>
          <pre style={traceStyle}>{error.message}</pre>
          <div style={actionsStyle}>
            <button type="button" style={primaryBtnStyle} onClick={this.reset}>
              Tentar de novo
            </button>
            <button type="button" style={secondaryBtnStyle} onClick={this.hardReload}>
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Inline styles only — error boundary needs to work even if the CSS
// modules system is the thing that broke.
const rootStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: '#08080a',
  color: '#f5f5f7',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  zIndex: 999999,
};
const cardStyle: React.CSSProperties = {
  maxWidth: 460,
  padding: '32px 28px',
  background: 'rgba(15, 15, 18, 0.96)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 16,
  boxShadow: '0 24px 60px -10px rgba(0,0,0,0.85)',
};
const emojiStyle: React.CSSProperties = { fontSize: 36, marginBottom: 12 };
const titleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.015em',
};
const leadStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 14,
  lineHeight: 1.5,
  color: 'rgba(245,245,247,0.65)',
};
const traceStyle: React.CSSProperties = {
  margin: '0 0 18px',
  padding: '10px 12px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  color: '#fca5a5',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 120,
  overflowY: 'auto',
};
const actionsStyle: React.CSSProperties = { display: 'flex', gap: 10 };
const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '11px 18px',
  border: 'none',
  borderRadius: 10,
  background: '#3ddb74',
  color: '#061110',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '11px 18px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  background: 'transparent',
  color: '#f5f5f7',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
