'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ClipboardPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { toast } from 'sonner';

const TIPOS = ['Funcional','No funcional','Mejora','Corrección','Integración','Otro'];

const PRIORIDADES = [
  { label: 'Crítico', color: '#dc2626', bg: 'rgba(220,38,38,0.14)',  ring: 'rgba(220,38,38,0.50)' },
  { label: 'Alta',    color: '#f97316', bg: 'rgba(249,115,22,0.13)', ring: 'rgba(249,115,22,0.45)' },
  { label: 'Media',   color: '#eab308', bg: 'rgba(234,179,8,0.13)',  ring: 'rgba(234,179,8,0.45)'  },
  { label: 'Baja',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  ring: 'rgba(34,197,94,0.40)'  },
];

export default function RegistrarRequerimientoPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [form, setForm] = useState({
    titulo: '', tipo: 'Funcional', prioridad: 'Media',
    descripcion: '', criteriosAceptacion: '', modulo: '', solicitante: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      toast.error('Título y descripción son obligatorios');
      return;
    }
    setSubmitted(true);
    toast.success('Requerimiento registrado exitosamente');
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        </motion.div>
        <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>¡Requerimiento registrado!</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>El requerimiento fue guardado correctamente.</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => setSubmitted(false)}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm text-white font-medium">
            Registrar otro
          </button>
          <a href="/requerimientos/priorizar"
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Ver priorización
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton href="/dashboard" label="Volver al dashboard" />

      <div>
        <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ClipboardPlus className="w-5 h-5 text-blue-400" />
          Registrar Requerimiento
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Documenta un nuevo requerimiento del sistema o del cliente.
        </p>
      </div>

      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-5" style={glass}>

        {/* Título */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Título <span className="text-red-400 normal-case">*</span>
          </label>
          <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
            placeholder="Ej: Módulo de facturación electrónica"
            value={form.titulo} onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))} />
        </div>

        {/* Tipo + Prioridad */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tipo</label>
            <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={form.tipo} onChange={(e) => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Prioridad</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {PRIORIDADES.map(p => (
                <button key={p.label} type="button"
                  onClick={() => setForm(f => ({ ...f, prioridad: p.label }))}
                  className="py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: form.prioridad === p.label ? p.bg : 'transparent',
                    border: `1px solid ${form.prioridad === p.label ? p.color : 'var(--border-subtle)'}`,
                    color: form.prioridad === p.label ? p.color : 'var(--text-muted)',
                    boxShadow: form.prioridad === p.label ? `0 0 0 2px ${p.ring}` : 'none',
                  }}>
                  {p.label === 'Crítico' ? '🔴 ' : ''}{p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Módulo + Solicitante */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Módulo</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: Facturación, Inventario..."
              value={form.modulo} onChange={(e) => setForm(p => ({ ...p, modulo: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Solicitante</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Nombre del solicitante"
              value={form.solicitante} onChange={(e) => setForm(p => ({ ...p, solicitante: e.target.value }))} />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Descripción <span className="text-red-400 normal-case">*</span>
          </label>
          <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={4}
            placeholder="Describe el requerimiento en detalle, contexto, objetivo..."
            value={form.descripcion} onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))} />
        </div>

        {/* Criterios de aceptación */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Criterios de aceptación</label>
          <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
            placeholder="¿Cómo se valida que el requerimiento está cumplido?"
            value={form.criteriosAceptacion} onChange={(e) => setForm(p => ({ ...p, criteriosAceptacion: e.target.value }))} />
        </div>

        {/* Nota */}
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Los requerimientos registrados pasan a revisión. Desde{' '}
            <a href="/requerimientos/priorizar" className="text-blue-400 underline">Priorizar Requerimientos</a>{' '}
            puedes ordenarlos por impacto y urgencia.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-1">
          <button type="button"
            onClick={() => setForm({ titulo:'',tipo:'Funcional',prioridad:'Media',descripcion:'',criteriosAceptacion:'',modulo:'',solicitante:'' })}
            className="px-5 py-2.5 rounded-xl text-sm transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Limpiar
          </button>
          <button type="submit"
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold">
            Registrar requerimiento
          </button>
        </div>
      </motion.form>
    </div>
  );
}
