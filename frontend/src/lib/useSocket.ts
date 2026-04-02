import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { API_URL } from './api';

let socketInstance: Socket | null = null;

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socketInstance?.connected || false);
  const [socket, setSocket] = useState<Socket | null>(socketInstance);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    if (!token) return;

    if (!socketInstance) {
      socketInstance = io(API_URL, {
        auth: { token },
        transports: ['websocket', 'polling'], // Fallback to polling if websocket is strict
      });
      setSocket(socketInstance);
      
      socketInstance.on('connect', () => {
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });
    } else {
      setSocket(socketInstance);
      setIsConnected(socketInstance.connected);
      
      // Still need to re-register these in case the component wants the state changes
      const onConnect = () => setIsConnected(true);
      const onDisconnect = () => setIsConnected(false);
      
      socketInstance.on('connect', onConnect);
      socketInstance.on('disconnect', onDisconnect);
      
      return () => {
        socketInstance?.off('connect', onConnect);
        socketInstance?.off('disconnect', onDisconnect);
      };
    }
  }, [token]);

  return { socket, isConnected };
};
