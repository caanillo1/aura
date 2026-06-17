/**
 * Fixed-width table primitives for react-pdf.
 * All widths are explicit numbers — NO flex on cells.
 * Widths in a TR must sum to PAGE.contentWidth (523 pt) to avoid overflow/gaps.
 */
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N } from '../design/colors';
import { CELL } from '../design/spacing';

// ── Table wrapper ─────────────────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      borderWidth: 0.5, borderColor: N.gray200,
      borderRadius: 4, overflow: 'hidden',
    }}>
      {children}
    </View>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────
interface TRProps {
  children: React.ReactNode;
  /** true → header row (dark background) */
  isHeader?: boolean;
  /** true → light alternate row */
  isOdd?: boolean;
  /** override header background (company primary color) */
  bg?: string;
}
export function TR({ children, isHeader, isOdd, bg }: TRProps) {
  const bgColor = bg ?? (isOdd ? N.gray50 : N.white);
  return (
    <View
      wrap={false}
      style={{
        flexDirection: 'row',
        backgroundColor: isHeader ? (bg ?? '#1E3A5F') : bgColor,
        borderTopWidth: isHeader ? 0 : 0.5,
        borderTopColor: N.gray100,
        minHeight: isHeader ? 22 : 20,
      }}
    >
      {children}
    </View>
  );
}

// ── Table cell ────────────────────────────────────────────────────────────────
interface TCProps {
  /** exact column width in pt — must be explicit */
  w: number;
  children?: string | number | null;
  bold?: boolean;
  center?: boolean;
  right?: boolean;
  /** text color override (not used in header rows) */
  color?: string;
  /** marks this cell as a header cell */
  isHeader?: boolean;
}
export function TC({ w, children, bold, center, right, color, isHeader }: TCProps) {
  return (
    <View style={{
      width: w, maxWidth: w,
      paddingVertical: CELL.paddingV, paddingHorizontal: CELL.paddingH,
      overflow: 'hidden',
    }}>
      <Text style={{
        fontSize:    isHeader ? FS.label   : FS.table,
        fontFamily:  (bold || isHeader) ? F.bold : F.regular,
        color:       isHeader ? N.white : (color ?? N.gray700),
        textAlign:   center ? 'center' : right ? 'right' : 'left',
        letterSpacing: isHeader ? 0.5 : 0,
        lineHeight:  LH.normal,
      }}>
        {String(children ?? '—')}
      </Text>
    </View>
  );
}
