'use client';

import {
  IconCheck,
  IconAlert,
  IconLoader,
  IconUpload,
  IconX,
  IconChevronDown,
  IconChevronRight,
} from '@/components/icons';
import { formatBytes } from './shared';
import styles from './FloatingUploadPanel.module.css';
import { useState } from 'react';

export type UploadStatus =
  | 'pending'   // ainda na fila, aguardando worker
  | 'uploading' // em progresso
  | 'done'      // finalizado com sucesso
  | 'error'     // falhou
  | 'invalid'   // rejeitado na validação client-side
  | 'cancelled'; // cancelado pelo usuário

export interface UploadItem {
  key: string;
  file: File;
  status: UploadStatus;
  /** 0–100 — progresso real do XHR. */
  progress: number;
  /** Mensagem amigável quando status='invalid' ou 'error'. */
  message?: string;
}

export interface FloatingUploadPanelProps {
  items: UploadItem[];
  /** Cancela um item específico (válido durante pending/uploading). */
  onCancelItem: (key: string) => void;
  /** Cancela TODOS os pendentes + em progresso. */
  onCancelAll: () => void;
  /** Remove um item da lista (útil pra limpar erros/cancelados). */
  onDismissItem: (key: string) => void;
  /** Limpa todos os finalizados (done/error/invalid/cancelled). */
  onClearFinished: () => void;
}

/**
 * Painel flutuante de upload — fica no canto inferior-direito da
 * tela, persiste enquanto há uploads na fila. Per product feedback
 * "ao arrastar muitos arquivos, não deve ainda ser feita uma
 * confirmação em um modal, o upload já deve começar, mostrar o
 * andamento e o botão de cancelar."
 *
 * Estados:
 *   - Expandido (default ao mostrar): lista completa de itens.
 *   - Minimizado: só header com contagem + chevron.
 *   - Hidden quando items.length === 0 (controlado pelo parent).
 *
 * Cada item mostra: ícone de status, nome, size + progresso
 * (uploading), mensagem de erro (error/invalid), e um X pra
 * cancelar (pending/uploading) ou dismissar (done/error).
 */
export default function FloatingUploadPanel({
  items,
  onCancelItem,
  onCancelAll,
  onDismissItem,
  onClearFinished,
}: FloatingUploadPanelProps) {
  const [minimized, setMinimized] = useState(false);

  if (items.length === 0) return null;

  const inProgress = items.filter(
    (it) => it.status === 'uploading' || it.status === 'pending',
  ).length;
  const done = items.filter((it) => it.status === 'done').length;
  const failed = items.filter(
    (it) => it.status === 'error' || it.status === 'invalid',
  ).length;
  const cancelled = items.filter((it) => it.status === 'cancelled').length;
  const allFinished = inProgress === 0;

  const headerLabel = allFinished
    ? `${done} ${done === 1 ? 'arquivo enviado' : 'arquivos enviados'}${failed > 0 ? `, ${failed} ${failed === 1 ? 'falha' : 'falhas'}` : ''}${cancelled > 0 ? `, ${cancelled} cancelado${cancelled === 1 ? '' : 's'}` : ''}`
    : `Enviando ${done}/${items.length}…`;

  return (
    <aside
      className={`${styles.panel} ${minimized ? styles.panelMinimized : ''}`}
      role="region"
      aria-label="Painel de uploads"
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.headerToggle}
          onClick={() => setMinimized((v) => !v)}
          aria-label={minimized ? 'Expandir painel' : 'Minimizar painel'}
        >
          {minimized ? (
            <IconChevronRight size={14} />
          ) : (
            <IconChevronDown size={14} />
          )}
          <span className={styles.headerLabel}>{headerLabel}</span>
        </button>
        <div className={styles.headerActions}>
          {!allFinished && (
            <button
              type="button"
              className={styles.headerActionBtn}
              onClick={onCancelAll}
              title="Cancelar todos pendentes"
            >
              Cancelar tudo
            </button>
          )}
          {allFinished && (
            <button
              type="button"
              className={styles.headerActionBtn}
              onClick={onClearFinished}
              title="Limpar a lista"
            >
              Limpar
            </button>
          )}
        </div>
      </header>

      {!minimized && (
        <ul className={styles.list}>
          {items.map((it) => (
            <li
              key={it.key}
              className={`${styles.item} ${styles[`item_${it.status}`]}`}
            >
              <span className={styles.itemIcon}>
                {it.status === 'pending' && <IconUpload size={12} />}
                {it.status === 'uploading' && (
                  <IconLoader size={12} className={styles.spin} />
                )}
                {it.status === 'done' && <IconCheck size={12} />}
                {(it.status === 'error' || it.status === 'invalid') && (
                  <IconAlert size={12} />
                )}
                {it.status === 'cancelled' && <IconX size={12} />}
              </span>
              <div className={styles.itemBody}>
                <span className={styles.itemName}>{it.file.name}</span>
                <span className={styles.itemMeta}>
                  {it.status === 'done' ? (
                    <>Enviado · {formatBytes(it.file.size)}</>
                  ) : it.status === 'cancelled' ? (
                    <>Cancelado</>
                  ) : it.message ? (
                    <span className={styles.itemError}>{it.message}</span>
                  ) : (
                    <>{formatBytes(it.file.size)}</>
                  )}
                </span>
                {it.status === 'uploading' && (
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {/* Botão à direita:
               *   - uploading/pending → cancelar
               *   - done/error/invalid/cancelled → dismissar */}
              {it.status === 'uploading' || it.status === 'pending' ? (
                <button
                  type="button"
                  className={styles.itemBtn}
                  onClick={() => onCancelItem(it.key)}
                  title="Cancelar este upload"
                  aria-label={`Cancelar ${it.file.name}`}
                >
                  <IconX size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.itemBtn}
                  onClick={() => onDismissItem(it.key)}
                  title="Remover da lista"
                  aria-label={`Remover ${it.file.name} da lista`}
                >
                  <IconX size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
