export async function downloadActaPdf(elementId: string, filename = 'acta.pdf') {
  const html2canvas = (await import('html2canvas')).default;
  const jsPDF       = (await import('jspdf')).default;

  const root     = document.getElementById(elementId);
  const headerEl = document.getElementById('acta-header-bar');
  const bodyEl   = document.getElementById('acta-body-content');
  const sigEl    = document.getElementById('acta-firmantes-bar');
  const footerEl = document.getElementById('acta-footer-bar');

  if (!root || !headerEl || !bodyEl || !footerEl) return;

  // Force consistent A4-proportional width (794px ≈ 210mm @ 96dpi) regardless
  // of which container the component is rendered in (firmar page vs dashboard).
  const saved = {
    position: root.style.position,
    top:      root.style.top,
    left:     root.style.left,
    width:    root.style.width,
    minWidth: root.style.minWidth,
    maxWidth: root.style.maxWidth,
    zIndex:   root.style.zIndex,
  };
  Object.assign(root.style, {
    position: 'fixed',
    top:      '-9999px',
    left:     '-9999px',
    width:    '794px',
    minWidth: '794px',
    maxWidth: '794px',
    zIndex:   '-1',
  });
  // Two animation frames to let the browser reflow at the new width
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const scale = 1.5;
  const opts  = { scale, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false };

  const [hCanvas, bCanvas, fCanvas] = await Promise.all([
    html2canvas(headerEl, opts),
    html2canvas(bodyEl,   opts),
    html2canvas(footerEl, opts),
  ]);
  const sCanvas = sigEl ? await html2canvas(sigEl, opts) : null;

  const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const hH      = (hCanvas.height / hCanvas.width) * pageW;
  const fH      = (fCanvas.height / fCanvas.width) * pageW;
  const availH  = pageH - hH - fH - 1; // 1mm buffer
  const pxPerMm = bCanvas.width / pageW;
  const availPx = availH * pxPerMm;

  const sH      = sCanvas ? (sCanvas.height / sCanvas.width) * pageW : 0;

  // Restore original layout immediately after capture
  Object.assign(root.style, saved);

  const JPEG_Q   = 0.88;
  const hImgData = hCanvas.toDataURL('image/jpeg', JPEG_Q);
  const fImgData = fCanvas.toDataURL('image/jpeg', JPEG_Q);
  const sImgData = sCanvas?.toDataURL('image/jpeg', JPEG_Q) ?? null;

  // ── Smart page-break: scan backward from the nominal cut looking for a
  //    mostly-white row (gap between paragraphs). Returns cut position in px.
  const bCtx        = bCanvas.getContext('2d')!;
  const SCAN_PX     = Math.round(18 * pxPerMm); // scan back ~18 mm
  const SAMPLE_STEP = 6;                          // sample every 6th column
  const WHITE_THR   = 248;                        // pixel brightness threshold
  const WHITE_RATIO = 0.97;                       // fraction of row that must be white

  const findSmartCutPx = (nominalPx: number): number => {
    const start = Math.max(0, nominalPx - SCAN_PX);
    const len   = nominalPx - start;
    if (len <= 0) return nominalPx;

    const imgData  = bCtx.getImageData(0, start, bCanvas.width, len);
    const sampledW = Math.floor(bCanvas.width / SAMPLE_STEP);

    for (let row = len - 1; row >= 0; row--) {
      let whites = 0;
      for (let c = 0; c < bCanvas.width; c += SAMPLE_STEP) {
        const idx = (row * bCanvas.width + c) * 4;
        if (
          imgData.data[idx]     > WHITE_THR &&
          imgData.data[idx + 1] > WHITE_THR &&
          imgData.data[idx + 2] > WHITE_THR
        ) whites++;
      }
      if (whites / sampledW >= WHITE_RATIO) return start + row;
    }
    return nominalPx; // no good break found → use nominal
  };

  // ── Build page slices ────────────────────────────────────────────────────────
  const pages: { srcYpx: number; heightPx: number }[] = [];
  let curPx = 0;

  while (curPx < bCanvas.height) {
    const nominalEndPx = Math.round(curPx + availPx);
    if (nominalEndPx >= bCanvas.height) {
      pages.push({ srcYpx: curPx, heightPx: bCanvas.height - curPx });
      break;
    }
    const cutPx = findSmartCutPx(nominalEndPx);
    pages.push({ srcYpx: curPx, heightPx: cutPx - curPx });
    curPx = cutPx;
  }

  // ── Decide whether signatures need a new page ────────────────────────────────
  const sigNeedsNewPage = sCanvas && sH > 0 && pages.length > 0 && (() => {
    const last  = pages[pages.length - 1];
    const usedH = (last.heightPx / pxPerMm);
    return (availH - usedH) < sH;
  })();

  const totalPages = pages.length + (sigNeedsNewPage ? 1 : 0);
  let   currentPage = 0;

  // ── Page chrome (header + footer + page number) ──────────────────────────────
  const addPageChrome = () => {
    currentPage++;
    pdf.addImage(hImgData, 'JPEG', 0, 0, pageW, hH);
    pdf.addImage(fImgData, 'JPEG', 0, pageH - fH, pageW, fH);
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Página ${currentPage} de ${totalPages}`, pageW - 8, pageH - fH / 2, { align: 'right' });
  };

  // ── Draw a slice of the body canvas ─────────────────────────────────────────
  const addBodySlice = (srcYpx: number, heightPx: number, destYmm: number) => {
    if (heightPx <= 0 || srcYpx >= bCanvas.height) return;
    const h  = Math.min(heightPx, bCanvas.height - srcYpx);
    const sc = document.createElement('canvas');
    sc.width  = bCanvas.width;
    sc.height = h;
    const ctx = sc.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sc.width, sc.height);
    ctx.drawImage(bCanvas, 0, srcYpx, bCanvas.width, h, 0, 0, bCanvas.width, h);
    pdf.addImage(sc.toDataURL('image/jpeg', JPEG_Q), 'JPEG', 0, destYmm, pageW, h / pxPerMm);
  };

  // ── Render body pages ────────────────────────────────────────────────────────
  addPageChrome();
  for (let p = 0; p < pages.length; p++) {
    if (p > 0) { pdf.addPage(); addPageChrome(); }
    const { srcYpx, heightPx } = pages[p];
    addBodySlice(srcYpx, heightPx, hH);
  }

  // ── Render signatures ────────────────────────────────────────────────────────
  if (sCanvas && sImgData && sH > 0) {
    const last      = pages[pages.length - 1];
    const usedH     = last.heightPx / pxPerMm;

    if (!sigNeedsNewPage) {
      pdf.addImage(sImgData, 'JPEG', 0, hH + usedH, pageW, sH);
    } else {
      pdf.addPage();
      addPageChrome();
      pdf.addImage(sImgData, 'JPEG', 0, hH, pageW, sH);
    }
  }

  pdf.save(filename);
}
