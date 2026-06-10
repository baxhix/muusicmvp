'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type {
  ApiConversationSummary,
  ApiOnlineUser,
  ApiSearchUser,
} from '@/lib/api/types';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import styles from './UserPicker.module.css';

/**
 * Two modes share this picker:
 *
 *   - 'single' (default): pick one user, calls onPick(userId) and
 *     closes immediately. Used for "start a DM" flows.
 *
 *   - 'group': pick N users + name the group, then calls
 *     onCreateGroup({ name, memberIds }). Used for the "Novo grupo"
 *     flow from the ConversationsSidebar. The modal grows a name
 *     input above the search + a footer with the count + "Criar
 *     grupo" CTA.
 *
 * Both modes reuse the same search/online-list code; the only
 * delta is the per-row affordance (button vs checkbox) and the
 * footer action.
 */
interface SingleProps {
  open: boolean;
  onClose: () => void;
  mode?: 'single';
  onPick: (userId: string) => void;
  /** Conversas recentes do usuário — quando passado, em modo
   *  single elas continuam não sendo usadas (o default fica
   *  sendo o online list). Em modo group, são a fonte default
   *  da lista (DM partners ordenados por última mensagem). */
  recentConversations?: ApiConversationSummary[];
  /** Quando `true`, renderiza embedded (sem backdrop nem fixed
   *  position) — usado pra exibir o picker como subview dentro
   *  de outro painel (ex: ConversationsSidebar). Default = false
   *  (modal overlay tradicional). */
  inline?: boolean;
}
interface GroupProps {
  open: boolean;
  onClose: () => void;
  mode: 'group';
  onCreateGroup: (args: { name: string; memberIds: string[] }) => void;
  recentConversations?: ApiConversationSummary[];
  inline?: boolean;
}
type Props = SingleProps | GroupProps;

const SEARCH_DEBOUNCE_MS = 250;

export default function UserPicker(props: Props) {
  const { open, onClose } = props;
  const isGroupMode = props.mode === 'group';

  const { users: liveUsers } = useLiveUsers();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group-mode-only state — kept here so reopening the picker
  // doesn't drag the previous group's draft around.
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset everything on each open. Stale name + selections from a
  // previous session would confuse the next group creator.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSearchResults(null);
      setSearching(false);
      setGroupName('');
      setSelectedIds([]);
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [open]);

  // Debounced server-side search; falls back to online list when query empty
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ users: ApiSearchUser[] }>(
          `/api/users/search?q=${encodeURIComponent(q)}`,
        );
        setSearchResults(res.users);
      } catch (err) {
        console.error('search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // List shown:
  //   - Query ativa → results da API search.
  //   - GROUP mode + sem query → DM partners com conversa
  //     ABERTA (em recentConversations), ordenados pela última
  //     mensagem desc. Per product feedback "liste abaixo os
  //     usuários em ordem de que já tive conversas abertas".
  //   - SINGLE mode + sem query → usuários online (comportamento
  //     legado, não-impactado).
  type Item = {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    subtitle: string;
  };

  const items: Item[] = useMemo(() => {
    if (searchResults !== null) {
      return searchResults.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        // Antes mostrava o email cru (vazamento de PII). Agora a cidade
        // aproximada — só presente pra quem consentiu compartilhar
        // localização; vazia caso contrário (LGPD).
        subtitle: u.city ?? '',
      }));
    }
    if (isGroupMode && props.recentConversations) {
      /* Pega DM partners das conversas recentes, deduplica por
       * userId (segurança contra eventuais conversas duplicadas
       * do MESMO par), ordena por createdAt da última mensagem
       * desc (fallback: createdAt da conversa). Fora a lista
       * vai mostrar quem TEM histórico, não quem tá online.
       *
       * Subtitle vazia em group mode per product feedback "não
       * mostre a última conversa com o usuário" — o picker é
       * pra selecionar pessoas, não revisar histórico. O nome
       * sozinho lê melhor sem o snippet competindo por atenção. */
      const seen = new Set<string>();
      const dmRows = props.recentConversations
        .filter((c) => c.type === 'dm' && !!c.otherUser)
        .sort((a, b) => {
          const ta = a.lastMessage?.createdAt ?? a.createdAt;
          const tb = b.lastMessage?.createdAt ?? b.createdAt;
          return tb.localeCompare(ta);
        });
      const out: Item[] = [];
      for (const c of dmRows) {
        const u = c.otherUser!;
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        out.push({
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          subtitle: '',
        });
      }
      return out;
    }
    return liveUsers.map((u: ApiOnlineUser) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      subtitle: [u.city, u.country].filter(Boolean).join(', ') || 'online',
    }));
  }, [searchResults, liveUsers, isGroupMode, props]);

  const toggleSelect = (id: string) => {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const handleCreate = () => {
    if (!isGroupMode || submitting) return;
    if (selectedIds.length === 0) return;
    /* Nome agora é OPCIONAL — quando vazio, o servidor (createGroup)
     * preenche "Grupo sem nome" e o usuário pode renomear depois
     * via GroupMembersPanel. Per product feedback "ao adicionar
     * pessoas sem ter colocado o nome do grupo, permita que o
     * grupo seja criado com o nome 'Grupo sem nome' e depois o
     * usuário edita". */
    const trimmed = groupName.trim();
    setSubmitting(true);
    (props as GroupProps).onCreateGroup({
      name: trimmed,
      memberIds: selectedIds,
    });
  };

  if (!open) return null;

  const title = isGroupMode ? 'Novo grupo' : 'Iniciar conversa';
  // CTA habilitada com APENAS membros selecionados — o nome é
  // opcional (default "Grupo sem nome" servidor-side).
  const canCreate = isGroupMode && selectedIds.length > 0;
  const inline = !!props.inline;

  /* Modo INLINE renderiza só o conteúdo (header + search + list +
   * footer) — sem backdrop nem .modal envelope. O parent
   * (ex: ConversationsSidebar) controla o container. */
  const content = (
    <>
        <div className={`${styles.header} ${inline ? styles.headerInline : ''}`}>
          {inline ? (
            <button
              type="button"
              className={styles.backBtn}
              onClick={onClose}
              aria-label="Voltar"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 3 5 8l5 5" />
              </svg>
            </button>
          ) : null}
          <span className={styles.title}>{title}</span>
          {!inline && (
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {isGroupMode && (
          <div className={styles.nameRow}>
            <input
              className={styles.nameField}
              placeholder="Nome do grupo"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={80}
              disabled={submitting}
            />
          </div>
        )}

        <div className={styles.searchRow}>
          {/* Magnifier glyph aligned with the chat search icon —
              same viewBox / stroke width / circle + handle paths
              so the two fields look identical. */}
          <svg
            className={styles.searchIcon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M14 14l-3-3" />
          </svg>
          <input
            ref={inputRef}
            className={styles.searchField}
            placeholder={
              isGroupMode
                ? 'Buscar membros por nome ou email…'
                : 'Buscar por nome ou email…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className={styles.list}>
          {searching ? (
            <div className={styles.empty}>Buscando…</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              {searchResults !== null
                ? 'Nenhum usuário encontrado'
                : isGroupMode
                  ? 'Você ainda não tem conversas. Digite pra buscar usuários.'
                  : 'Ninguém online no momento'}
            </div>
          ) : (
            items.slice(0, 50).map((u) => {
              const img = u.avatarUrl ?? '/avatar-placeholder.svg';
              const isSelected = selectedIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={u.name ?? ''} className={styles.itemAvatar} />
                  <div className={styles.itemText}>
                    <span className={styles.itemName}>{u.name ?? 'Anônimo'}</span>
                    {u.subtitle && (
                      <span className={styles.itemSub}>{u.subtitle}</span>
                    )}
                  </div>
                  {isGroupMode ? (
                    /* CTA explícito "Adicionar" / "Adicionado"
                     * substitui o checkbox lateral antigo. Per
                     * product feedback "um cta de adicionar os
                     * usuários no grupo" — affordance clara em
                     * vez de toggle implícito no row click. */
                    /* Pill compacto com ícone + label per product
                     * feedback "volte para o botão completo
                     * '+ Adicionar' e não somente o ícone '+'".
                     * Idle: "+ Adicionar" lilás. Selecionado:
                     * "✓ Adicionado" verde. */
                    <button
                      type="button"
                      className={`${styles.addBtn} ${isSelected ? styles.addBtnOn : ''}`}
                      onClick={() => toggleSelect(u.id)}
                      disabled={submitting}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M2 5l2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Adicionado
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          Adicionar
                        </>
                      )}
                    </button>
                  ) : (
                    /* Single mode: row inteira é um button (sem
                     * CTA lateral) — click direto inicia a DM. */
                    <button
                      type="button"
                      className={styles.singlePickBtn}
                      onClick={() => {
                        (props as SingleProps).onPick(u.id);
                        onClose();
                      }}
                      disabled={submitting}
                      aria-label={`Iniciar conversa com ${u.name ?? 'usuário'}`}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {isGroupMode ? (
          <div className={styles.footer}>
            <span className={styles.footerCount}>
              {selectedIds.length === 0
                ? 'Nenhum membro selecionado'
                : `${selectedIds.length} membro${selectedIds.length === 1 ? '' : 's'} selecionado${selectedIds.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={!canCreate || submitting}
            >
              {submitting ? 'Criando…' : 'Criar grupo'}
            </button>
          </div>
        ) : searchResults === null ? (
          <div className={styles.hint}>
            {liveUsers.length > 0
              ? 'Mostrando usuários online — digite pra buscar todos'
              : 'Digite ao menos 2 caracteres pra buscar'}
          </div>
        ) : null}
    </>
  );

  /* Inline render: o parent fornece o container (ex: o
   * `.panel` da ConversationsSidebar). Sem backdrop, sem fixed
   * envelope — só o conteúdo herdando a chrome do host. */
  if (inline) {
    return (
      <div
        className={`${styles.modal} ${styles.modalInline}`}
        role="region"
        aria-label={title}
      >
        {content}
      </div>
    );
  }

  /* Modo overlay padrão: backdrop full-screen + modal centrado. */
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-label={title}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
