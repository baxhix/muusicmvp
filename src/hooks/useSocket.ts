'use client';

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSocket, disconnectSocket } from '@/lib/socket/client';

/**
 * Returns the live socket — connected only when the user is logged in.
 * Disconnects on logout. The socket is a singleton across the app.
 */
export function useSocket(): { socket: Socket | null; connected: boolean } {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      // Logged-out: kill any existing connection.
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = getSocket();
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [user]);

  return { socket, connected };
}
