/**
 * All column widths are FIXED (no flex).
 * Each entry's values must sum to exactly PAGE.contentWidth = 523 pt.
 */

// ── Activities (Plan de Trabajo) — 7 columns ─────────────────────────────────
// 82 + 72 + 70 + 130 + 82 + 25 + 62 = 523
export const W_ACTIVITIES = {
  modulo:      82,
  fase:        72,
  codigo:      70,
  actividad:  130,
  estado:      82,
  pct:         25,
  responsable: 62,
} as const;

// ── Actas summary — 7 columns ─────────────────────────────────────────────────
// 120 + 55 + 62 + 80 + 76 + 65 + 65 = 523
export const W_ACTAS_SUMMARY = {
  tipo:    120,
  numero:   55,
  fecha:    62,
  ciudad:   80,
  modulo:   76,
  estado:   65,
  firmas:   65,
} as const;

// ── Compromisos — 4 columns ───────────────────────────────────────────────────
// 28 + 228 + 152 + 115 = 523
export const W_COMPROMISOS = {
  num:         28,
  compromiso: 228,
  responsable:152,
  estado:     115,
} as const;

// ── Acciones — 3 columns ──────────────────────────────────────────────────────
// 270 + 150 + 103 = 523
export const W_ACCIONES = {
  accion:      270,
  responsable: 150,
  fecha:       103,
} as const;

// ── Participantes capacitación — 6 columns ────────────────────────────────────
// 28 + 155 + 122 + 100 + 60 + 58 = 523
export const W_PARTICIPANTES = {
  num:       28,
  nombre:   155,
  cargo:    122,
  documento:100,
  entrada:   60,
  salida:    58,
} as const;

// ── Fechas de visita — 3 columns ──────────────────────────────────────────────
// 175 + 174 + 174 = 523
export const W_FECHAS_VISITA = {
  fecha:   175,
  inicio:  174,
  fin:     174,
} as const;

// ── Actividades de acta visita — 5 columns ────────────────────────────────────
// 100 + 95 + 55 + 155 + 118 = 523
export const W_ACTA_ACTIVITIES = {
  modulo:   100,
  fase:      95,
  codigo:    55,
  actividad:155,
  estado:   118,
} as const;

// ── Checklist (sin medio) — 3 columns ────────────────────────────────────────
// 28 + 200 + 295 = 523
export const W_CHECKLIST = {
  check:  28,
  item:  200,
  obs:   295,
} as const;

// ── Checklist (con medio) — 4 columns ────────────────────────────────────────
// 28 + 185 + 215 + 95 = 523
export const W_CHECKLIST_MEDIO = {
  check:  28,
  item:  185,
  obs:   215,
  medio:  95,
} as const;

// ── Contactos de cierre — 3 columns ──────────────────────────────────────────
// 200 + 165 + 158 = 523
export const W_CONTACTOS = {
  nombre:  200,
  area:    165,
  telefono:158,
} as const;
