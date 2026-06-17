import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, alpha } from '../design/colors';
import { SectionTitle } from './SectionTitle';

interface Props {
  personalCapacitado:  any[];
  personalEnProceso:   any[];
  personalPendiente?:  any[];
  pc: string;
  onPc: string;
  sectionNum: string;
}

function PersonRow({ p, status, color, bg }: {
  p: any; status: string; color: string; bg: string;
}) {
  const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  const ini  = ((name.split(' ')[0]?.[0] ?? '') + (name.split(' ')[1]?.[0] ?? '')).toUpperCase();
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: '8 12', borderRadius: 6, backgroundColor: bg,
      borderWidth: 0.5, borderColor: alpha(color, 0.25),
      borderLeftWidth: 3, borderLeftColor: color }}>
      {/* Avatar */}
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: alpha(color, 0.15),
        alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontSize: 8, fontFamily: F.bold, color }}>{ini}</Text>
      </View>
      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8.5, fontFamily: F.bold, color: N.gray900 }}>{name}</Text>
        {(p.jobTitle || p.area) && (
          <Text style={{ fontSize: FS.caption + 0.5, color: N.gray500, marginTop: 1 }}>
            {[p.jobTitle, p.area].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      {/* Status badge */}
      <View style={{ paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10,
        backgroundColor: alpha(color, 0.15) }}>
        <Text style={{ fontSize: FS.caption, fontFamily: F.bold, color }}>{status}</Text>
      </View>
    </View>
  );
}

export function TrainingSummarySection({
  personalCapacitado, personalEnProceso, personalPendiente, pc, onPc, sectionNum,
}: Props) {
  const pending = personalPendiente ?? [];
  const total   = personalCapacitado.length + personalEnProceso.length + pending.length;
  if (total === 0) return null;

  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Personal — Estado de Capacitacion" pc={pc} onPc={onPc} />

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Capacitados', count: personalCapacitado.length,  color: '#065f46', bg: '#d1fae5' },
          { label: 'En Proceso',  count: personalEnProceso.length,   color: '#1e40af', bg: '#dbeafe' },
          { label: 'Pendientes',  count: pending.length,             color: '#92400e', bg: '#fef3c7' },
        ].map(({ label, count, color, bg }) => (
          <View key={label} style={{ flex: 1, padding: '10 14', borderRadius: 7,
            backgroundColor: bg, borderWidth: 0.5, borderColor: alpha(color, 0.25) }}>
            <Text style={{ fontSize: 22, fontFamily: F.bold, color, lineHeight: 1 }}>{count}</Text>
            <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color, marginTop: 4 }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* People rows */}
      <View style={{ gap: 5 }}>
        {personalCapacitado.map((p: any) => (
          <PersonRow key={p.id} p={p} status="Capacitado" color="#065f46" bg="#f0fdf4" />
        ))}
        {personalEnProceso.map((p: any) => (
          <PersonRow key={p.id} p={p} status="En Proceso" color="#1e40af" bg="#eff6ff" />
        ))}
        {pending.map((p: any) => (
          <PersonRow key={p.id} p={p} status="Pendiente" color="#92400e" bg="#fffbeb" />
        ))}
      </View>
    </View>
  );
}
