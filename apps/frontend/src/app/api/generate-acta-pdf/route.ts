import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ActaDocument } from '@/lib/pdf/ActaDocument';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { acta, company } = body;
    if (!acta) {
      return NextResponse.json({ error: 'Missing acta data' }, { status: 400 });
    }
    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(ActaDocument, { acta, company }) as any,
    );
    const tipo = acta.type ?? 'acta';
    const num  = acta.numero ?? 'doc';
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="acta-${tipo}-${num}.pdf"`,
        'Content-Length':      String(buffer.byteLength),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err: any) {
    console.error('[generate-acta-pdf]', err);
    return NextResponse.json({ error: err?.message ?? 'PDF generation failed' }, { status: 500 });
  }
}
