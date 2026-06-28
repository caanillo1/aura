import React from 'react';
import { Page, View, Text, Image, Svg, Circle } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N, alpha, lighten, STATUS_LABEL } from '../design/colors';

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

function ProgressRing({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) {
  const stroke = size > 80 ? 10 : 8;
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (Math.min(pct, 100) / 100) * circ;
  const c    = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={alpha(color, 0.15)} strokeWidth={stroke} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${circ}`}
        {...({ strokeDashoffset: `${dash}`, transform: `rotate(-90,${c},${c})` } as any)}
      />
      <Text {...({
        x: c, y: c - 3, textAnchor: 'middle', dominantBaseline: 'middle',
        fill: color, fontSize: Math.round(size * 0.24), fontWeight: 'bold',
      } as any)}>
        {pct}%
      </Text>
      <Text {...({
        x: c, y: c + size * 0.18, textAnchor: 'middle', dominantBaseline: 'middle',
        fill: color, fontSize: Math.round(size * 0.095), fontFamily: 'Helvetica',
        opacity: 0.65,
      } as any)}>
        AVANCE
      </Text>
    </Svg>
  );
}

export function CoverPage({
  company, os, actas, notes, personalCapacitado, personalEnProceso,
  project, generatedAt, reportTitle, pc, sc, onPc,
  progressPct, doneActs, inProgActs, blockedActs, pendActs, totalActs,
}: Props) {
  const nom      = company?.commercialName ?? company?.name ?? '';
  const firmadas = actas.filter((a: any) => a.status === 'firmada').length;

  return (
    <Page size="A4" style={{ fontFamily: F.regular, padding: 0, flexDirection: 'row' }}>

      {/* ══════════════════════════════════════════════════════
          PANEL IZQUIERDO — identidad de marca
      ══════════════════════════════════════════════════════ */}
      <View style={{ width: 205, backgroundColor: pc, flexDirection: 'column' }}>
        <View style={{ flex: 1, paddingTop: 34, paddingHorizontal: 24, paddingBottom: 0, flexDirection: 'column' }}>

          {/* Company name */}
          <Text style={{
            fontSize: 7.5, fontFamily: F.bold, color: alpha(onPc, 0.55),
            textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 4,
          }}>
            {nom}
          </Text>
          {company?.nit && (
            <Text style={{ fontSize: 6.5, color: alpha(onPc, 0.38), marginBottom: 32 }}>
              NIT: {company.nit}
            </Text>
          )}
          {!company?.nit && <View style={{ height: 32 }} />}

          {/* Micro label */}
          <Text style={{
            fontSize: 5.5, fontFamily: F.bold, color: alpha(onPc, 0.4),
            textTransform: 'uppercase', letterSpacing: 3, marginBottom: 14,
          }}>
            DOCUMENTO EJECUTIVO CONFIDENCIAL
          </Text>

          {/* Report title — hero typography */}
          <Text style={{
            fontSize: 40, fontFamily: F.bold, color: onPc,
            lineHeight: 1.05, letterSpacing: -0.5,
          }}>
            {reportTitle.includes('Actas') ? 'Informe\nEjecutivo\ncon Actas' : 'Informe\nEjecutivo'}
          </Text>

          {/* Accent divider */}
          <View style={{ flexDirection: 'row', marginTop: 18, marginBottom: 30, gap: 4 }}>
            <View style={{ flex: 1, height: 2, backgroundColor: alpha(onPc, 0.2), borderRadius: 1 }} />
            <View style={{ width: 28, height: 2, backgroundColor: sc, borderRadius: 1 }} />
          </View>

          {/* Prepared for */}
          <Text style={{
            fontSize: 5.5, fontFamily: F.bold, color: alpha(onPc, 0.4),
            textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 10,
          }}>
            PREPARADO PARA
          </Text>
          <Text style={{
            fontSize: 20, fontFamily: F.bold, color: onPc,
            lineHeight: 1.2, marginBottom: 8,
          }}>
            {os.client?.businessName ?? '—'}
          </Text>
          {os.client?.nit && (
            <Text style={{ fontSize: 6.5, color: alpha(onPc, 0.45), marginBottom: 4 }}>
              NIT: {os.client.nit}
            </Text>
          )}

          {/* Flex spacer */}
          <View style={{ flex: 1 }} />

          {/* OS metadata at bottom */}
          <View style={{
            borderTopWidth: 0.5, borderTopColor: alpha(onPc, 0.15),
            paddingTop: 16, paddingBottom: 20, gap: 7,
          }}>
            {[
              { l: 'No. Orden',  v: os.osNumber },
              ...(os.product ? [{ l: 'Servicio', v: os.product }] : []),
              ...(os.startDate ? [{ l: 'Inicio', v: fmt(os.startDate) }] : []),
              { l: 'Generado',  v: fmtLong(generatedAt) },
            ].map(({ l, v }) => (
              <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <Text style={{ fontSize: 5.5, color: alpha(onPc, 0.38), textTransform: 'uppercase', letterSpacing: 0.7, flexShrink: 0 }}>{l}</Text>
                <Text style={{ fontSize: 6.5, fontFamily: F.bold, color: alpha(onPc, 0.7), textAlign: 'right', flex: 1 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom accent strip */}
        <View style={{ height: 7, backgroundColor: sc }} />
      </View>

      {/* ══════════════════════════════════════════════════════
          PANEL DERECHO — métricas y datos
      ══════════════════════════════════════════════════════ */}
      <View style={{ flex: 1, flexDirection: 'column', backgroundColor: N.white }}>

        {/* Top: logo + label */}
        <View style={{
          paddingHorizontal: 28, paddingTop: 26, paddingBottom: 16,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          borderBottomWidth: 0.5, borderBottomColor: N.gray100,
        }}>
          <View style={{ flex: 1 }}>
            {company?.logoData
              ? <Image src={company.logoData} style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
              : <Text style={{ fontSize: 9, fontFamily: F.bold, color: N.gray900 }}>{nom}</Text>
            }
          </View>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 4,
            backgroundColor: alpha(pc, 0.08), borderRadius: 4,
          }}>
            <Text style={{
              fontSize: 6, fontFamily: F.bold, color: pc,
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              CONFIDENCIAL
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 22, gap: 16 }}>

          {/* HERO: progreso global */}
          <View style={{
            backgroundColor: alpha(pc, 0.03), borderRadius: 10,
            borderWidth: 1, borderColor: alpha(pc, 0.1),
            padding: 18, flexDirection: 'row', alignItems: 'center', gap: 20,
          }}>
            <ProgressRing pct={progressPct} color={pc} size={92} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: F.bold, color: N.gray900, marginBottom: 5 }}>
                Avance Global del Proyecto
              </Text>
              <Text style={{ fontSize: 7.5, color: N.gray500, lineHeight: LH.normal, marginBottom: 12 }}>
                {doneActs} de {totalActs} actividades completadas
              </Text>
              <View style={{ height: 5, backgroundColor: N.gray200, borderRadius: 3 }}>
                <View style={{
                  height: 5, width: `${Math.min(progressPct, 100)}%`,
                  backgroundColor: pc, borderRadius: 3,
                }} />
              </View>
            </View>
          </View>

          {/* KPI row */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Actas',       value: String(actas.length),              sub: `${firmadas} firmadas`,                    color: sc },
              { label: 'Capacitados', value: String(personalCapacitado.length), sub: `${personalEnProceso.length} en proceso`,  color: '#059669' },
              { label: 'Duración',    value: os.durationDays ? `${os.durationDays}d` : '—',
                sub: `${fmt(os.startDate)} → ${fmt(os.endDate)}`, color: '#6366f1' },
            ].map(({ label, value, sub, color }) => (
              <View key={label} style={{
                flex: 1,
                paddingTop: 12, paddingHorizontal: 12, paddingBottom: 10,
                borderRadius: 8,
                borderTopWidth: 3, borderTopColor: color,
                borderWidth: 0.5, borderColor: N.gray150,
                backgroundColor: N.white,
              }}>
                <Text style={{ fontSize: 26, fontFamily: F.bold, color, lineHeight: 1, marginBottom: 5 }}>{value}</Text>
                <Text style={{
                  fontSize: 6, fontFamily: F.bold, color: N.gray700,
                  textTransform: 'uppercase', letterSpacing: 0.7,
                }}>{label}</Text>
                {sub && <Text style={{ fontSize: 6, color: N.gray400, marginTop: 3 }}>{sub}</Text>}
              </View>
            ))}
          </View>

          {/* Activity pills */}
          <View>
            <Text style={{
              fontSize: 5.5, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 1.8, color: N.gray400, marginBottom: 8,
            }}>
              ESTADO DE ACTIVIDADES
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: 'Completadas', value: doneActs,    color: '#065f46', bg: '#d1fae5' },
                { label: 'En Progreso', value: inProgActs,  color: '#1e40af', bg: '#dbeafe' },
                { label: 'Bloqueadas',  value: blockedActs, color: '#991b1b', bg: '#fee2e2' },
                { label: 'Pendientes',  value: pendActs,    color: '#92400e', bg: '#fef3c7' },
              ].map(({ label, value, color, bg }) => (
                <View key={label} style={{
                  flex: 1, paddingVertical: 10, paddingHorizontal: 6,
                  backgroundColor: bg, borderRadius: 8, alignItems: 'center',
                  borderWidth: 0.5, borderColor: alpha(color, 0.18),
                }}>
                  <Text style={{ fontSize: 22, fontFamily: F.bold, color, lineHeight: 1, marginBottom: 5 }}>{value}</Text>
                  <Text style={{
                    fontSize: 5.5, fontFamily: F.bold, color,
                    textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center',
                  }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Metadata grid */}
          <View style={{
            flexDirection: 'row', borderRadius: 7,
            borderWidth: 0.5, borderColor: N.gray150, overflow: 'hidden',
          }}>
            {([
              { l: 'N° Orden',  v: os.osNumber },
              { l: 'Servicio',  v: os.product ?? '—' },
              { l: 'Estado',    v: STATUS_LABEL[os.status] ?? os.status },
              { l: 'Inicio',    v: fmt(os.startDate) },
              { l: 'Fin',       v: fmt(os.endDate) },
            ] as { l: string; v: string }[]).map(({ l, v }, i, arr) => (
              <View key={l} style={{
                flex: 1, padding: '11 9',
                backgroundColor: i % 2 === 0 ? N.gray50 : N.white,
                borderRightWidth: i < arr.length - 1 ? 0.5 : 0,
                borderRightColor: N.gray150,
              }}>
                <Text style={{
                  fontSize: 5.5, fontFamily: F.bold, textTransform: 'uppercase',
                  letterSpacing: 0.8, color: N.gray400, marginBottom: 4,
                }}>{l}</Text>
                <Text style={{ fontSize: 8, fontFamily: F.bold, color: N.gray800 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 7, backgroundColor: N.gray50 }} />
      </View>

    </Page>
  );
}
