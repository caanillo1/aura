export const F = {
  regular:  'Helvetica',
  bold:     'Helvetica-Bold',
  oblique:  'Helvetica-Oblique',
} as const;

export const FS = {
  display: 34,  // cover main title
  h1:      18,  // major heading
  h2:      11,  // section heading
  h3:       9,  // card title
  body:     9,  // normal text
  table:    8,  // table cell text
  small:    7.5,
  label:    6.5, // uppercase label chips
  caption:  6,
} as const;

export const LH = {
  tight:   1.2,
  normal:  1.4,
  relaxed: 1.6,
} as const;
