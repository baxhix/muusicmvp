'use client';

import { useEffect, useState } from 'react';
import styles from './NotificationPreferencesModal.module.css';

/**
 * Modal de preferências de notificação (perfil próprio).
 *
 * Hoje o usuário só pode controlar o canal email de chat — as
 * demais notificações (boas-vindas, magic link, etc) são definidas
 * pela plataforma como padrão obrigatório.
 *
 * Quando o master toggle está LIGADO, o usuário escolhe entre:
 *   - `all`     → recebe email pra TODA DM
 *   - `offline` → recebe email só quando o destinatário (ele
 *                 próprio) está sem socket ativo no momento
 *
 * Persistência: localStorage. Quando o backend tiver
 * `user_notification_prefs` table, troca por API call sem
 * mudar a UX.
 */

const KEY_ENABLED = 'chat_email_notifications:enabled';
const KEY_MODE = 'chat_email_notifications:mode';

export type ChatEmailMode = 'all' | 'offline';

export interface ChatEmailPrefs {
  enabled: boolean;
  mode: ChatEmailMode;
}

/* Defaults sensatos: ligado, e só quando offline (cobre o caso de
 * "quero saber das DMs que perdi" sem ser spam pra quem fica no
 * app). O cron do servidor ainda manda PRA TODO MUNDO; quando o
 * backend integrar essa pref, vai respeitar. */
const DEFAULTS: ChatEmailPrefs = { enabled: true, mode: 'offline' };

export function loadChatEmailPrefs(): ChatEmailPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const enabledRaw = window.localStorage.getItem(KEY_ENABLED);
    const modeRaw = window.localStorage.getItem(KEY_MODE);
    return {
      enabled: enabledRaw === null ? DEFAULTS.enabled : enabledRaw === 'true',
      mode: modeRaw === 'all' || modeRaw === 'offline' ? modeRaw : DEFAULTS.mode,
    };
  } catch {
    return DEFAULTS;
  }
}

function saveChatEmailPrefs(prefs: ChatEmailPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_ENABLED, String(prefs.enabled));
    window.localStorage.setItem(KEY_MODE, prefs.mode);
  } catch {
    /* localStorage indisponível (private mode estrito, quota
     * cheia) — preferência fica só em memória nesta sessão. */
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPreferencesModal({ open, onClose }: Props) {
  const [prefs, setPrefs] = useState<ChatEmailPrefs>(DEFAULTS);

  /* Carrega do localStorage sempre que abrir — pega mudanças
   * de outra aba/sessão sem ter que sincronizar manualmente. */
  useEffect(() => {
    if (!open) return;
    setPrefs(loadChatEmailPrefs());
  }, [open]);

  /* Auto-save: cada mudança persiste imediatamente. Padrão UX de
   * preferências (vs save explícito) — feedback é instantâneo,
   * usuário não precisa lembrar de salvar. */
  useEffect(() => {
    if (!open) return;
    saveChatEmailPrefs(prefs);
  }, [prefs, open]);

  /* Esc fecha. Trava o scroll do body enquanto aberto pra evitar
   * que o conteúdo embaixo se mexa em iOS. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="np-title" className={styles.title}>
            Notificações
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {/* ── Toggle master ─────────────────────────────── */}
          <label className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>
                Notificações de chat por email
              </span>
              <span className={styles.rowDesc}>
                Receber email quando alguém te mandar mensagem direta.
              </span>
            </div>
            <span className={styles.toggle}>
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, enabled: e.target.checked }))
                }
                aria-label="Ativar notificações de chat por email"
              />
              <span className={styles.toggleTrack} aria-hidden="true">
                <span className={styles.toggleThumb} />
              </span>
            </span>
          </label>

          {/* ── Sub-opções (visíveis só se master on) ────── */}
          {prefs.enabled && (
            <div className={styles.subSection}>
              <div className={styles.subLabel}>Quando receber</div>
              <label
                className={styles.radioRow}
                data-active={prefs.mode === 'all'}
              >
                <input
                  type="radio"
                  name="chat-email-mode"
                  value="all"
                  checked={prefs.mode === 'all'}
                  onChange={() => setPrefs((p) => ({ ...p, mode: 'all' }))}
                />
                <div className={styles.radioText}>
                  <span className={styles.radioName}>
                    Todas as mensagens
                  </span>
                  <span className={styles.radioDesc}>
                    Recebo email a cada DM nova, esteja online ou não.
                  </span>
                </div>
              </label>
              <label
                className={styles.radioRow}
                data-active={prefs.mode === 'offline'}
              >
                <input
                  type="radio"
                  name="chat-email-mode"
                  value="offline"
                  checked={prefs.mode === 'offline'}
                  onChange={() =>
                    setPrefs((p) => ({ ...p, mode: 'offline' }))
                  }
                />
                <div className={styles.radioText}>
                  <span className={styles.radioName}>
                    Só quando eu estiver offline
                  </span>
                  <span className={styles.radioDesc}>
                    Email só quando eu não estiver com o app aberto —
                    cobre o que perdi sem encher a caixa de entrada.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* ── Disclaimer sobre as demais ─────────────────── */}
          <div className={styles.disclaimer}>
            <span className={styles.disclaimerIcon} aria-hidden="true">
              ⓘ
            </span>
            <p>
              As demais notificações do Fanverse (boas-vindas, acesso,
              avisos da artista) são padrão da plataforma e não podem
              ser ajustadas individualmente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
