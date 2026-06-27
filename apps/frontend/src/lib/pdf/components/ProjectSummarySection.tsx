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

function ProgressRing({ pct, color, size = 60 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (Math.min(pct, 100) / 100) * circ;
  const c    = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={alpha(color, 0.2)} strokeWidth={8} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round" strokeDasharray={`${circ}`}
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

function KpiCard({ label, value, sub, color, bg }: {
  label: string; value: string; sub?: string; color: string; bg: string;
}) {
  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: bg, borderRadius: 6,
      borderWidth: 0.5, borderColor: alpha(color, 0.2) }}>
      <Text style={{ fontSize: 24, fontFamily: F.bold, color, lineHeight: 1 }}>{value}</Text>
      <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, textTransform: 'uppercase',
        letterSpacing: 0.5, color, marginTop: 4 }}>{label}</Text>
      {sub ? <Text style={{ fontSize: FS.caption + 0.5, color, marginTop: 2, opacity: 0.7 }}>{sub}</Text> : null}
    </View>
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

      {/* Progress + KPIs row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'stretch' }}>
        {/* Circular + bar */}
        <View style={{ padding: '12 16', backgroundColor: N.white, borderRadius: 8,
          borderWidth: 0.5, borderColor: alpha(pc, 0.2), borderTopWidth: 3, borderTopColor: pc,
          flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <ProgressRing pct={progressPct} color={pc} size={62} />
          <View>
            <Text style={{ fontSize: 10, fontFamily: F.bold, color: N.gray900 }}>Avance Global</Text>
            <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 3 }}>
              {doneActs} de {totalActs} actividades
            </Text>
            <View style={{ marginTop: 7, height: 4, width: 110, backgroundColor: N.gray200, borderRadius: 2 }}>
              <View style={{ height: 4, width: `${Math.min(progressPct, 100)}%`,
                backgroundColor: pc, borderRadius: 2 }} />
            </View>
          </View>
        </View>
        <KpiCard label="Actas Registradas" value={String(actas.length)}
          sub={`${firmadas} firmadas`} color={pc} bg={lighten(pc, 0.93)} />
        <KpiCard label="Capacitados" value={String(personalCapacitado.length)}
          sub={`${personalEnProceso.length} en proceso`} color="#059669" bg="#f0fdf4" />
        <KpiCard label="Dias" value={os.durationDays ? String(os.durationDays) : '—'}
          sub={`${fmt(os.startDate)} / ${fmt(os.endDate)}`} color="#6366f1" bg="#f5f3ff" />
      </View>

      {/* Status pills */}
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[
          { label: `${doneActs} Completadas`,   color: '#065f46', bg: '#d1fae5' },
          { label: `${inProgActs} En Progreso`, color: '#1e40af', bg: '#dbeafe' },
          { label: `${blockedActs} Bloqueadas`, color: '#991b1b', bg: '#fee2e2' },
          { label: `${pendActs} Pendientes`,    color: '#92400e', bg: '#fef3c7' },
        ].map(({ label, color, bg }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: bg }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
            <Text style={{ fontSize: FS.small, fontFamily: F.bold, color }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Avance por tipo */}
      {tipoProgress && (() => {
        const rows = [
          { key: 'asistencial', label: 'Asistencial', color: '#2563eb' },
          { key: 'financiero',  label: 'Financiero',  color: '#059669' },
          { key: 'mixto',       label: 'Mixto',       color: '#7c3aed' },
        ].filter(r => tipoProgress[r.key as keyof TipoProgress] != null);
        if (!rows.length) return null;
        return (
          <View style={{ marginTop: 10, padding: 10, backgroundColor: N.gray50,
            borderRadius: 6, borderWidth: 0.5, borderColor: N.gray200 }}>
            <Text style={{ fontSize: FS.caption, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray500, marginBottom: 8 }}>
              Avance por Tipo de Módulo
            </Text>
            {rows.map(({ key, label, color }) => {
              const pct = tipoProgress[key as keyof TipoProgress] ?? 0;
              return (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
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
