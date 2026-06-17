// ── Neutral palette ──────────────────────────────────────────────────────────
export const N = {
  white:   '#ffffff',
  gray50:  '#f9fafb',
  gray100: '#f3f4f6',
  gray150: '#ebebec',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
} as const;

// ── Dynamic brand helpers ─────────────────────────────────────────────────────
export function hexToRgb(h: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [30, 58, 95];
}
export function luminance(h: string) {
  const [r, g, b] = hexToRgb(h).map(c => {
    const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const textOn = (bg: string) => luminance(bg) > 0.35 ? N.gray900 : N.white;
export const alpha = (h: string, a: number) => {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
};
export const lighten = (h: string, amt = 0.92) => {
  const [r, g, b] = hexToRgb(h);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

// ── Status semantic colours ───────────────────────────────────────────────────
export interface SemanticColor { text: string; bg: string; border: string }
const SC: Record<string, SemanticColor> = {
  completado:  { text: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  completada:  { text: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  firmada:     { text: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  activo:      { text: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  cumplido:    { text: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
  en_progreso: { text: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  en_curso:    { text: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  en_proceso:  { text: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  pendiente:   { text: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  borrador:    { text: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  suspendida:  { text: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  cancelada:   { text: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  bloqueado:   { text: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
};
const FALLBACK_SC: SemanticColor = { text: N.gray700, bg: N.gray100, border: N.gray300 };
export const statusColor = (s?: string | null): SemanticColor =>
  SC[s ?? ''] ?? FALLBACK_SC;

// ── Note level colours ────────────────────────────────────────────────────────
export const NOTE_COLOR: Record<string, SemanticColor> = {
  critica: { text: '#991b1b', bg: '#fff5f5',  border: '#fca5a5' },
  alta:    { text: '#92400e', bg: '#fffbeb',  border: '#fcd34d' },
  media:   { text: '#1e40af', bg: '#eff6ff',  border: '#93c5fd' },
  baja:    { text: '#166534', bg: '#f0fdf4',  border: '#86efac' },
};
export const noteColor = (l?: string | null): SemanticColor =>
  NOTE_COLOR[l ?? ''] ?? FALLBACK_SC;

// ── Label maps ────────────────────────────────────────────────────────────────
export const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En Curso', suspendida: 'Suspendida',
  completada: 'Completada', cancelada: 'Cancelada', activo: 'Activo',
  completado: 'Completado', borrador: 'Borrador', firmada: 'Firmada',
  en_progreso: 'En Progreso', bloqueado: 'Bloqueado', en_proceso: 'En Proceso',
  cumplido: 'Cumplido',
};
export const TIPO_LABEL: Record<string, string> = {
  inicio: 'Acta de Inicio', visita: 'Acta de Visita',
  capacitacion: 'Acta de Capacitacion', cierre: 'Acta de Cierre',
  entrega_soporte: 'Entrega a Soporte',
};
export const TIPO_SHORT: Record<string, string> = {
  inicio: 'Inicio', visita: 'Visita', capacitacion: 'Capacitacion',
  cierre: 'Cierre', entrega_soporte: 'Soporte',
};
