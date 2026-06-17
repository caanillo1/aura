// ── Page geometry (A4 = 595 × 842 pt) ────────────────────────────────────────
export const PAGE = {
  width:         595,
  height:        842,
  paddingH:       36,   // left + right
  paddingTop:     60,   // space reserved for fixed header
  paddingBottom:  50,   // space reserved for fixed footer
  /** usable horizontal content width = 595 - 36×2 = 523 pt */
  contentWidth:  523,
} as const;

// ── Spacing scale ─────────────────────────────────────────────────────────────
export const SP = {
  1:  4,
  2:  8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

// ── Table cell padding ────────────────────────────────────────────────────────
export const CELL = {
  paddingV: 5,
  paddingH: 8,
} as const;

// ── Section gap (between top-level sections on the body page) ─────────────────
export const SECTION_GAP = 22;
