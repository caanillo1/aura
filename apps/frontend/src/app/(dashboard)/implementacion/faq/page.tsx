'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import * as LucideIcons from 'lucide-react';
import {
  BookOpen, Plus, Search, Edit3, Trash2, Eye,
  X, Loader2, Settings2, BookMarked, Pencil,
  Save, ArrowLeft, Check, Smile, ChevronDown,
} from 'lucide-react';
import { faqApi, type FaqTipo, type FaqListItem, type FaqDetail } from '@/lib/api';
import { toast } from 'sonner';

// ── Icon picker ──────────────────────────────────────────────────────────────
const ICON_LIST = [
  'BookOpen','BookMarked','BookCopy','GraduationCap','Lightbulb','Sparkles',
  'Star','Heart','Trophy','Medal','Award','Target',
  'Wrench','Settings','Settings2','Tool','Hammer','Scissors',
  'Bug','AlertTriangle','AlertCircle','Info','HelpCircle','CircleHelp',
  'CheckCircle','CheckCircle2','XCircle','Shield','ShieldCheck','Lock',
  'Users','User','UserCheck','Building','Building2','Briefcase',
  'Laptop','Monitor','Smartphone','Tablet','Database','Server',
  'FileText','File','Folder','FolderOpen','Clipboard','ClipboardList',
  'Mail','MessageCircle','MessageSquare','Bell','Phone','PhoneCall',
  'Globe','Link','ExternalLink','Code','Code2','Terminal',
  'BarChart','BarChart3','LineChart','PieChart','TrendingUp','Activity',
  'Calendar','Clock','Timer','Hourglass','RefreshCw','Repeat',
  'Download','Upload','Share','Send','Printer','Save',
  'Image','Camera','Video','Music','Mic','Headphones',
  'Map','MapPin','Navigation','Compass','Home','Store',
  'ShoppingCart','Package','Tag','Tags','Ticket','Receipt',
  'DollarSign','CreditCard','Banknote','Coins','Wallet','PiggyBank',
  'Zap','Battery','Wifi','Bluetooth','Radio','Antenna',
] as const;

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const filtered = ICON_LIST.filter(n => !q || n.toLowerCase().includes(q.toLowerCase()));
  const Cur = value ? (LucideIcons as any)[value] : Smile;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm w-full"
        style={{ background: 'var(--surface-2)', border: `1px solid ${open ? '#818cf8' : 'var(--border-subtle)'}`, color: 'var(--text-primary)' }}>
        {Cur && <Cur className="w-4 h-4 shrink-0" style={{ color: '#818cf8' }} />}
        <span className="flex-1 text-left truncate" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {value || 'Seleccionar ícono'}
        </span>
        <X className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl shadow-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
          <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ícono…"
              className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div className="grid grid-cols-8 gap-1 p-2 max-h-52 overflow-y-auto">
            <button type="button" onMouseDown={() => { onChange(''); setOpen(false); setQ(''); }}
              title="Sin ícono"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
              style={{ border: !value ? '2px solid #818cf8' : '1px solid var(--border-subtle)' }}>
              <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
            {filtered.map(name => {
              const Icon = (LucideIcons as any)[name];
              if (!Icon) return null;
              return (
                <button key={name} type="button" title={name}
                  onMouseDown={() => { onChange(name); setOpen(false); setQ(''); }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ border: value === name ? '2px solid #818cf8' : '1px solid transparent' }}>
                  <Icon className="w-4 h-4" style={{ color: value === name ? '#818cf8' : 'var(--text-muted)' }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const RichEditor = dynamic(() => import('@/components/ui/RichEditor'), { ssr: false });

// ── Tipo select (custom — native <select> ignores dark-mode vars) ─────────────
function TipoSelect({ value, onChange, tipos }: { value: string; onChange: (v: string) => void; tipos: FaqTipo[] }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = tipos.find(t => t.id === value);
  const activeItems = tipos.filter(t => t.activo);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-left"
        style={{
          background: 'var(--surface-2)',
          border: `1px solid ${open ? '#818cf8' : 'var(--border-subtle)'}`,
          color: 'var(--text-primary)',
        }}
      >
        {selected ? (
          <>
            {selected.icono && (() => { const I = (LucideIcons as any)[selected.icono]; return I ? <I className="w-3.5 h-3.5 shrink-0" style={{ color: selected.color ?? '#6366f1' }} /> : null; })()}
            {!selected.icono && <div className="w-3 h-3 rounded-full shrink-0" style={{ background: selected.color ?? '#6366f1' }} />}
            <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{selected.nombre}</span>
          </>
        ) : (
          <span className="flex-1" style={{ color: 'var(--text-muted)' }}>Sin tipo</span>
        )}
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl shadow-2xl"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-subtle)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {/* Sin tipo */}
          {([''] as const).map(() => {
            const isActive = value === '';
            const isHovered = hovered === '__none__';
            return (
              <button
                key="none"
                type="button"
                onMouseDown={() => { onChange(''); setOpen(false); }}
                onMouseEnter={() => setHovered('__none__')}
                onMouseLeave={() => setHovered(null)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left"
                style={{
                  background: isActive
                    ? 'rgba(129,140,248,0.15)'
                    : isHovered
                    ? 'rgba(129,140,248,0.07)'
                    : 'transparent',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">Sin tipo</span>
                {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#818cf8' }} />}
              </button>
            );
          })}

          {activeItems.map(t => {
            const Icon = t.icono ? (LucideIcons as any)[t.icono] : null;
            const isActive  = value === t.id;
            const isHovered = hovered === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onMouseDown={() => { onChange(t.id); setOpen(false); }}
                onMouseEnter={() => setHovered(t.id)}
                onMouseLeave={() => setHovered(null)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left"
                style={{
                  background: isActive
                    ? 'rgba(129,140,248,0.15)'
                    : isHovered
                    ? 'rgba(129,140,248,0.07)'
                    : 'transparent',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                {Icon
                  ? <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: t.color ?? '#6366f1' }} />
                  : <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color ?? '#6366f1' }} />
                }
                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{t.nombre}</span>
                {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#818cf8' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Color palette for types ──────────────────────────────────────────────────
const TYPE_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
function parseTags(raw?: string): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// ── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ tipo }: { tipo?: { nombre: string; color?: string; icono?: string } | null }) {
  if (!tipo) return null;
  const color = tipo.color ?? '#6366f1';
  const Icon  = tipo.icono ? (LucideIcons as any)[tipo.icono] : null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
      {Icon && <Icon className="w-3 h-3" />}
      {tipo.nombre}
    </span>
  );
}

// ── Manage Types Modal ───────────────────────────────────────────────────────
function TypesModal({ onClose, tipos, onSaved }: { onClose: () => void; tipos: FaqTipo[]; onSaved: () => void }) {
  const [nombre, setNombre]     = useState('');
  const [color, setColor]       = useState(TYPE_COLORS[0]);
  const [icono, setIcono]       = useState('');
  const [desc, setDesc]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [editing, setEditing]   = useState<FaqTipo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const startEdit = (t: FaqTipo) => {
    setEditing(t);
    setNombre(t.nombre);
    setColor(t.color ?? TYPE_COLORS[0]);
    setIcono(t.icono ?? '');
    setDesc(t.descripcion ?? '');
  };

  const reset = () => { setEditing(null); setNombre(''); setColor(TYPE_COLORS[0]); setIcono(''); setDesc(''); };

  const handleSave = async () => {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) {
        await faqApi.updateTipo(editing.id, { nombre: nombre.trim(), color, icono: icono || undefined, descripcion: desc || undefined });
        toast.success('Tipo actualizado');
      } else {
        await faqApi.createTipo({ nombre: nombre.trim(), color, icono: icono || undefined, descripcion: desc || undefined });
        toast.success('Tipo creado');
      }
      onSaved(); reset();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await faqApi.deleteTipo(id);
      toast.success('Tipo eliminado');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" style={{ color: '#818cf8' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Tipos de FAQ</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Form */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{editing ? 'Editar tipo' : 'Nuevo tipo'}</p>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del tipo *"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ícono</p>
              <IconPicker value={icono} onChange={setIcono} />
            </div>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Color</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--card-bg), 0 0 0 4px ${c}` : undefined }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              {editing && <button type="button" onClick={reset} className="px-3 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }}>Cancelar</button>}
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ml-auto"
                style={{ background: '#818cf8', color: '#fff' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>

          {/* List */}
          {tipos.length > 0 && (
            <div className="space-y-1.5">
              {tipos.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(() => { const Icon = t.icono ? (LucideIcons as any)[t.icono] : null; return Icon
                      ? <Icon className="w-4 h-4 shrink-0" style={{ color: t.color ?? '#6366f1' }} />
                      : <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color ?? '#6366f1' }} />; })()}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.nombre}</p>
                      {t.descripcion && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.descripcion}</p>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                      {t._count?.faqs ?? 0} FAQ
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-white/5"><Pencil className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>
                    <button onClick={() => handleDelete(t.id)} disabled={!!deleting} className="p-1.5 rounded-lg hover:bg-white/5">
                      {deleting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#f87171' }} /> : <Trash2 className="w-3.5 h-3.5" style={{ color: '#f87171' }} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
type Mode = 'list' | 'view' | 'edit' | 'new';

export default function FaqPage() {
  const [mode, setMode]           = useState<Mode>('list');
  const [faqs, setFaqs]           = useState<FaqListItem[]>([]);
  const [tipos, setTipos]         = useState<FaqTipo[]>([]);
  const [selected, setSelected]   = useState<FaqDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [typesModal, setTypesModal] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  // Form state
  const [titulo, setTitulo]       = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [contenido, setContenido] = useState('');
  const [tipoId, setTipoId]       = useState('');
  const [tagInput, setTagInput]   = useState('');
  const [tags, setTags]           = useState<string[]>([]);

  const loadTipos = useCallback(async () => {
    try { setTipos(await faqApi.getTipos()); } catch {}
  }, []);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      setFaqs(await faqApi.getFaqs({}));
    } catch { toast.error('Error cargando FAQs'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadTipos(); }, [loadTipos]);
  useEffect(() => { loadFaqs(); }, [loadFaqs]);

  const openFaq = async (id: string) => {
    try {
      const faq = await faqApi.getFaq(id);
      setSelected(faq);
      setMode('view');
    } catch { toast.error('Error al abrir el FAQ'); }
  };

  const startNew = () => {
    setSelected(null);
    setTitulo(''); setDescripcion(''); setContenido(''); setTipoId(''); setTags([]); setTagInput('');
    setMode('new');
  };

  const startEdit = () => {
    if (!selected) return;
    setTitulo(selected.titulo);
    setDescripcion(selected.descripcion ?? '');
    setContenido(selected.contenido);
    setTipoId(selected.tipo?.id ?? '');
    setTags(parseTags(selected.etiquetas));
    setTagInput('');
    setMode('edit');
  };

  const handleSave = async () => {
    if (!titulo.trim())    { toast.error('El título es obligatorio'); return; }
    if (!contenido.trim()) { toast.error('El contenido no puede estar vacío'); return; }
    setSaving(true);
    try {
      const body = { titulo: titulo.trim(), descripcion: descripcion || undefined, contenido, tipoId: tipoId || undefined, etiquetas: tags.length ? tags : undefined };
      const saved = mode === 'new'
        ? await faqApi.createFaq(body)
        : await faqApi.updateFaq(selected!.id, body);
      setSelected(saved);
      setMode('view');
      toast.success(mode === 'new' ? 'FAQ creado' : 'FAQ actualizado');
      loadFaqs();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected || !confirm('¿Eliminar este FAQ?')) return;
    setDeleting(true);
    try {
      await faqApi.deleteFaq(selected.id);
      toast.success('FAQ eliminado');
      setSelected(null); setMode('list');
      loadFaqs();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(false); }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(p => [...p, t]);
    setTagInput('');
  };

  // ── Filtered FAQ list (client-side, instant) ─────────────────────────────
  const filtered = faqs.filter(f => {
    if (filterTipo && f.tipo?.id !== filterTipo) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitulo      = f.titulo.toLowerCase().includes(q);
      const inDescripcion = (f.descripcion ?? '').toLowerCase().includes(q);
      const inEtiquetas   = parseTags(f.etiquetas).some(t => t.toLowerCase().includes(q));
      const inTipo        = (f.tipo?.nombre ?? '').toLowerCase().includes(q);
      if (!inTitulo && !inDescripcion && !inEtiquetas && !inTipo) return false;
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Left panel: list ── */}
      <div className="w-80 shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: '#818cf8' }} />
              <h1 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>FAQ</h1>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setTypesModal(true)} title="Gestionar tipos"
                className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                <Settings2 className="w-4 h-4" />
              </button>
              <button onClick={startNew}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#818cf8', color: '#fff' }}>
                <Plus className="w-3.5 h-3.5" />Nuevo
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar FAQ…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
              style={{ color: 'var(--text-primary)' }} />
            {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>}
          </div>

          {/* Type filter */}
          {tipos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterTipo('')}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={!filterTipo ? { background: 'rgba(129,140,248,0.2)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.4)' }
                                   : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                Todos
              </button>
              {tipos.filter(t => t.activo).map(t => (
                <button key={t.id} onClick={() => setFilterTipo(p => p === t.id ? '' : t.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={filterTipo === t.id
                    ? { background: `${t.color ?? '#6366f1'}25`, color: t.color ?? '#6366f1', border: `1px solid ${t.color ?? '#6366f1'}50` }
                    : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  {t.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FAQ list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
              <BookMarked className="w-8 h-8 opacity-30" />
              <p className="text-sm text-center opacity-60">{search || filterTipo ? 'Sin resultados' : 'No hay FAQs aún.\nCrea el primero.'}</p>
            </div>
          ) : filtered.map(faq => (
            <button key={faq.id} onClick={() => openFaq(faq.id)}
              className="w-full text-left px-4 py-3 transition-colors hover:bg-white/3"
              style={selected?.id === faq.id
                ? { background: 'rgba(129,140,248,0.08)', borderLeft: '3px solid #818cf8' }
                : { borderLeft: '3px solid transparent', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>{faq.titulo}</p>
                <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{faq.vistas} <Eye className="w-2.5 h-2.5 inline" /></span>
              </div>
              {faq.descripcion && <p className="text-xs truncate mb-1.5" style={{ color: 'var(--text-muted)' }}>{faq.descripcion}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                {faq.tipo && <TypeBadge tipo={faq.tipo} />}
                {parseTags(faq.etiquetas).slice(0, 2).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>#{tag}</span>
                ))}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{formatDate(faq.updatedAt)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>

        {/* Empty state */}
        {mode === 'list' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: 'var(--text-muted)' }}>
            <BookOpen className="w-14 h-14 opacity-15" />
            <div className="text-center">
              <p className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Base de conocimiento</p>
              <p className="text-sm opacity-60">Selecciona un FAQ o crea uno nuevo</p>
            </div>
            <button onClick={startNew} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-2"
              style={{ background: '#818cf8', color: '#fff' }}>
              <Plus className="w-4 h-4" />Crear FAQ
            </button>
          </div>
        )}

        {/* View mode */}
        {mode === 'view' && selected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setMode('list')} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {selected.tipo && <TypeBadge tipo={selected.tipo} />}
                <div className="flex gap-1">
                  {parseTags(selected.etiquetas).map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}>
                  <Edit3 className="w-3.5 h-3.5" />Editar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto">
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{selected.titulo}</h1>
              {selected.descripcion && <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{selected.descripcion}</p>}
              <div className="flex items-center gap-3 text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                {selected.autor && <span>{selected.autor.firstName} {selected.autor.lastName}</span>}
                <span>·</span>
                <span>Actualizado {formatDate(selected.updatedAt)}</span>
                <span>·</span>
                <span><Eye className="w-3 h-3 inline mr-0.5" />{selected.vistas} visitas</span>
              </div>
              <div
                className="prose-faq"
                dangerouslySetInnerHTML={{ __html: selected.contenido }}
                style={{ color: 'var(--text-primary)', lineHeight: '1.7', fontSize: '15px' }}
              />
            </div>
          </div>
        )}

        {/* New / Edit form */}
        {(mode === 'new' || mode === 'edit') && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <button onClick={() => mode === 'new' ? setMode('list') : setMode('view')} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{mode === 'new' ? 'Nuevo FAQ' : 'Editar FAQ'}</span>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: '#818cf8', color: '#fff' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-w-4xl w-full mx-auto">
              {/* Título */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Título *</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="¿Cuál es la pregunta o caso?"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none font-medium"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Descripción breve (opcional)</label>
                <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Resumen corto del caso"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>

              {/* Tipo + Tags row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Tipo</label>
                  <TipoSelect value={tipoId} onChange={setTipoId} tipos={tipos} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Etiquetas</label>
                  <div className="flex gap-2">
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())}
                      placeholder="etiqueta, Enter para agregar"
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                    <button type="button" onClick={addTag} className="px-3 py-2 rounded-xl" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}>
                          #{tag}
                          <button onClick={() => setTags(p => p.filter(t => t !== tag))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rich content editor */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Contenido / Solución *</label>
                <RichEditor
                  value={contenido}
                  onChange={setContenido}
                  placeholder="Documenta el caso, pasos de solución, capturas de pantalla, observaciones..."
                  minHeight={380}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Types modal */}
      {typesModal && (
        <TypesModal
          tipos={tipos}
          onClose={() => setTypesModal(false)}
          onSaved={() => { loadTipos(); loadFaqs(); }}
        />
      )}

      <style>{`
        .prose-faq img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
        .prose-faq ul  { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .prose-faq ol  { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .prose-faq hr  { border-color: var(--border-subtle); margin: 1em 0; }
        .prose-faq p   { margin: 0.4em 0; }
      `}</style>
    </div>
  );
}
