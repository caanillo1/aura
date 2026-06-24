'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Image, Minus, Eraser, Palette,
  Type, ChevronDown, Paperclip, Loader2,
} from 'lucide-react';

const FONTS = ['Arial', 'Georgia', 'Verdana', 'Courier New', 'Tahoma', 'Times New Roman', 'Trebuchet MS'];
const SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36'];
const COLORS = [
  '#000000','#374151','#6b7280','#9ca3af','#ffffff',
  '#1d4ed8','#2563eb','#60a5fa','#93c5fd','#dbeafe',
  '#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#ede9fe',
  '#047857','#059669','#34d399','#6ee7b7','#d1fae5',
  '#b91c1c','#dc2626','#f87171','#fca5a5','#fee2e2',
  '#d97706','#f59e0b','#fbbf24','#fde68a','#fffbeb',
  '#0e7490','#0891b2','#22d3ee','#67e8f9','#cffafe',
];

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  onUploadFile?: (file: File) => Promise<{ filename: string; originalName: string; size: number; url: string }>;
}

function ToolBtn({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="p-1.5 rounded-lg transition-colors"
      style={active
        ? { background: 'rgba(129,140,248,0.25)', color: '#818cf8' }
        : { color: 'var(--text-muted)' }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 mx-1 self-center" style={{ background: 'var(--border-subtle)' }} />;
}

export default function RichEditor({ value, onChange, placeholder = 'Escribe el contenido aquí...', minHeight = 320, onUploadFile }: Props) {
  const editorRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgModal, setImgModal]       = useState(false);
  const [imgUrl, setImgUrl]           = useState('');
  const [colorPicker, setColorPicker] = useState<'text' | 'bg' | null>(null);
  const [fontOpen, setFontOpen]       = useState(false);
  const [sizeOpen, setSizeOpen]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []); // eslint-disable-line

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreRange = () => {
    if (!savedRange.current) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertImage = () => {
    if (!imgUrl.trim()) return;
    restoreRange();
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      `<img src="${imgUrl}" alt="" style="max-width:100%;border-radius:8px;margin:4px 0;" />`);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setImgUrl('');
    setImgModal(false);
  };

  const setFont = (font: string) => {
    restoreRange();
    exec('fontName', font);
    setFontOpen(false);
  };

  const setSize = (size: string) => {
    restoreRange();
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      `<span style="font-size:${size}px">${window.getSelection()?.toString() || '​'}</span>`);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setSizeOpen(false);
  };

  const setColor = (color: string) => {
    restoreRange();
    if (colorPicker === 'text') exec('foreColor', color);
    else exec('hiliteColor', color);
    setColorPicker(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadFile) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`El archivo supera el límite de 30 MB (${formatBytes(file.size)})`);
      return;
    }

    setUploading(true);
    try {
      const result = await onUploadFile(file);
      restoreRange();
      editorRef.current?.focus();
      const html = `<div class="faq-attachment" data-url="${result.url}" data-filename="${result.filename}" contenteditable="false" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;margin:4px 0;border-radius:10px;border:1px solid rgba(129,140,248,0.35);background:rgba(129,140,248,0.08);cursor:pointer;user-select:none;">` +
        `<span style="font-size:18px;">📎</span>` +
        `<span style="font-size:13px;font-weight:600;color:#818cf8;">${result.originalName}</span>` +
        `<span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${formatBytes(result.size)}</span>` +
        `</div><br/>`;
      document.execCommand('insertHTML', false, html);
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    } catch {
      alert('Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>

        {/* Format */}
        <ToolBtn title="Negrilla (Ctrl+B)" onClick={() => exec('bold')}><Bold className="w-4 h-4" /></ToolBtn>
        <ToolBtn title="Cursiva (Ctrl+I)"  onClick={() => exec('italic')}><Italic className="w-4 h-4" /></ToolBtn>
        <ToolBtn title="Subrayado"          onClick={() => exec('underline')}><Underline className="w-4 h-4" /></ToolBtn>
        <Divider />

        {/* Font family */}
        <div className="relative">
          <button type="button" onMouseDown={e => { e.preventDefault(); saveRange(); setFontOpen(p => !p); setSizeOpen(false); setColorPicker(null); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs"
            style={{ color: 'var(--text-muted)', background: fontOpen ? 'rgba(129,140,248,0.1)' : undefined }}>
            <Type className="w-3.5 h-3.5" />Fuente<ChevronDown className="w-3 h-3" />
          </button>
          {fontOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
              {FONTS.map(f => (
                <button key={f} type="button" onMouseDown={e => { e.preventDefault(); setFont(f); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  style={{ fontFamily: f, color: 'var(--text-primary)' }}>{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* Font size */}
        <div className="relative">
          <button type="button" onMouseDown={e => { e.preventDefault(); saveRange(); setSizeOpen(p => !p); setFontOpen(false); setColorPicker(null); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs"
            style={{ color: 'var(--text-muted)', background: sizeOpen ? 'rgba(129,140,248,0.1)' : undefined }}>
            16px<ChevronDown className="w-3 h-3" />
          </button>
          {sizeOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 rounded-xl shadow-xl overflow-hidden min-w-[80px]"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
              {SIZES.map(s => (
                <button key={s} type="button" onMouseDown={e => { e.preventDefault(); setSize(s); }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}>{s}px</button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Color pickers */}
        <div className="relative">
          <ToolBtn title="Color de texto" onClick={() => { saveRange(); setColorPicker(p => p === 'text' ? null : 'text'); setSizeOpen(false); setFontOpen(false); }}>
            <Palette className="w-4 h-4" />
          </ToolBtn>
          {colorPicker === 'text' && (
            <div className="absolute top-full left-0 z-50 mt-1 p-2 rounded-xl shadow-xl grid grid-cols-5 gap-1"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
              {COLORS.map(c => (
                <button key={c} type="button" onMouseDown={e => { e.preventDefault(); setColor(c); }}
                  className="w-6 h-6 rounded-md border hover:scale-110 transition-transform"
                  style={{ background: c, borderColor: c === '#ffffff' ? 'var(--border-subtle)' : 'transparent' }} />
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <ToolBtn title="Color de fondo" onClick={() => { saveRange(); setColorPicker(p => p === 'bg' ? null : 'bg'); setSizeOpen(false); setFontOpen(false); }}>
            <span className="text-xs font-bold px-0.5" style={{ color: 'var(--text-muted)' }}>A</span>
          </ToolBtn>
          {colorPicker === 'bg' && (
            <div className="absolute top-full left-0 z-50 mt-1 p-2 rounded-xl shadow-xl grid grid-cols-5 gap-1"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
              {COLORS.map(c => (
                <button key={c} type="button" onMouseDown={e => { e.preventDefault(); setColor(c); }}
                  className="w-6 h-6 rounded-md border hover:scale-110 transition-transform"
                  style={{ background: c, borderColor: c === '#ffffff' ? 'var(--border-subtle)' : 'transparent' }} />
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Align */}
        <ToolBtn title="Izquierda"  onClick={() => exec('justifyLeft')}><AlignLeft    className="w-4 h-4" /></ToolBtn>
        <ToolBtn title="Centro"     onClick={() => exec('justifyCenter')}><AlignCenter  className="w-4 h-4" /></ToolBtn>
        <ToolBtn title="Derecha"    onClick={() => exec('justifyRight')}><AlignRight   className="w-4 h-4" /></ToolBtn>
        <ToolBtn title="Justificar" onClick={() => exec('justifyFull')}><AlignJustify className="w-4 h-4" /></ToolBtn>
        <Divider />

        {/* Lists */}
        <ToolBtn title="Lista viñetas"   onClick={() => exec('insertUnorderedList')}><List        className="w-4 h-4" /></ToolBtn>
        <ToolBtn title="Lista numerada"  onClick={() => exec('insertOrderedList')}><ListOrdered  className="w-4 h-4" /></ToolBtn>
        <Divider />

        {/* Image */}
        <ToolBtn title="Insertar imagen" onClick={() => { saveRange(); setImgModal(true); setFontOpen(false); setSizeOpen(false); setColorPicker(null); }}>
          <Image className="w-4 h-4" />
        </ToolBtn>

        {/* File attach — only shown when upload handler provided */}
        {onUploadFile && (
          <>
            <button
              type="button"
              title="Adjuntar archivo Excel / CSV (máx 30 MB)"
              disabled={uploading}
              onMouseDown={e => { e.preventDefault(); saveRange(); fileInputRef.current?.click(); }}
              className="p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs disabled:opacity-50"
              style={{ color: uploading ? '#818cf8' : 'var(--text-muted)' }}>
              {uploading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Paperclip className="w-4 h-4" />}
              {uploading && <span>Subiendo…</span>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        {/* Separator */}
        <ToolBtn title="Línea separadora" onClick={() => exec('insertHorizontalRule')}><Minus className="w-4 h-4" /></ToolBtn>

        {/* Clear */}
        <ToolBtn title="Limpiar formato" onClick={() => exec('removeFormat')}><Eraser className="w-4 h-4" /></ToolBtn>
      </div>

      {/* ── Editor area ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={saveRange}
        onKeyUp={saveRange}
        data-placeholder={placeholder}
        className="outline-none p-4 text-sm leading-relaxed rich-editor-content"
        style={{
          minHeight,
          color: 'var(--text-primary)',
          background: 'var(--card-bg)',
        }}
      />

      {/* ── Image URL modal ── */}
      {imgModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 shadow-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Insertar imagen</h3>
            <input
              type="url"
              placeholder="https://ejemplo.com/imagen.png"
              value={imgUrl}
              onChange={e => setImgUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && insertImage()}
              autoFocus
              className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setImgModal(false); setImgUrl(''); }}
                className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }}>
                Cancelar
              </button>
              <button type="button" onClick={insertImage}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: '#818cf8', color: '#fff' }}>
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rich-editor-content:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          opacity: 0.5;
          pointer-events: none;
        }
        .rich-editor-content img { max-width: 100%; }
        .rich-editor-content ul { list-style: disc; padding-left: 1.5em; }
        .rich-editor-content ol { list-style: decimal; padding-left: 1.5em; }
        .rich-editor-content hr { border-color: var(--border-subtle); margin: 1em 0; }
        .rich-editor-content .faq-attachment:hover { background: rgba(129,140,248,0.15) !important; }
      `}</style>
    </div>
  );
}
