'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface ClientComboboxProps {
  clients: { id: string; businessName: string }[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  nullLabel?: string;
  placeholder?: string;
  className?: string;
}

export function ClientCombobox({
  clients,
  value,
  onChange,
  label,
  nullLabel = 'Todos los clientes',
  placeholder = 'Buscar cliente…',
  className = '',
}: ClientComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) { setQuery(''); return; }
    const found = clients.find(c => c.id === value);
    if (found) setQuery(found.businessName);
  }, [value, clients]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = query.trim()
    ? clients.filter(c => normalize(c.businessName).includes(normalize(query)))
    : clients;

  const clear = () => { onChange(''); setQuery(''); setOpen(false); };

  return (
    <div ref={ref} className={`relative flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          className="input-glass rounded-xl px-3 py-2 text-sm w-full pr-8"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange('');
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <span className="absolute right-2.5 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
          {value
            ? (
              <button className="pointer-events-auto p-0.5 rounded hover:bg-white/10" onClick={clear}>
                <X className="w-3.5 h-3.5" />
              </button>
            )
            : <ChevronDown className="w-3.5 h-3.5" />
          }
        </span>
      </div>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            <button
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
              onClick={clear}
            >
              {nullLabel}
            </button>
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
              : filtered.map(c => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                  style={{
                    color: c.id === value ? '#a78bfa' : 'var(--text-primary)',
                    background: c.id === value ? 'rgba(167,139,250,0.10)' : 'transparent',
                  }}
                  onClick={() => { onChange(c.id); setQuery(c.businessName); setOpen(false); }}
                >
                  {c.businessName}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
