'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, Building2, Users, ChevronRight, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { clientsApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Client } from '@/types';

const EMPTY_FORM = { nit: '', businessName: '', commercialName: '', address: '', city: '', department: '', email: '', phone: '', economicActivity: '' };

export default function ClientesPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  // Estilo glass para las cards de cliente
  const glassCard = {
    background: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 6px 24px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 6px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const dividerStyle = {
    borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'}`,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsApi.list({ page, limit: 12, search: search || undefined });
      setClients(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar clientes'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.nit.trim() || !form.businessName.trim()) {
      toast.error('NIT y razón social son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await clientsApi.create(form);
      toast.success('Cliente creado exitosamente');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear cliente');
    } finally { setSaving(false); }
  };


  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Clientes</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{total} empresas registradas</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, NIT, ciudad..."
            className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
        </div>
        <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="py-20 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No se encontraron clientes</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary mt-4 px-5 py-2.5 rounded-xl text-sm text-white font-medium">
            Crear primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client, i) => (
            <motion.div key={client.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/clientes/${client.id}`}>
                <motion.div
                  whileHover={{ y: -3, boxShadow: isLight
                    ? '0 12px 32px rgba(30,60,120,0.22), inset 0 1px 0 rgba(255,255,255,0.98)'
                    : '0 12px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.15)'
                  }}
                  className="rounded-2xl p-5 cursor-pointer transition-all group"
                  style={glassCard}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}>
                      {client.businessName[0]}
                    </div>
                    <div className="flex items-center gap-2">
                      {client.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      <ChevronRight className="w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm leading-tight mb-0.5 line-clamp-1"
                    style={{ color: isLight ? '#0a1628' : '#e2e8f0' }}>
                    {client.businessName}
                  </h3>
                  {client.commercialName && (
                    <p className="text-xs mb-2" style={{ color: isLight ? '#1a3050' : '#94a3b8' }}>
                      {client.commercialName}
                    </p>
                  )}
                  <p className="text-xs font-mono" style={{ color: isLight ? '#2e4a70' : '#6b82a0' }}>
                    NIT: {client.nit}
                  </p>
                  {client.city && (
                    <p className="text-xs mt-0.5" style={{ color: isLight ? '#2e4a70' : '#6b82a0' }}>
                      {client.city}{client.department ? `, ${client.department}` : ''}
                    </p>
                  )}
                  {client._count && (
                    <div className="flex items-center gap-4 mt-4 pt-3" style={dividerStyle}>
                      <span className="flex items-center gap-1 text-xs" style={{ color: isLight ? '#2e4a70' : '#6b82a0' }}>
                        <Users className="w-3.5 h-3.5" /> {client._count.staff} funcionarios
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: isLight ? '#2e4a70' : '#6b82a0' }}>
                        <Building2 className="w-3.5 h-3.5" /> {client._count.serviceOrders} OS
                      </span>
                    </div>
                  )}
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {total > 12 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Página {page} de {Math.ceil(total / 12)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Anterior
            </button>
            <button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── Modal crear cliente ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); }} title="Nuevo cliente" width="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          {/* NIT */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>NIT <span className="text-red-400">*</span></label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="900123456-7"
              value={form.nit} onChange={(e) => setForm((p) => ({ ...p, nit: e.target.value }))} />
          </div>
          {/* Razón social */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Razón social <span className="text-red-400">*</span></label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Hospital San Jorge S.A.S"
              value={form.businessName} onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))} />
          </div>
          {/* Nombre comercial */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nombre comercial</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Hospital San Jorge"
              value={form.commercialName} onChange={(e) => setForm((p) => ({ ...p, commercialName: e.target.value }))} />
          </div>
          {/* Ciudad */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Ciudad</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Bogotá"
              value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
          </div>
          {/* Departamento */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Departamento</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Cundinamarca"
              value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
          </div>
          {/* Dirección */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Dirección</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Cra 15 #23-45"
              value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          {/* Correo */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Correo empresa</label>
            <input type="email" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="info@empresa.com"
              value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          {/* Teléfono */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="3101234567"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          {/* Actividad económica */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Actividad económica</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Ej: Servicios de salud"
              value={form.economicActivity} onChange={(e) => setForm((p) => ({ ...p, economicActivity: e.target.value }))} />
          </div>
          {/* Botones */}
          <div className="col-span-2 flex gap-3 pt-2">
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {saving ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
