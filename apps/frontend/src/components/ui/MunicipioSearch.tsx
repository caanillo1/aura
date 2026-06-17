'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, X } from 'lucide-react';
import type { Municipio } from '@/types';

interface Props {
  municipios: Municipio[];
  value: string;          // texto visible (nombreMunicipio + dept)
  onSelect: (m: Municipio | null) => void;
  placeholder?: string;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  required?: boolean;
  label?: string;
}

export function MunicipioSearch({
  municipios, value, onSelect,
  placeholder = 'Buscar municipio...',
  inputClassName = '',
  inputStyle,
  required, label,
}: Props) {
  const [query, setQuery]       = useState(value);
  const [open,  setOpen]        = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If nothing selected but user typed, revert to last confirmed value
        if (query !== value) setQuery(value);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, value]);

  const results = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = norm(query.trim());
    if (!q) return municipios.slice(0, 8);
    return municipios
      .filter(m =>
        norm(m.nombreMunicipio).includes(q) ||
        norm(m.nombreDepartamento).includes(q)
      )
      .slice(0, 8);
  }, [query, municipios]);

  const handleSelect = (m: Municipio) => {
    const display = `${m.nombreMunicipio}, ${m.nombreDepartamento}`;
    setQuery(display);
    setOpen(false);
    onSelect(m);
  };

  const handleClear = () => {
    setQuery('');
    setOpen(false);
    onSelect(null);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className={`w-full pl-10 pr-8 ${inputClassName}`}
          style={inputStyle}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
          style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)', maxHeight: 224 }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 224 }}>
            {results.map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(m); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition-colors flex items-center justify-between gap-2"
                  style={{ color: '#e2e8f0' }}
                >
                  <span className="font-medium">{m.nombreMunicipio}</span>
                  <span className="text-xs shrink-0" style={{ color: '#64748b' }}>{m.nombreDepartamento}</span>
                </button>
              </li>
            ))}
          </div>
        </ul>
      )}

      {open && query.trim().length > 0 && results.length === 0 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl px-4 py-3 text-sm"
          style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)', color: '#64748b' }}
        >
          Sin resultados para "{query}"
        </div>
      )}
    </div>
  );
}
