'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Save } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { serviceOrdersApi, clientsApi, usersApi } from '@/lib/api';
import { toast } from 'sonner';
import type { Client, User } from '@/types';

const EMPTY = {
  clientId: '', product: '', scope: '', startDate: '', endDate: '',
  durationDays: 0, clinicalLeaderId: '', financialLeaderId: '', observations: '',
};

export default function NuevaOrdenPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents]   = useState<User[]>([]);

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  useEffect(() => {
    clientsApi.list({ limit: 100 }).then(r => setClients(r.data)).catch(() => {});
    usersApi.list({ limit: 100, userType: 'agent' }).then(r => setAgents(r.data)).catch(() => {});
  }, []);

  const set = (k: keyof typeof EMPTY, v: string | number) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error('Selecciona un cliente'); return; }
    if (!form.product.trim()) { toast.error('El producto es obligatorio'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Las fechas son obligatorias'); return; }

    setSaving(true);
    try {
      const os = await serviceOrdersApi.create({
        clientId: form.clientId,
        product: form.product,
        scope: form.scope || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        durationDays: form.durationDays || undefined,
        clinicalLeaderId: form.clinicalLeaderId || undefined,
        financialLeaderId: form.financialLeaderId || undefined,
        observations: form.observations || undefined,
      });
      toast.success(`OS ${os.osNumber} creada exitosamente`);
      router.push(`/implementacion/ordenes/${os.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear la orden');
    } finally { setSaving(false); }
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: tc.m }}>
      {children}
    </label>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton href="/implementacion/ordenes" label="Órdenes de Servicio" />

      <div>
        <h2 className="font-bold text-xl" style={{ color: tc.p }}>Nueva Orden de Servicio</h2>
        <p className="text-sm mt-0.5" style={{ color: tc.m }}>El número OS se genera automáticamente al guardar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente + Producto */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 space-y-4" style={glass}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Información general</p>

          <div>
            <Label>Cliente <span className="text-red-400 normal-case">*</span></Label>
            <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={form.clientId} onChange={e => set('clientId', e.target.value)}>
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </div>

          <div>
            <Label>Producto / Alcance del servicio <span className="text-red-400 normal-case">*</span></Label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: Sistema de Facturación Electrónica módulo salud"
              value={form.product} onChange={e => set('product', e.target.value)} />
          </div>

          <div>
            <Label>Descripción del alcance</Label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              placeholder="Detalla los módulos, integraciones o funcionalidades incluidas..."
              value={form.scope} onChange={e => set('scope', e.target.value)} />
          </div>
        </motion.div>

        {/* Fechas */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-5 space-y-4" style={glass}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Fechas y duración</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Fecha de inicio <span className="text-red-400 normal-case">*</span></Label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <Label>Fecha de fin <span className="text-red-400 normal-case">*</span></Label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
            <div>
              <Label>Duración estimada (días)</Label>
              <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.durationDays} onChange={e => set('durationDays', Number(e.target.value))} />
            </div>
          </div>
        </motion.div>

        {/* Líderes */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="rounded-2xl p-5 space-y-4" style={glass}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Líderes de implementación</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Líder clínico</Label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.clinicalLeaderId} onChange={e => set('clinicalLeaderId', e.target.value)}>
                <option value="">Sin asignar</option>
                {agents.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <Label>Líder financiero</Label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.financialLeaderId} onChange={e => set('financialLeaderId', e.target.value)}>
                <option value="">Sin asignar</option>
                {agents.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Observaciones</Label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              placeholder="Notas adicionales sobre la orden..."
              value={form.observations} onChange={e => set('observations', e.target.value)} />
          </div>
        </motion.div>

        {/* Acciones */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.push('/implementacion/ordenes')}
            className="px-5 py-2.5 rounded-xl text-sm transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>
            Cancelar
          </button>
          <motion.button type="submit" disabled={saving}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Crear Orden de Servicio'}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
