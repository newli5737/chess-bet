import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { SOCKET_URL, SOCKET_PATH } from './api';

let socketInstance: Socket | null = null;

export const getSocket = () => socketInstance;

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socketInstance?.connected || false);
  const [socket, setSocket] = useState<Socket | null>(socketInstance);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (!user) {
      // When user logs out, disconnect socket
      if (socketInstance) {
        disconnectSocket();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        path: SOCKET_PATH,
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });
    }

    setSocket(socketInstance);
    setIsConnected(socketInstance.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    return () => {
      socketInstance?.off('connect', onConnect);
      socketInstance?.off('disconnect', onDisconnect);
    };
  }, [user]);

  return { socket, isConnected };
};
