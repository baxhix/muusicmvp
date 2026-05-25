'use client';

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import styles from './ChatPanel.module.css';
import type { ChatUser, ChatMessage } from '@/types';

/** Auto-resize do textarea: cresce com o conteúdo até MAX_TEXTAREA_PX,
 *  depois aparece scroll. Reseta pra altura natural antes de medir
 *  scrollHeight (senão fica preso na altura máxima anterior). */
const MAX_TEXTAREA_PX = 120;
function autoResize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
}

interface ChatPanelProps {
  user: ChatUser | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatNow(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export default function ChatPanel({ user, isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When user changes, load their messages
  useEffect(() => {
    if (user) {
      setMessages([...user.messages]);
      setShowTyping(false);
    }
  }, [user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  const sendMessage = useCallback(() => {
    const text = inputVal.trim();
    if (!text || !user) return;
    setInputVal('');
    /* Reseta altura do textarea — sem isso, depois de mandar uma
     * mensagem multi-linha o campo fica esticado mesmo vazio. */
    requestAnimationFrame(() => autoResize(inputRef.current));

    const newMsg: ChatMessage = { dir: 'out', text, time: formatNow() };
    setMessages((prev) => {
      // Remove existing typing indicator if any
      const filtered = prev.filter((m) => m.dir !== 'typing');
      return [...filtered, newMsg];
    });

    // Simulate typing response for online users
    if (user.online) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setShowTyping(true);
      typingTimerRef.current = setTimeout(() => {
        setShowTyping(false);
      }, 2500);
    }
  }, [inputVal, user]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    autoResize(e.currentTarget);
  }, []);

  /* Enter = enviar; Shift+Enter = quebra de linha (deixa o textarea
   * inserir o \n nativamente, sem preventDefault). Em mobile, o
   * teclado não tem Shift então só o botão de send funciona — OK
   * (a entrada multi-linha vem de paste). */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // Determine if the user's messages array has a typing bubble
  const baseMessages = messages.filter((m) => m.dir !== 'typing');
  const hasTypingInOriginal = user?.messages.some((m) => m.dir === 'typing') ?? false;

  return (
    <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`} role="dialog" aria-label={`Chat com ${user?.name ?? ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.hdrAvatar} style={{ background: user?.bg ?? '' }}>
          {user?.initials}
        </div>
        <div className={styles.hdrInfo}>
          <div className={styles.hdrName}>{user?.name ?? '—'}</div>
          <div className={styles.hdrStatus}>
            {user?.online ? (
              <>
                <span className={styles.hdrDot} aria-hidden="true" />
                <span className={styles.hdrStatusOnline}>Online agora</span>
              </>
            ) : (
              <span>{user?.statusText}</span>
            )}
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar chat">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {baseMessages.map((msg, i) => {
          if (msg.dir === 'typing') return null;
          return (
            <div
              key={i}
              className={`${styles.msg} ${msg.dir === 'in' ? styles.msgIn : styles.msgOut}`}
              style={{ animationDelay: `${i * 0.045}s` }}
            >
              {msg.song ? (
                <div className={styles.songCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={msg.song.img} alt={msg.song.title} />
                  <div className={styles.songInfo}>
                    <div className={styles.songTitle}>{msg.song.title}</div>
                    <div className={styles.songArtist}>{msg.song.artist}</div>
                  </div>
                  <span className={styles.songIcon}>▶</span>
                </div>
              ) : (
                <div className={styles.bubble}>{msg.text}</div>
              )}
              {msg.time && <div className={styles.time}>{msg.time}</div>}
            </div>
          );
        })}

        {/* Typing indicator — from original data or simulated */}
        {(hasTypingInOriginal || showTyping) && (
          <div className={styles.typing}>
            <span /><span /><span />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — textarea com auto-grow + shift+enter pra quebra
          de linha (Enter sozinho envia). */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.field}
          placeholder="Mensagem…"
          autoComplete="off"
          value={inputVal}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className={styles.sendBtn} onClick={sendMessage} aria-label="Enviar">
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M1.5 7.5L12.5 2.5 8.5 12.5 7 8 1.5 7.5z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
