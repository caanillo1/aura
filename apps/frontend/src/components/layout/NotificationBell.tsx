'use client';
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, Loader2, Info, AlertTriangle, MessageSquare, FileText, Ticket, FolderKanban, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/hooks/useNotifications';

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  nota:           { icon: MessageSquare, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  acta:           { icon: FileText,      color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  ticket:         { icon: Ticket,        color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  proyecto:       { icon: FolderKanban,  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  orden_servicio: { icon: ClipboardCheck,color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  alerta:         { icon: AlertTriangle, color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  default:        { icon: Info,          color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function NotifItem({ n, onRead, onRemove }: { n: AppNotification; onRead: (id: string) => void; onRemove: (id: string) => void }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.default;
  const Icon = meta.icon;
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 group relative"
      style={{ background: n.isRead ? 'transparent' : 'rgba(167,139,250,0.04)', borderBottom: '1px solid var(--border-subtle)' }}
      onClick={() => { if (!n.isRead) onRead(n.id); }}
    >
      {!n.isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: '#a78bfa' }} />
      )}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: meta.bg }}>
        <Icon className="w-4 h-4" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
        {n.message && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
        )}
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{timeAgo(n.createdAt)}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove(n.id); }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
        style={{ color: 'var(--text-muted)' }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unread, loading, markRead, markAllRead, remove } = useNotifications();

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors relative"
        style={{ color: open ? '#a78bfa' : 'var(--text-secondary)', background: open ? 'rgba(167,139,250,0.10)' : 'transparent' }}
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: '#ef4444' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Portal: escapa del overflow:hidden del layout. AnimatePresence va DENTRO del portal. */}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
          <motion.div
            key="notif-panel"
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="w-80 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              position: 'fixed',
              top: dropPos.top,
              right: dropPos.right,
              zIndex: 9999,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: '#a78bfa' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notificaciones</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color: '#a78bfa' }}
                  title="Marcar todas como leídas">
                  <CheckCheck className="w-3.5 h-3.5" /> Todas leídas
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <Bell className="w-8 h-8" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin notificaciones</p>
                </div>
              ) : (
                notifications.map(n => (
                  <NotifItem key={n.id} n={n} onRead={markRead} onRemove={remove} />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {notifications.length} notificación{notifications.length !== 1 ? 'es' : ''}
                </span>
              </div>
            )}
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
