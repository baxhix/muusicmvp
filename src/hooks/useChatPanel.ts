'use client';

import { useState, useCallback } from 'react';
import type { ChatUser } from '@/types';

interface UseChatPanelReturn {
  activeUser: ChatUser | null;
  isOpen: boolean;
  openChat: (user: ChatUser) => void;
  closeChat: () => void;
  toggleChat: (user: ChatUser) => void;
}

export function useChatPanel(): UseChatPanelReturn {
  const [activeUser, setActiveUser] = useState<ChatUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openChat = useCallback((user: ChatUser) => {
    setActiveUser(user);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    // Delay clearing user so close animation completes
    setTimeout(() => setActiveUser(null), 300);
  }, []);

  const toggleChat = useCallback(
    (user: ChatUser) => {
      if (isOpen && activeUser?.id === user.id) {
        closeChat();
      } else {
        openChat(user);
      }
    },
    [isOpen, activeUser, openChat, closeChat],
  );

  return { activeUser, isOpen, openChat, closeChat, toggleChat };
}
