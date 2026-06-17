import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, statusColor, STATUS_LABEL, alpha } from '../design/colors';
import { SectionTitle } from './SectionTitle';
import { Table, TR, TC } from './Table';
import { W_ACTIVITIES } from '../design/tableWidths';

interface Props {
  os: any;
  pc: string;
  onPc: string;
  sectionNum: string;
}

const W = W_ACTIVITIES;

function StatusBadge({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <View style={{ paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3,
      backgroundColor: c.bg, borderWidth: 0.5, borderColor: c.border, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: FS.caption, fontFamily: F.bold, color: c.text }}>
        {STATUS_LABEL[status] ?? status}
      </Text>
    </View>
  );
}

// TD variant that renders a StatusBadge
function TDStatus({ status, w }: { status: string; w: number }) {
  const c = statusColor(status);
  return (
    <View style={{ width: w, paddingVertical: 4, paddingHorizontal: 6 }}>
      <View style={{ paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3,
        backgroundColor: c.bg, borderWidth: 0.5, borderColor: c.border }}>
        <Text style={{ fontSize: FS.caption + 0.5, fontFamily: F.bold, color: c.text }}>
          {STATUS_LABEL[status] ?? status}
        </Text>
      </View>
    </View>
  );
}

export function ActivitiesTable({ os, pc, onPc, sectionNum }: Props) {
  const tasks: any[] = os.projectTasks ?? [];
  if (tasks.length === 0) return null;

  const byModule = tasks.reduce((acc: Record<string, any[]>, t: any) => {
    const key = t.module ?? '—';
    (acc[key] = acc[key] ?? []).push(t);
    return acc;
  }, {});

  let rowIdx = 0;
  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Plan de Trabajo — Actividades" pc={pc} onPc={onPc} />
      <Table>
        {/* Header */}
        <TR isHeader bg={pc}>
          <TC w={W.modulo}      isHeader>Módulo</TC>
          <TC w={W.fase}        isHeader>Fase</TC>
          <TC w={W.codigo}      isHeader>Código</TC>
          <TC w={W.actividad}   isHeader>Actividad</TC>
          <TC w={W.estado}      isHeader>Estado</TC>
          <TC w={W.pct}         isHeader center>%</TC>
          <TC w={W.responsable} isHeader>Responsable</TC>
        </TR>

        {Object.entries(byModule).map(([mod, modTasks]) =>
          modTasks.map((t: any) => {
            const isOdd  = rowIdx++ % 2 !== 0;
            const resp   = t.assignedUser
              ? `${t.assignedUser.firstName ?? ''} ${(t.assignedUser.lastName ?? '')[0] ?? ''}.`.trim()
              : '—';
            const pct    = typeof t.completionPercentage === 'number' ? t.completionPercentage : 0;
            const pctStr = `${pct}%`;
            return (
              <TR key={t.id} isOdd={isOdd}>
                <TC w={W.modulo}      bold>{t.module}</TC>
                <TC w={W.fase}>{t.phase}</TC>
                <TC w={W.codigo}>{t.code}</TC>
                <TC w={W.actividad}>{t.taskName}</TC>
                {/* Status cell with badge */}
                <TDStatus status={t.status} w={W.estado} />
                <TC w={W.pct} center color={pct >= 100 ? '#065f46' : pct > 0 ? '#1e40af' : N.gray500}>
                  {pctStr}
                </TC>
                <TC w={W.responsable} color={N.gray600}>{resp}</TC>
              </TR>
            );
          })
        )}
      </Table>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        {[
          { status: 'completado', label: 'Completada' },
          { status: 'en_progreso', label: 'En Progreso' },
          { status: 'bloqueado', label: 'Bloqueada' },
          { status: 'pendiente', label: 'Pendiente' },
        ].map(({ status, label }) => {
          const c = statusColor(status);
          return (
            <View key={status} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.text }} />
              <Text style={{ fontSize: FS.caption + 0.5, color: N.gray500 }}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
