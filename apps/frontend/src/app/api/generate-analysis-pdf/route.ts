import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { AnalisisPdfDocument } from '@/lib/pdf/AnalisisPdfDocument';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, company } = body;
    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(AnalisisPdfDocument, { data, company }) as any
    );
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[generate-analysis-pdf]', err);
    return NextResponse.json({ error: err?.message ?? 'PDF generation failed' }, { status: 500 });
  }
}
