'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full ${width} rounded-2xl shadow-2xl flex flex-col`}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              maxHeight: '90vh',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
