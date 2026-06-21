'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export function useNotifications() {
  const { accessToken: token } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await notificationsApi.list(40);
      setNotifications(data.items);
      setUnread(data.unread);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    load();

    // WebSocket connection
    const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';
    const socket = io(`${WS_URL}/ws`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('notification:new', (raw: unknown) => {
      // 1. Actualización optimista instantánea — no espera a la API
      setUnread(prev => prev + 1);
      const n = raw as Partial<AppNotification>;

      // Toast en tiempo real para respuestas de visita del cliente
      if (n?.type === 'visita_confirmada') {
        toast.success(n.title ?? 'Visita confirmada', {
          description: n.message ?? undefined,
          duration: 8000,
        });
      } else if (n?.type === 'visita_cancelada') {
        toast.error(n.title ?? 'Visita cancelada', {
          description: n.message ?? undefined,
          duration: 8000,
        });
      }

      if (n?.id && n?.type && n?.title) {
        setNotifications(prev => [{
          id:         n.id!,
          type:       n.type!,
          title:      n.title!,
          message:    n.message    ?? null,
          entityType: n.entityType ?? null,
          entityId:   n.entityId   ?? null,
          isRead:     false,
          readAt:     null,
          // createdAt puede llegar como Date serializado; normalizar siempre a string ISO
          createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString(),
        }, ...prev].slice(0, 40));
      }

      // 2. Sincronización en segundo plano con backoff exponencial
      const syncWithRetry = (attempt = 1) => {
        notificationsApi.list(40)
          .then(data => { setNotifications(data.items); setUnread(data.unread); })
          .catch(() => {
            if (attempt < 4) setTimeout(() => syncWithRetry(attempt + 1), 1000 * 2 ** (attempt - 1));
          });
      };
      syncWithRetry();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token, load]);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnread(0);
  }, []);

  const remove = useCallback(async (id: string) => {
    const wasUnread = notifications.find(n => n.id === id)?.isRead === false;
    await notificationsApi.remove(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnread(prev => Math.max(0, prev - 1));
  }, [notifications]);

  return { notifications, unread, loading, markRead, markAllRead, remove, reload: load };
}
