import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PlanTrabajoDocument } from '@/lib/pdf/PlanTrabajoDocument';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data } = body;
    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }
    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(PlanTrabajoDocument, { data }) as any,
    );
    const osNum = data?.os?.osNumber ?? 'doc';
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="plan-trabajo-${osNum}.pdf"`,
        'Content-Length':      String(buffer.byteLength),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err: any) {
    console.error('[generate-plan-trabajo]', err);
    return NextResponse.json({ error: err?.message ?? 'PDF generation failed' }, { status: 500 });
  }
}
