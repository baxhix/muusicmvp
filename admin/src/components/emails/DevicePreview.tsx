'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import styles from './DevicePreview.module.css';

export type DeviceMode = 'mobile' | 'desktop';

interface DevicePreviewProps {
  /** HTML completo do email (já interpolado com vars de preview). */
  html: string;
  /** Subject pra simular a barra de aplicativo de email. */
  subject?: string;
  /** Default `desktop`. */
  defaultDevice?: DeviceMode;
}

/**
 * Renderiza o preview do email dentro de um "device frame" estilizado
 * que simula como o usuário final vê:
 *
 *   - Mobile: iPhone-like frame 390px wide com header de Mail
 *   - Desktop: janela de email client com sidebar fake + header
 *
 * Toggle no topo pra alternar. Iframe garante isolamento de CSS
 * (Tailwind/admin styles não vazam pro template).
 *
 * O subject + remetente fake no topo da "tela" deixa o admin
 * antever a primeira impressão (subject preview no inbox).
 */
export default function DevicePreview({
  html,
  subject,
  defaultDevice = 'desktop',
}: DevicePreviewProps) {
  const [mode, setMode] = useState<DeviceMode>(defaultDevice);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toggle}>
          <button
            type="button"
            className={cn(styles.toggleBtn, mode === 'desktop' && styles.toggleActive)}
            onClick={() => setMode('desktop')}
            aria-pressed={mode === 'desktop'}
          >
            <DesktopIcon /> Desktop
          </button>
          <button
            type="button"
            className={cn(styles.toggleBtn, mode === 'mobile' && styles.toggleActive)}
            onClick={() => setMode('mobile')}
            aria-pressed={mode === 'mobile'}
          >
            <MobileIcon /> Mobile
          </button>
        </div>
        <div className={styles.hint}>
          {mode === 'mobile' ? '360 × 640' : '560 × 540'} · preview ao vivo
        </div>
      </div>

      <div className={styles.stage}>
        <div
          className={cn(
            styles.device,
            mode === 'mobile' ? styles.deviceMobile : styles.deviceDesktop,
          )}
        >
          {/* Cabeçalho fake do email client */}
          <div className={styles.clientHeader}>
            <div className={styles.clientChrome}>
              {mode === 'mobile' ? (
                <>
                  <span className={styles.clientBack}>‹</span>
                  <span className={styles.clientTitle}>Caixa de entrada</span>
                </>
              ) : (
                <span className={styles.clientTitle}>Caixa de entrada — 1 mensagem</span>
              )}
            </div>
            <div className={styles.clientMeta}>
              <div className={styles.fromRow}>
                <div className={styles.avatar}>F</div>
                <div className={styles.fromText}>
                  <div className={styles.fromName}>Fanverse</div>
                  <div className={styles.fromAddr}>noreply@muusic.live</div>
                </div>
              </div>
              {subject && (
                <div className={styles.subjectRow}>{subject}</div>
              )}
            </div>
          </div>

          {/* Conteúdo do email — isolated via iframe pra CSS não vazar */}
          <iframe
            className={styles.frame}
            srcDoc={html}
            title="Email preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Mini-icons (inline pra não acoplar com /icons) ───────────── */

function DesktopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  );
}
