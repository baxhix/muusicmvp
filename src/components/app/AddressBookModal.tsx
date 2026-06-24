'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api/client';
import type { ApiUserAddress } from '@/lib/api/types';
import styles from './AddressBookModal.module.css';

/**
 * AddressBookModal — CRUD de endereços de entrega da Loja Fanverse
 * (Meus dados). Onde os produtos resgatados pelo usuário serão enviados.
 *
 * Self-mounting: ouve o evento global `app:open-address-book` (disparado
 * pelo botão "Meus dados" da Loja) e renderiza via portal pra escapar o
 * stacking context do shell do /app. CRUD bate em /api/me/addresses.
 */

type View = { mode: 'list' } | { mode: 'form'; editing: ApiUserAddress | null };

interface FormState {
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  recipient: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  isDefault: false,
};

function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export default function AddressBookModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<ApiUserAddress[]>([]);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ addresses: ApiUserAddress[] }>('/api/me/addresses');
      setAddresses(res.addresses);
    } catch {
      setError('Não consegui carregar seus endereços.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Abre via evento global + carrega a lista.
  useEffect(() => {
    const onOpen = () => {
      setClosing(false);
      setOpen(true);
      setView({ mode: 'list' });
      setError(null);
      setConfirmDelete(null);
      void load();
    };
    window.addEventListener('app:open-address-book', onOpen);
    return () => window.removeEventListener('app:open-address-book', onOpen);
  }, [load]);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  function startCreate() {
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setError(null);
    setView({ mode: 'form', editing: null });
  }

  function startEdit(a: ApiUserAddress) {
    setForm({
      recipient: a.recipient,
      cep: a.cep,
      street: a.street,
      number: a.number,
      complement: a.complement ?? '',
      district: a.district,
      city: a.city,
      state: a.state,
      isDefault: a.isDefault,
    });
    setError(null);
    setView({ mode: 'form', editing: a });
  }

  async function save() {
    // Validação simples dos obrigatórios.
    const required: (keyof FormState)[] = [
      'recipient', 'cep', 'street', 'number', 'district', 'city', 'state',
    ];
    for (const k of required) {
      if (!String(form[k]).trim()) {
        setError('Preencha todos os campos obrigatórios.');
        return;
      }
    }
    if (form.cep.replace(/\D/g, '').length !== 8) {
      setError('CEP inválido.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      recipient: form.recipient.trim(),
      cep: form.cep.trim(),
      street: form.street.trim(),
      number: form.number.trim(),
      complement: form.complement.trim() || null,
      district: form.district.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      isDefault: form.isDefault,
    };
    try {
      if (view.mode === 'form' && view.editing) {
        await api.patch(`/api/me/addresses/${view.editing.id}`, payload);
      } else {
        await api.post('/api/me/addresses', payload);
      }
      await load();
      setView({ mode: 'list' });
    } catch {
      setError('Não consegui salvar. Tenta de novo.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/me/addresses/${id}`);
      setConfirmDelete(null);
      await load();
    } catch {
      setError('Não consegui remover.');
    }
  }

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const content = (
    <>
      <div
        className={`${styles.backdrop} ${closing ? styles.backdropOut : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${closing ? styles.panelOut : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Meus endereços"
      >
        <header className={styles.header}>
          {view.mode === 'form' ? (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setView({ mode: 'list' })}
              aria-label="Voltar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          ) : (
            <span className={styles.headerSpacer} aria-hidden="true" />
          )}
          <h2 className={styles.title}>
            {view.mode === 'form'
              ? view.editing ? 'Editar endereço' : 'Novo endereço'
              : 'Meus endereços'}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {view.mode === 'list' ? (
            <>
              <p className={styles.intro}>
                Onde enviaremos os produtos que você resgatar na Loja.
              </p>

              {loading ? (
                <p className={styles.muted}>Carregando…</p>
              ) : addresses.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.muted}>Você ainda não tem endereços cadastrados.</p>
                </div>
              ) : (
                <ul className={styles.list}>
                  {addresses.map((a) => (
                    <li key={a.id} className={styles.card}>
                      <div className={styles.cardMain}>
                        <div className={styles.cardTopline}>
                          <span className={styles.recipient}>{a.recipient}</span>
                          {a.isDefault && <span className={styles.defaultBadge}>Padrão</span>}
                        </div>
                        <span className={styles.addrLine}>
                          {a.street}, {a.number}
                          {a.complement ? ` — ${a.complement}` : ''}
                        </span>
                        <span className={styles.addrLine}>
                          {a.district} · {a.city}/{a.state} · {a.cep}
                        </span>
                      </div>
                      <div className={styles.cardActions}>
                        <button type="button" className={styles.iconBtn} onClick={() => startEdit(a)} aria-label="Editar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {confirmDelete === a.id ? (
                          <button type="button" className={styles.confirmDel} onClick={() => remove(a.id)}>
                            Confirmar
                          </button>
                        ) : (
                          <button type="button" className={styles.iconBtn} onClick={() => setConfirmDelete(a.id)} aria-label="Remover">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {error && <div className={styles.errorBox}>{error}</div>}

              <button type="button" className={styles.addBtn} onClick={startCreate}>
                + Adicionar endereço
              </button>
            </>
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => { e.preventDefault(); void save(); }}
            >
              <Field label="Destinatário">
                <input className={styles.input} value={form.recipient} maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
                  placeholder="Quem recebe" />
              </Field>
              <div className={styles.row}>
                <Field label="CEP" grow={0}>
                  <input className={styles.input} value={form.cep} inputMode="numeric"
                    onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
                    placeholder="00000-000" />
                </Field>
                <Field label="UF" grow={0}>
                  <input className={`${styles.input} ${styles.ufInput}`} value={form.state} maxLength={2}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                    placeholder="UF" />
                </Field>
              </div>
              <Field label="Cidade">
                <input className={styles.input} value={form.city} maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
              </Field>
              <Field label="Bairro">
                <input className={styles.input} value={form.district} maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} placeholder="Bairro" />
              </Field>
              <div className={styles.row}>
                <Field label="Logradouro">
                  <input className={styles.input} value={form.street} maxLength={200}
                    onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} placeholder="Rua / Av." />
                </Field>
                <Field label="Número" grow={0}>
                  <input className={`${styles.input} ${styles.numInput}`} value={form.number} maxLength={20}
                    onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder="Nº" />
                </Field>
              </div>
              <Field label="Complemento (opcional)">
                <input className={styles.input} value={form.complement} maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))} placeholder="Apto, bloco…" />
              </Field>

              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                <span>Usar como endereço padrão</span>
              </label>

              {error && <div className={styles.errorBox}>{error}</div>}

              <button type="submit" className={styles.saveBtn} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar endereço'}
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );

  return createPortal(content, document.body);
}

function Field({ label, children, grow = 1 }: { label: string; children: React.ReactNode; grow?: number }) {
  return (
    <label className={styles.field} style={grow === 0 ? { flex: '0 0 auto' } : undefined}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
