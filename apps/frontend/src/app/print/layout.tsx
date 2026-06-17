export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta name="color-scheme" content="light only" />
      <style dangerouslySetInnerHTML={{ __html: `
        /* Base reset */
        *, *::before, *::after { box-sizing: border-box; }
        :root { color-scheme: light only; }
        html, body { background: #fff !important; color: #111827 !important; }
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        /* Print rules — Puppeteer uses @media print automatically for page.pdf() */
        @page {
          size: A4 portrait;
          background: #ffffff;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin-top:    28mm;
            margin-bottom: 22mm;
            margin-left:   14mm;
            margin-right:  14mm;
            background: #ffffff;
          }

          /* Colour backgrounds must print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Cover page break */
          #ica-cover-capture { page-break-after: always !important; break-after: page !important; }

          /* Each acta on its own page */
          .ica-acta-break { page-break-before: always !important; break-before: page !important; }
          .ica-acta-capture { page-break-inside: avoid !important; break-inside: avoid !important; }

          /* Tables */
          table { border-collapse: collapse !important; }
          thead { display: table-header-group !important; }
          tr    { page-break-inside: avoid !important; break-inside: avoid !important; }

          /* KPI / info card rows */
          .ica-kpi-row, .ica-info-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Signature blocks */
          .ica-sig-block { page-break-inside: avoid !important; break-inside: avoid !important; }
          .ica-sig-img   { max-height: 45px !important; object-fit: contain !important; }
        }
      `}} />
      <div style={{ margin: 0, padding: 0, background: '#fff' }}>
        {children}
      </div>
    </>
  );
}
