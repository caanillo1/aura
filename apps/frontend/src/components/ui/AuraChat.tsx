'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { MessageCircle, X, Send, Sparkles, Loader2, ChevronDown } from 'lucide-react';
import { chatApi } from '@/lib/api';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '¿Qué muestran los gráficos del dashboard?',
  '¿Cuántas actividades están vencidas?',
  '¿Cuál es el avance por cliente?',
  '¿Qué tickets están priorizados?',
];

export function AuraChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const { respuesta } = await chatApi.sendMessage({
        mensaje: trimmed,
        historial: messages,
        contexto: { pagina: pathname ?? '' },
      });
      setMessages(prev => [...prev, { role: 'assistant', content: respuesta }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Ocurrió un error al procesar tu pregunta. Intenta nuevamente.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, pathname]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const panelBg = isLight
    ? 'rgba(255,255,255,0.98)'
    : 'rgba(8,17,32,0.97)';
  const borderColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)';
  const inputBg = isLight ? 'rgba(241,245,249,0.9)' : 'rgba(2,6,23,0.7)';
  const userBubbleBg = 'rgba(124,58,237,0.85)';
  const aiBubbleBg = isLight ? 'rgba(241,245,249,1)' : 'rgba(15,23,42,0.9)';

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(p => !p)}
        className="fixed bottom-10 right-6 z-50 flex items-center justify-center rounded-full shadow-2xl"
        style={{
          width: 52,
          height: 52,
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          boxShadow: '0 0 24px rgba(124,58,237,0.5)',
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="AURA IA"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5 text-white" />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles className="w-5 h-5 text-white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-[74px] right-6 z-50 flex flex-col"
            style={{
              width: 380,
              height: 520,
              background: panelBg,
              border: `1px solid ${borderColor}`,
              borderRadius: 20,
              boxShadow: isLight
                ? '0 20px 60px rgba(0,0,0,0.14)'
                : '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)',
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 shrink-0"
              style={{
                height: 52,
                borderBottom: `1px solid ${borderColor}`,
                background: 'linear-gradient(90deg, rgba(124,58,237,0.12) 0%, transparent 100%)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none" style={{ color: isLight ? '#0f172a' : '#f1f5f9' }}>
                    AURA IA
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Asistente inteligente
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="text-[10px] px-2 py-1 rounded-md transition-colors hover:opacity-70"
                    style={{ color: 'var(--text-muted)', border: `1px solid ${borderColor}` }}
                  >
                    Limpiar
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="opacity-50 hover:opacity-90 transition-opacity"
                  style={{ color: isLight ? '#0f172a' : '#f1f5f9' }}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 pb-4">
                  <div
                    className="flex items-center justify-center rounded-2xl"
                    style={{ width: 56, height: 56, background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(79,70,229,0.2) 100%)' }}
                  >
                    <Sparkles className="w-6 h-6" style={{ color: '#7c3aed' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: isLight ? '#0f172a' : '#f1f5f9' }}>
                      ¿En qué puedo ayudarte?
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Consulta datos de tus proyectos, órdenes y más
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full mt-1">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl transition-all hover:opacity-80 active:scale-[0.98]"
                        style={{
                          background: isLight ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.1)',
                          border: `1px solid rgba(124,58,237,0.2)`,
                          color: isLight ? '#4f46e5' : '#a78bfa',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className="max-w-[85%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap"
                        style={{
                          background: msg.role === 'user' ? userBubbleBg : aiBubbleBg,
                          color: msg.role === 'user'
                            ? '#fff'
                            : isLight ? '#0f172a' : '#e2e8f0',
                          borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                          borderBottomLeftRadius: msg.role === 'assistant' ? 4 : undefined,
                          boxShadow: msg.role === 'assistant'
                            ? isLight ? '0 1px 4px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.3)'
                            : 'none',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div
                        className="flex items-center gap-1.5 rounded-2xl px-3 py-2.5"
                        style={{
                          background: aiBubbleBg,
                          borderBottomLeftRadius: 4,
                          boxShadow: isLight ? '0 1px 4px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.3)',
                        }}
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#7c3aed' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Analizando…</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div
              className="px-3 py-3 shrink-0"
              style={{ borderTop: `1px solid ${borderColor}` }}
            >
              <div
                className="flex items-end gap-2 rounded-xl px-3 py-2"
                style={{ background: inputBg, border: `1px solid ${borderColor}` }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Escribe una pregunta…"
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-xs outline-none leading-relaxed"
                  style={{
                    color: isLight ? '#0f172a' : '#f1f5f9',
                    maxHeight: 80,
                    overflowY: 'auto',
                  }}
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = 'auto';
                    t.style.height = `${Math.min(t.scrollHeight, 80)}px`;
                  }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className="flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-40"
                  style={{
                    width: 30,
                    height: 30,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                    boxShadow: input.trim() && !loading ? '0 0 10px rgba(124,58,237,0.4)' : 'none',
                  }}
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
                Enter para enviar · Shift+Enter nueva línea
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
