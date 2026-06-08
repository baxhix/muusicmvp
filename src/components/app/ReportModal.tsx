'use client';

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import MotionStateButton from './MotionStateButton';
import styles from './ReportModal.module.css';

interface Props {
  open: boolean;
  /** UUID of the user being reported. Required by the API. */
  targetUserId: string;
  /** Display name of the target — drives the modal title. */
  targetName: string | null;
  /** Surface the report was filed from. Default 'chat_user'. */
  source?: string;
  onClose: () => void;
  /** Fires after a successful POST with the new report id. */
  onSubmitted?: (reportId: string) => void;
}

/**
 * Modal for filing a user report. Three inputs:
 *
 *   - Optional free-text description (small textarea).
 *   - Optional evidence image — re-uses the same upload pattern as
 *     EditProfileModal: hidden <input type=file>, click button to
 *     pick, immediate preview of the chosen file.
 *   - Submit button → POST /api/reports as multipart.
 *
 * Closes on Escape + on backdrop click. Resets state on every open
 * so a previous report's leftover text doesn't bleed in.
 */
export default function ReportModal({
  open,
  targetUserId,
  targetName,
  source = 'chat_user',
  onClose,
  onSubmitted,
}: Props) {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset everything whenever the modal opens. Previous-session state
  // sticking around would confuse the next reporter.
  useEffect(() => {
    if (!open) return;
    setDescription('');
    setFile(null);
    setPreviewUrl(null);
    setBusy(false);
    setError(null);
    setDone(false);
  }, [open]);

  // Revoke object URLs when they become stale so we don't leak
  // memory across multiple file picks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Escape closes, but not while a submission is in flight (the user
  // might tap it accidentally and lose their text).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const onPickImage = () => fileInputRef.current?.click();

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!picked) return;

    // Quick client-side guards mirror the server limits in
    // src/server/reports/storage.ts.
    if (picked.size > 4 * 1024 * 1024) {
      setError('Imagem muito grande (máx 4 MB).');
      return;
    }
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(picked.type)) {
      setError('Formato não suportado. Use JPG, PNG, WebP ou GIF.');
      return;
    }

    setError(null);
    setFile(picked);
    setPreviewUrl((cur) => {
      if (cur) URL.revokeObjectURL(cur);
      return URL.createObjectURL(picked);
    });
  }, []);

  const onRemoveImage = () => {
    setFile(null);
    setPreviewUrl((cur) => {
      if (cur) URL.revokeObjectURL(cur);
      return null;
    });
  };

  const onSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('targetUserId', targetUserId);
      form.append('source', source);
      if (description.trim()) form.append('description', description.trim());
      if (file) form.append('file', file);

      const res = await fetch('/api/reports', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const code = data.error ?? 'submit_failed';
        setError(
          code === 'unknown_target'
            ? 'Esse contato não pode ser denunciado.'
            : code === 'self_report'
              ? 'Você não pode denunciar a própria conta.'
              : code === 'description_too_long'
                ? 'Texto muito longo (máx 2000 caracteres).'
                : 'Não foi possível enviar a denúncia. Tente de novo.',
        );
        return;
      }
      const data = (await res.json()) as { id: string };
      onSubmitted?.(data.id);
      setDone(true);
    } catch (err) {
      console.error('report submit failed:', err);
      setError('Falha de conexão. Tenta de novo em instantes.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reportModalTitle"
    >
      <div className={styles.modal}>
        {done ? (
          <div className={styles.donePane}>
            <div className={styles.doneIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <circle cx="12" cy="12" r="11" fill="rgba(61, 219, 116, 0.18)" />
                <path d="M7 12.5l3 3 7-7" stroke="#3ddb74" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className={styles.title}>Denúncia enviada</h2>
            <p className={styles.lead}>
              Obrigado por reportar. Nossa equipe vai analisar e tomar as medidas
              necessárias. Você não precisa fazer mais nada.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <header className={styles.header}>
              <h2 id="reportModalTitle" className={styles.title}>
                Denunciar {targetName ?? 'usuário'}
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Fechar"
                disabled={busy}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <p className={styles.lead}>
              Use essa denúncia para reportar mensagens ofensivas, conteúdo
              inadequado ou comportamento abusivo. A equipe da muusic analisa
              tudo manualmente. Anexe uma imagem só se tiver uma evidência
              clara — captura de tela, foto da conversa, etc.
            </p>

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <label className={styles.fieldLabel}>
              O que aconteceu? <span className={styles.optional}>(opcional)</span>
              <textarea
                className={styles.textarea}
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva brevemente o motivo da denúncia…"
                disabled={busy}
              />
            </label>

            <div className={styles.imageRow}>
              <span className={styles.fieldLabel} style={{ marginBottom: 0 }}>
                Anexar imagem <span className={styles.optional}>(opcional)</span>
              </span>

              {previewUrl ? (
                <div className={styles.imagePreviewWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Pré-visualização do anexo"
                    className={styles.imagePreview}
                  />
                  <button
                    type="button"
                    className={styles.imageRemoveBtn}
                    onClick={onRemoveImage}
                    aria-label="Remover imagem"
                    disabled={busy}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.imagePickBtn}
                  onClick={onPickImage}
                  disabled={busy}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="10" rx="1.5" />
                    <circle cx="6" cy="7" r="1.2" />
                    <path d="M2 12l3.5-3.5L8 11l3-3 3 3" />
                  </svg>
                  Escolher imagem
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onClose}
                disabled={busy}
              >
                Cancelar
              </button>
              {/* Multi-state badge button: idle "Enviar denúncia"
               *  → pending spinner "Enviando..." → success "Enviado ✓"
               *  → fica sticky até o modal fechar via onSubmitted. */}
              <MotionStateButton
                tone="danger"
                idleLabel="Enviar denúncia"
                pendingLabel="Enviando…"
                successLabel="Enviado"
                stickySuccess
                onClick={onSubmit}
                disabled={busy}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
