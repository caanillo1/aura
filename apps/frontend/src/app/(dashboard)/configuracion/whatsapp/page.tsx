'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Smartphone, Wifi, WifiOff, Loader2, LogOut, RefreshCw, CheckCircle2, Send } from 'lucide-react';
import Image from 'next/image';
import { whatsappApi } from '@/lib/api';
import { toast } from 'sonner';

type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

const STATUS_META: Record<WaStatus, { label: string; color: string; icon: React.ElementType }> = {
  disconnected: { label: 'Desconectado',  color: '#f87171', icon: WifiOff    },
  connecting:   { label: 'Conectando…',   color: '#fbbf24', icon: Loader2    },
  qr:           { label: 'Escanea el QR', color: '#fbbf24', icon: Smartphone },
  connected:    { label: 'Conectado',     color: '#34d399', icon: CheckCircle2 },
};

export default function WhatsAppConfigPage() {
  const [status, setStatus]   = useState<WaStatus>('connecting');
  const [phone, setPhone]     = useState<string | null>(null);
  const [qr, setQr]           = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; debug: Record<string, string> } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.getStatus();
      setStatus(data.status);
      setPhone(data.phone ?? null);
      setQr(data.qr ?? null);
    } catch { /* backend no disponible */ }
  }, []);

  // Polling: cada 3s cuando estamos esperando QR o conectando, cada 10s si conectado
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, status === 'connected' ? 10000 : 3000);
    return () => clearInterval(interval);
  }, [fetchStatus, status]);

  const handleDisconnect = async () => {
    setLoading(true);
    try { await whatsappApi.disconnect(); await fetchStatus(); }
    finally { setLoading(false); }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) { toast.error('Ingresa un número de teléfono'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await whatsappApi.sendTest(testPhone.trim());
      setTestResult(r);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message ?? 'Error al conectar con el servidor', debug: {} });
      toast.error('Error al conectar con el servidor');
    } finally {
      setTesting(false);
    }
  };

  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)' }}>
            <MessageCircle className="w-5 h-5" style={{ color: '#25d366' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>WhatsApp</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Notificaciones automáticas a firmantes de actas
            </p>
          </div>
        </div>
      </motion.div>

      {/* Estado */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl p-5"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}>
              <Icon className={`w-4 h-4 ${status === 'connecting' ? 'animate-spin' : ''}`}
                style={{ color: meta.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.label}</p>
              {status === 'connected' && phone && (
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>+{phone}</p>
              )}
              {status === 'disconnected' && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  El servidor intenta reconectarse automáticamente
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchStatus}
              className="p-2 rounded-xl transition-colors hover:bg-white/5"
              title="Actualizar estado" style={{ color: 'var(--text-muted)' }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            {status === 'connected' && (
              <button onClick={handleDisconnect} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* QR */}
      {status === 'qr' && qr && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 text-center space-y-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Escanea el código QR con WhatsApp
          </p>
          <div className="flex justify-center">
            <div className="p-3 rounded-2xl" style={{ background: '#fff' }}>
              <Image src={qr} alt="QR WhatsApp" width={220} height={220} unoptimized />
            </div>
          </div>
          <ol className="text-xs text-left space-y-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
            <li>1. Abre WhatsApp en tu celular</li>
            <li>2. Ve a <strong style={{ color: 'var(--text-secondary)' }}>Dispositivos vinculados</strong></li>
            <li>3. Toca <strong style={{ color: 'var(--text-secondary)' }}>Vincular un dispositivo</strong></li>
            <li>4. Escanea este código</li>
          </ol>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            El QR se actualiza automáticamente cada 30 segundos
          </p>
        </motion.div>
      )}

      {/* Cómo funciona */}
      {status === 'connected' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Funcionando</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Cuando publicas un acta con firmantes que tienen teléfono registrado, AURA les enviará
            automáticamente un mensaje de WhatsApp con el enlace para firmar.
          </p>
          <div className="rounded-xl p-3 text-xs font-mono"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            📋 <strong>Acta de Visita No. 001</strong><br />
            Hola <strong>Carlos García</strong>, tienes un documento pendiente por firmar.<br /><br />
            👉 Ingresa aquí para firmar:<br />
            https://aura.tudominio.com/firmar/abc123
          </div>
        </motion.div>
      )}

      {/* Prueba de envío */}
      {status === 'connected' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Probar envío</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Envía un mensaje de prueba a cualquier número para verificar que la conexión funciona.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="Ej: 3101234567"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendTest()}
              className="flex-1 rounded-xl px-3 py-2 text-sm input-glass"
              style={{ border: '1px solid var(--border-subtle)' }}
            />
            <button onClick={handleSendTest} disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#25d366' }}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {testing ? 'Enviando…' : 'Enviar'}
            </button>
          </div>

          {testResult && (
            <div className="rounded-xl p-3 space-y-1.5"
              style={{ background: testResult.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${testResult.ok ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
              <p className="text-xs font-semibold" style={{ color: testResult.ok ? '#34d399' : '#f87171' }}>
                {testResult.ok ? '✓ Enviado' : '✗ Error'}: {testResult.message}
              </p>
              {Object.keys(testResult.debug).length > 0 && (
                <div className="rounded-lg p-2 font-mono text-[11px] space-y-0.5"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {Object.entries(testResult.debug).map(([k, v]) => (
                    <div key={k}><span style={{ color: 'var(--text-secondary)' }}>{k}:</span> {v}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Info — desconectado */}
      {(status === 'disconnected' || status === 'connecting') && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            El sistema está iniciando la conexión con WhatsApp. En unos segundos aparecerá un
            código QR para escanear con tu número corporativo dedicado.
          </p>
        </motion.div>
      )}
    </div>
  );
}
