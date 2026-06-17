'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Save, Search, X, Building2, ChevronDown } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { serviceOrdersApi, clientsApi, usersApi } from '@/lib/api';
import { toast } from 'sonner';
import type { Client, User } from '@/types';

const EMPTY = {
  clientId: '', ticketRubi: '', product: '', scope: '', startDate: '', endDate: '',
  durationDays: 0, clinicalLeaderId: '', financialLeaderId: '', observations: '',
};

// ── Combobox de cliente ────────────────────────────────────────────────────

interface ClientComboboxProps {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  tc: { p: string; s: string; m: string };
  isLight: boolean;
}

function ClientCombobox({ clients, value, onChange, tc, isLight }: ClientComboboxProps) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value) ?? null;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? clients.filter(c =>
        c.businessName.toLowerCase().includes(query.toLowerCase()) ||
        (c.nit ?? '').includes(query)
      )
    : clients;

  const handleSelect = (c: Client) => {
    onChange(c.id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
  };

  const borderColor = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const dropBg      = isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,25,50,0.97)';

  return (
    <div ref={ref} className="relative">
      {/* Input principal */}
      <div className="relative flex items-center input-glass rounded-xl overflow-hidden"
        style={{ border: `1px solid ${open ? '#60a5fa60' : borderColor}`, transition: 'border-color 0.15s' }}>
        <span className="pl-3 shrink-0">
          {selected
            ? <Building2 className="w-4 h-4" style={{ color: '#60a5fa' }} />
            : <Search className="w-4 h-4" style={{ color: tc.m }} />}
        </span>

        {selected && !open ? (
          /* Muestra el nombre del cliente seleccionado */
          <button type="button" onClick={() => { setOpen(true); setQuery(''); }}
            className="flex-1 text-left px-3 py-2.5 text-sm truncate"
            style={{ color: tc.p }}>
            {selected.businessName}
          </button>
        ) : (
          <input
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ color: tc.p }}
            placeholder={selected ? selected.businessName : 'Buscar cliente por nombre o NIT...'}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        )}

        {selected ? (
          <button type="button" onClick={handleClear}
            className="pr-3 pl-1 shrink-0 transition-opacity hover:opacity-70">
            <X className="w-4 h-4" style={{ color: tc.m }} />
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(o => !o)}
            className="pr-3 pl-1 shrink-0 transition-opacity hover:opacity-70">
            <ChevronDown className="w-4 h-4" style={{ color: tc.m, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              zIndex: 50, borderRadius: '0.75rem', overflow: 'hidden',
              background: dropBg,
              border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: isLight
                ? '0 12px 40px rgba(30,60,120,0.18)'
                : '0 12px 40px rgba(0,0,0,0.50)',
              transformOrigin: 'top',
            }}>

            {/* Contador */}
            {query.trim() && (
              <div className="px-3 py-1.5 border-b text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: tc.m, borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                {filtered.length === 0 ? 'Sin resultados' : `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
              </div>
            )}

            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm" style={{ color: tc.m }}>
                  No hay clientes que coincidan con <strong>&ldquo;{query}&rdquo;</strong>
                </div>
              ) : filtered.map(c => {
                const isActive = c.id === value;
                const hi = query.trim();
                const name = c.businessName;
                const idx  = hi ? name.toLowerCase().indexOf(hi.toLowerCase()) : -1;

                return (
                  <button key={c.id} type="button" onClick={() => handleSelect(c)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                    style={{
                      background: isActive
                        ? 'rgba(96,165,250,0.12)'
                        : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                    <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? '#60a5fa' : tc.m, opacity: isActive ? 1 : 0.5 }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: isActive ? '#60a5fa' : tc.p }}>
                        {hi && idx >= 0 ? (
                          <>
                            {name.slice(0, idx)}
                            <mark style={{ background: 'rgba(96,165,250,0.25)', color: '#60a5fa', borderRadius: '2px' }}>
                              {name.slice(idx, idx + hi.length)}
                            </mark>
                            {name.slice(idx + hi.length)}
                          </>
                        ) : name}
                      </p>
                      {c.nit && (
                        <p className="text-[11px] mt-0.5" style={{ color: tc.m }}>NIT: {c.nit}</p>
                      )}
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                        Seleccionado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

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
    // Cargar todos los clientes (limit alto para búsqueda local completa)
    clientsApi.list({ limit: 500 }).then(r => setClients(r.data)).catch(() => {});
    usersApi.listAgents({ limit: 100 }).then(r => setAgents(r.data)).catch(() => {});
  }, []);

  const set = (k: keyof typeof EMPTY, v: string | number) =>
    setForm(p => ({ ...p, [k]: v }));

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  const clampDateYear = (val: string): string => {
    if (!val) return val;
    const parts = val.split('-');
    if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
    return parts.join('-');
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const safe = clampDateYear(value);
    setForm(p => {
      const next = { ...p, [field]: safe };
      next.durationDays = calcDays(
        field === 'startDate' ? safe : p.startDate,
        field === 'endDate'   ? safe : p.endDate,
      );
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error('Selecciona un cliente'); return; }
    if (!form.product.trim()) { toast.error('El producto es obligatorio'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Las fechas son obligatorias'); return; }

    setSaving(true);
    try {
      const os = await serviceOrdersApi.create({
        clientId: form.clientId,
        ticketRubi: form.ticketRubi || undefined,
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
            <ClientCombobox
              clients={clients}
              value={form.clientId}
              onChange={id => set('clientId', id)}
              tc={tc}
              isLight={isLight}
            />
          </div>

          <div>
            <Label>Ticket Rubi</Label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: RUBI-1234"
              value={form.ticketRubi} onChange={e => set('ticketRubi', e.target.value)} />
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
                max="2099-12-31" min="2000-01-01"
                value={form.startDate} onChange={e => handleDateChange('startDate', e.target.value)} />
            </div>
            <div>
              <Label>Fecha de fin <span className="text-red-400 normal-case">*</span></Label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                max="2099-12-31" min="2000-01-01"
                value={form.endDate} onChange={e => handleDateChange('endDate', e.target.value)} />
            </div>
            <div>
              <Label>Duración estimada (días)</Label>
              <div className="relative">
                <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                  readOnly={!!(form.startDate && form.endDate)}
                  value={form.durationDays}
                  onChange={e => set('durationDays', Number(e.target.value))}
                  style={form.startDate && form.endDate ? { opacity: 0.8, cursor: 'default' } : {}} />
                {form.startDate && form.endDate && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold"
                    style={{ color: '#60a5fa' }}>auto</span>
                )}
              </div>
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
