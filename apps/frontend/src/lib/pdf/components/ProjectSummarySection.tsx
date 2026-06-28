import React from 'react';
import { View, Text, Svg, Circle } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N, alpha, lighten } from '../design/colors';
import { SectionTitle } from './SectionTitle';

interface TipoProgress { asistencial?: number | null; financiero?: number | null; mixto?: number | null; }

interface Props {
  pc: string;
  onPc: string;
  sectionNum: string;
  progressPct: number;
  totalActs: number;
  doneActs: number;
  inProgActs: number;
  blockedActs: number;
  pendActs: number;
  actas: any[];
  personalCapacitado: any[];
  personalEnProceso: any[];
  os: any;
  tipoProgress?: TipoProgress;
}

const fmt = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

function ProgressRing({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const stroke = 9;
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
      <Text {...({ x: c, y: c + 1, textAnchor: 'middle', dominantBaseline: 'middle',
        fill: color, fontSize: Math.round(size * 0.22), fontWeight: 'bold' } as any)}>
        {pct}%
      </Text>
    </Svg>
  );
}

export function ProjectSummarySection({
  pc, onPc, sectionNum, progressPct, totalActs, doneActs, inProgActs, blockedActs,
  pendActs, actas, personalCapacitado, personalEnProceso, os, tipoProgress,
}: Props) {
  const firmadas = actas.filter((a: any) => a.status === 'firmada').length;

  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Resumen Ejecutivo del Proyecto" pc={pc} onPc={onPc} />

      {/* Progress ring + KPI cards */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'stretch' }}>

        {/* Progress ring */}
        <View style={{
          backgroundColor: alpha(pc, 0.04), borderRadius: 9,
          borderWidth: 1, borderColor: alpha(pc, 0.12),
          padding: '14 16', flexDirection: 'row', alignItems: 'center', gap: 14,
        }}>
          <ProgressRing pct={progressPct} color={pc} size={64} />
          <View>
            <Text style={{ fontSize: 9.5, fontFamily: F.bold, color: N.gray900 }}>Avance Global</Text>
            <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 3 }}>
              {doneActs} de {totalActs} actividades
            </Text>
            <View style={{ marginTop: 8, height: 4, width: 110, backgroundColor: N.gray200, borderRadius: 2 }}>
              <View style={{ height: 4, width: `${Math.min(progressPct, 100)}%`,
                backgroundColor: pc, borderRadius: 2 }} />
            </View>
          </View>
        </View>

        {/* KPI cards */}
        {[
          { label: 'Actas',       value: String(actas.length),              sub: `${firmadas} firmadas`,                   color: '#2563eb' },
          { label: 'Capacitados', value: String(personalCapacitado.length), sub: `${personalEnProceso.length} en proceso`, color: '#059669' },
          { label: 'Días',
            value: os.durationDays ? String(os.durationDays) : '—',
            sub: `${fmt(os.startDate)} / ${fmt(os.endDate)}`,
            color: '#6366f1' },
        ].map(({ label, value, sub, color }) => (
          <View key={label} style={{
            flex: 1,
            paddingTop: 12, paddingHorizontal: 12, paddingBottom: 10,
            borderRadius: 9,
            borderTopWidth: 3, borderTopColor: color,
            borderWidth: 0.5, borderColor: N.gray150,
            backgroundColor: N.white,
          }}>
            <Text style={{ fontSize: 26, fontFamily: F.bold, color, lineHeight: 1, marginBottom: 5 }}>{value}</Text>
            <Text style={{ fontSize: 6, fontFamily: F.bold, color: N.gray700,
              textTransform: 'uppercase', letterSpacing: 0.7 }}>{label}</Text>
            {sub && <Text style={{ fontSize: FS.caption + 0.5, color: N.gray400, marginTop: 3 }}>{sub}</Text>}
          </View>
        ))}
      </View>

      {/* Status pills */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: tipoProgress ? 10 : 0 }}>
        {[
          { label: `${doneActs} Completadas`,   color: '#065f46', bg: '#d1fae5' },
          { label: `${inProgActs} En Progreso`, color: '#1e40af', bg: '#dbeafe' },
          { label: `${blockedActs} Bloqueadas`, color: '#991b1b', bg: '#fee2e2' },
          { label: `${pendActs} Pendientes`,    color: '#92400e', bg: '#fef3c7' },
        ].map(({ label, color, bg }) => (
          <View key={label} style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20,
            backgroundColor: bg, borderWidth: 0.5, borderColor: alpha(color, 0.2),
          }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
            <Text style={{ fontSize: FS.small, fontFamily: F.bold, color }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Tipo breakdown */}
      {tipoProgress && (() => {
        const rows = [
          { key: 'asistencial', label: 'Asistencial', color: '#2563eb' },
          { key: 'financiero',  label: 'Financiero',  color: '#059669' },
          { key: 'mixto',       label: 'Mixto',       color: '#7c3aed' },
        ].filter(r => tipoProgress[r.key as keyof TipoProgress] != null);
        if (!rows.length) return null;
        return (
          <View style={{
            marginTop: 2, padding: '10 12',
            backgroundColor: N.gray50, borderRadius: 7,
            borderWidth: 0.5, borderColor: N.gray150,
          }}>
            <Text style={{
              fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 1, color: N.gray400, marginBottom: 9,
            }}>
              AVANCE POR TIPO DE MÓDULO
            </Text>
            {rows.map(({ key, label, color }) => {
              const pct = tipoProgress[key as keyof TipoProgress] ?? 0;
              return (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: FS.small, fontFamily: F.bold, color, width: 62 }}>{label}</Text>
                  <View style={{ flex: 1, height: 5, backgroundColor: N.gray200, borderRadius: 3 }}>
                    <View style={{ height: 5, width: `${Math.min(pct, 100)}%`, backgroundColor: color, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: FS.small, fontFamily: F.bold, color, width: 28, textAlign: 'right' }}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        );
      })()}
    </View>
  );
}
