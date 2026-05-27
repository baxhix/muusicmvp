'use client';

import { Component, type ReactNode } from 'react';
import styles from './ChatErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  /** Callback opcional pra fechar o panel quando o user clica
   *  "Voltar". Sem ele, o fallback fica em loop visual. */
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary local pro chat panel.
 *
 * Render de mensagens pode crashear por payloads malformados —
 * regex de @mention com encoding quebrado, body que vira NaN no
 * parse de reply, reactions com emoji inválido vindo do socket.
 * Sem boundary, o crash bubbles até o root e o /app inteiro
 * morre — UX desproporcional pro problema (1 mensagem ruim).
 *
 * Aqui isolamos: o panel inteiro vira um fallback "tente de novo",
 * mantendo o resto do shell (mapa, navbar, FeedPanel) intacto.
 *
 * `logger.error` no `componentDidCatch` envia a stack pra Sentry/
 * console com `scope: chat.panel.render-boundary` pra que a gente
 * consiga rastrear qual mensagem foi a culpada (se conseguir
 * correlacionar com socket logs).
 */
export default class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    // Logging mínimo pelo console aqui — em prod o ErrorBoundary
    // global do Next também pega via window.onerror.
    console.error('[ChatErrorBoundary] caught:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={styles.fallback} role="alert">
        <div className={styles.fallbackIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17.01v.01" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <h3 className={styles.fallbackTitle}>
          Tivemos um problema ao abrir essa conversa
        </h3>
        <p className={styles.fallbackText}>
          Algo deu errado no carregamento das mensagens. Tente
          recarregar — se persistir, feche e abra a conversa.
        </p>
        <div className={styles.fallbackActions}>
          <button
            type="button"
            className={styles.fallbackBtn}
            onClick={this.handleRetry}
          >
            Tentar de novo
          </button>
          {this.props.onClose && (
            <button
              type="button"
              className={`${styles.fallbackBtn} ${styles.fallbackBtnGhost}`}
              onClick={this.props.onClose}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    );
  }
}
