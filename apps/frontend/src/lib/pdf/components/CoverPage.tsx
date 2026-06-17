import React from 'react';
import { Page, View, Text, Image, Svg, Circle } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N, textOn, lighten, alpha, STATUS_LABEL } from '../design/colors';

interface Props {
  company: any;
  os: any;
  actas: any[];
  notes: any[];
  personalCapacitado: any[];
  personalEnProceso: any[];
  project: any;
  generatedAt: string;
  reportTitle: string;
  pc: string;
  sc: string;
  onPc: string;
  progressPct: number;
  doneActs: number;
  inProgActs: number;
  blockedActs: number;
  pendActs: number;
  totalActs: number;
}

const fmt = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};
const fmtLong = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric',
  });
};

function ProgressRing({ pct, color, size = 68 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (Math.min(pct, 100) / 100) * circ;
  const c    = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={alpha(color, 0.2)} strokeWidth={8} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        {...({ strokeDashoffset: `${dash}`, transform: `rotate(-90,${c},${c})` } as any)}
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Text {...({ x: c, y: c + 1, textAnchor: 'middle', dominantBaseline: 'middle',
        fill: color, fontSize: size * 0.22, fontWeight: 'bold' } as any)}>
        {pct}%
      </Text>
    </Svg>
  );
}

function KpiBox({ label, value, sub, color, bg }: {
  label: string; value: string; sub?: string; color: string; bg: string;
}) {
  return (
    <View style={{
      padding: '10 12', backgroundColor: bg, borderRadius: 6,
      borderWidth: 0.5, borderColor: alpha(color, 0.2),
      borderLeftWidth: 3, borderLeftColor: color,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <Text style={{ fontSize: 22, fontFamily: F.bold, color, lineHeight: 1 }}>{value}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, textTransform: 'uppercase',
          letterSpacing: 0.5, color, lineHeight: LH.tight }}>{label}</Text>
        {sub ? <Text style={{ fontSize: FS.caption, color, marginTop: 2, opacity: 0.75 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function StatusPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: '8 6',
      backgroundColor: bg, borderRadius: 6, borderWidth: 0.5, borderColor: alpha(color, 0.25) }}>
      <Text style={{ fontSize: 16, fontFamily: F.bold, color, lineHeight: 1 }}>
        {label.split(' ')[0]}
      </Text>
      <Text style={{ fontSize: FS.caption + 0.5, fontFamily: F.bold, textTransform: 'uppercase',
        letterSpacing: 0.5, color, marginTop: 3, textAlign: 'center' }}>
        {label.split(' ').slice(1).join(' ')}
      </Text>
    </View>
  );
}

export function CoverPage({
  company, os, actas, notes, personalCapacitado, personalEnProceso,
  project, generatedAt, reportTitle, pc, sc, onPc,
  progressPct, doneActs, inProgActs, blockedActs, pendActs, totalActs,
}: Props) {
  const nom      = company?.commercialName ?? company?.name ?? '';
  const firmadas = actas.filter((a: any) => a.status === 'firmada').length;
  const critNotes= notes.filter((n: any) => n.noteLevel === 'critica').length;

  return (
    <Page size="A4" style={{ backgroundColor: N.white, fontFamily: F.regular, padding: 0 }}>

      {/* ── Thin top accent ── */}
      <View style={{ height: 4, flexDirection: 'row' }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: sc }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>

      {/* ── Main content ── */}
      <View style={{ flex: 1, padding: '28 36 20 36', flexDirection: 'column', gap: 18 }}>

        {/* Row 1: Logo + Company + Report label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {company?.logoData
            ? <Image src={company.logoData} style={{ height: 30, maxWidth: 88, objectFit: 'contain' }} />
            : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: F.bold, color: N.gray900 }}>{nom}</Text>
            {[company?.nit ? `NIT: ${company.nit}` : null, company?.city, company?.email]
              .filter(Boolean).length > 0 && (
              <Text style={{ fontSize: FS.label, color: N.gray400, marginTop: 2 }}>
                {[company?.nit ? `NIT: ${company.nit}` : null, company?.city, company?.email]
                  .filter(Boolean).join('  ·  ')}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, fontFamily: F.bold, color: pc, textTransform: 'uppercase',
              letterSpacing: 0.8 }}>{reportTitle}</Text>
            <Text style={{ fontSize: FS.label, color: N.gray400, marginTop: 2 }}>
              Generado: {fmtLong(generatedAt)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 0.5, backgroundColor: N.gray200 }} />

        {/* Row 2: Title + KPIs */}
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>

          {/* Left: Title block */}
          <View style={{ flex: 1.2 }}>
            <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 2, color: N.gray400, marginBottom: 6 }}>
              DOCUMENTO EJECUTIVO CONFIDENCIAL
            </Text>
            <Text style={{ fontSize: FS.display, fontFamily: F.bold, color: N.gray900,
              lineHeight: LH.tight, letterSpacing: -0.5 }}>
              {reportTitle.includes('Actas') ? 'Informe\nEjecutivo\ncon Actas' : 'Informe\nEjecutivo'}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 5 }}>
              <View style={{ width: 54, height: 4, backgroundColor: pc, borderRadius: 2 }} />
              <View style={{ width: 22, height: 4, backgroundColor: sc, borderRadius: 2 }} />
              <View style={{ width: 10, height: 4, backgroundColor: N.gray200, borderRadius: 2 }} />
            </View>

            {/* Client block */}
            <View style={{ marginTop: 20, borderLeftWidth: 4, borderLeftColor: pc,
              paddingLeft: 14, paddingVertical: 10,
              backgroundColor: lighten(pc, 0.95), borderRadius: '0 6 6 0' }}>
              <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
                letterSpacing: 1.2, color: N.gray400, marginBottom: 4 }}>PREPARADO PARA</Text>
              <Text style={{ fontSize: 20, fontFamily: F.bold, color: pc, lineHeight: LH.tight }}>
                {os.client?.businessName ?? '—'}
              </Text>
              {os.client?.nit && (
                <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 4 }}>
                  NIT: {os.client.nit}
                </Text>
              )}
            </View>
          </View>

          {/* Right: KPIs */}
          <View style={{ flex: 1, gap: 8 }}>
            {/* Progress ring */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
              padding: 14, backgroundColor: N.gray50, borderRadius: 8,
              borderWidth: 0.5, borderColor: alpha(pc, 0.18) }}>
              <ProgressRing pct={progressPct} color={pc} size={68} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: F.bold, color: N.gray900 }}>Avance Global</Text>
                <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 3 }}>
                  {doneActs} / {totalActs} actividades
                </Text>
                <View style={{ marginTop: 8, height: 5, backgroundColor: N.gray200, borderRadius: 3 }}>
                  <View style={{ height: 5, width: `${Math.min(progressPct, 100)}%`,
                    backgroundColor: pc, borderRadius: 3 }} />
                </View>
              </View>
            </View>
            <KpiBox label="Actas Registradas" value={String(actas.length)}
              sub={`${firmadas} firmadas`} color={sc} bg={lighten(sc, 0.93)} />
            <KpiBox label="Personal Capacitado" value={String(personalCapacitado.length)}
              sub={`${personalEnProceso.length} en proceso`}
              color="#059669" bg="#f0fdf4" />
            <KpiBox label="Duracion" value={os.durationDays ? `${os.durationDays}d` : '—'}
              sub={`${fmt(os.startDate)} → ${fmt(os.endDate)}`}
              color="#6366f1" bg="#f5f3ff" />
            {critNotes > 0 && (
              <KpiBox label="Notas Criticas" value={String(critNotes)}
                sub="requieren atencion"
                color="#dc2626" bg="#fff5f5" />
            )}
          </View>
        </View>

        {/* Row 3: Activity status pills */}
        <View>
          <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
            letterSpacing: 1, color: N.gray400, marginBottom: 7 }}>
            RESUMEN DE ACTIVIDADES
          </Text>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <StatusPill label={`${doneActs} Completadas`}   color="#065f46" bg="#d1fae5" />
            <StatusPill label={`${inProgActs} En Progreso`} color="#1e40af" bg="#dbeafe" />
            <StatusPill label={`${blockedActs} Bloqueadas`} color="#991b1b" bg="#fee2e2" />
            <StatusPill label={`${pendActs} Pendientes`}    color="#92400e" bg="#fef3c7" />
          </View>
        </View>

        {/* Row 4: Metadata grid */}
        <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: N.gray200, borderRadius: 6 }}>
          {([
            { l: 'No. Orden',  v: os.osNumber },
            { l: 'Servicio',   v: os.product  },
            { l: 'Estado',     v: STATUS_LABEL[os.status] ?? os.status },
            { l: 'Inicio',     v: fmt(os.startDate) },
            { l: 'Fin',        v: fmt(os.endDate)   },
          ] as { l: string; v: string }[]).map(({ l, v }, i, arr) => (
            <View key={l} style={{ flex: 1, padding: '10 10',
              borderRightWidth: i < arr.length - 1 ? 0.5 : 0, borderRightColor: N.gray100,
              backgroundColor: i % 2 === 0 ? N.gray50 : N.white }}>
              <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
                letterSpacing: 0.8, color: N.gray400, marginBottom: 3 }}>{l}</Text>
              <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: N.gray900 }}>{v}</Text>
            </View>
          ))}
        </View>

      </View>

      {/* ── Bottom colour bar ── */}
      <View style={{ height: 8, flexDirection: 'row' }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: sc }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>
    </Page>
  );
}
