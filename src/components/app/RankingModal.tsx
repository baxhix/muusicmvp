'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRanking } from '@/hooks/useRanking';
import type { ApiRankingRow } from '@/lib/api/types';
import styles from './RankingModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

function displayName(r: ApiRankingRow): string {
  return r.name?.trim() || r.email.split('@')[0];
}

function avatarSrc(r: ApiRankingRow): string {
  return r.avatarUrl ?? `https://i.pravatar.cc/72?u=${r.userId}`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

function describeError(code: string): string {
  if (code === 'migration_missing') {
    return 'Tabela user_activities ausente no banco. Aplique a migration 0003 na VPS.';
  }
  if (code === 'network_error') return 'Falha de conexão. Verifique sua internet.';
  if (code === 'query_failed') return 'Erro ao consultar o ranking no servidor.';
  if (code === 'unauthorized') return 'Sessão expirada. Faça login novamente.';
  return `Erro ao carregar ranking (${code}).`;
}

export default function RankingModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { ranking, loading, error, refresh } = useRanking(open);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ranking de fãs"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <h2 className={styles.title}>Ranking</h2>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={refresh}
              disabled={loading}
              aria-label="Atualizar ranking"
              title="Atualizar"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h6M2 5V2M14 11H8M14 11v3" />
                <path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Fechar"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <p className={styles.scoring}>
          <strong>+100</strong> por música tocada · <strong>+200</strong> por
          conversa nova · <strong>+50</strong> por login
        </p>

        <div className={styles.list}>
          {loading && ranking.length === 0 ? (
            <div className={styles.empty}>Carregando ranking…</div>
          ) : error ? (
            <div className={`${styles.empty} ${styles.errorEmpty}`}>
              {describeError(error)}
            </div>
          ) : ranking.length === 0 ? (
            <div className={styles.empty}>Sem dados ainda. Toca uma música pra começar.</div>
          ) : (
            ranking.map((r, idx) => {
              const isMe = r.userId === user?.id;
              const place = idx + 1;
              return (
                <div
                  key={r.userId}
                  className={`${styles.row} ${isMe ? styles.rowMe : ''}`}
                >
                  <span
                    className={`${styles.place} ${place <= 3 ? styles[`place${place}`] : ''}`}
                  >
                    {place}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={r.avatarUrl ?? r.userId}
                    src={avatarSrc(r)}
                    alt={displayName(r)}
                    className={styles.avatar}
                  />
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{displayName(r)}</span>
                      {isMe && <span className={styles.youBadge}>Você</span>}
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.streams}>
                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M10 1v9" /><path d="M6 3v9" />
                          <circle cx="4.5" cy="12" r="1.5" />
                          <circle cx="8.5" cy="10" r="1.5" />
                        </svg>
                        {formatNumber(r.streams)} streams
                      </span>
                      {r.city && <span className={styles.city}>{r.city}</span>}
                    </div>
                  </div>
                  <div className={styles.points}>
                    <span className={styles.pointsValue}>{formatNumber(r.points)}</span>
                    <span className={styles.pointsLabel}>pts</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
