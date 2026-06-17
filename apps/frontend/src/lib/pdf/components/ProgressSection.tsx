import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, statusColor, STATUS_LABEL, alpha } from '../design/colors';
import { SectionTitle } from './SectionTitle';

interface Props {
  os: any;
  pc: string;
  sc: string;
  onPc: string;
  sectionNum: string;
}

export function ProgressSection({ os, pc, sc, onPc, sectionNum }: Props) {
  const tasks: any[] = os.projectTasks ?? [];
  if (tasks.length === 0) return null;

  // Group by module
  const modules: Record<string, any[]> = {};
  tasks.forEach((t: any) => {
    const mod = t.module ?? '—';
    (modules[mod] = modules[mod] ?? []).push(t);
  });

  const modEntries = Object.entries(modules).map(([mod, mTasks]) => {
    const done     = mTasks.filter((t: any) => t.status === 'completado').length;
    const total    = mTasks.length;
    const pct      = total ? Math.round((done / total) * 100) : 0;
    const inProg   = mTasks.filter((t: any) => t.status === 'en_progreso' || t.status === 'en_curso').length;
    const blocked  = mTasks.filter((t: any) => t.status === 'bloqueado').length;
    return { mod, done, inProg, blocked, pend: total - done - inProg - blocked, total, pct };
  });

  // Overall
  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t: any) => t.status === 'completado').length;
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Progreso por Módulo" pc={pc} onPc={onPc} />

      {/* Overall progress bar */}
      <View style={{ padding: '12 14', backgroundColor: N.gray50, borderRadius: 7,
        borderWidth: 0.5, borderColor: N.gray200, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 7 }}>
          <Text style={{ fontSize: 9, fontFamily: F.bold, color: N.gray900 }}>
            Avance Global del Plan de Trabajo
          </Text>
          <Text style={{ fontSize: 12, fontFamily: F.bold, color: pc }}>{overallPct}%</Text>
        </View>
        <View style={{ height: 8, backgroundColor: N.gray200, borderRadius: 4 }}>
          <View style={{ height: 8, width: `${Math.min(overallPct, 100)}%`,
            backgroundColor: pc, borderRadius: 4 }} />
        </View>
        <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 5 }}>
          {doneTasks} de {totalTasks} actividades completadas
        </Text>
      </View>

      {/* Per-module rows */}
      <View style={{ gap: 7 }}>
        {modEntries.map(({ mod, done, inProg, blocked, pend, total, pct }) => (
          <View key={mod} wrap={false} style={{ padding: '9 12', borderRadius: 6,
            borderWidth: 0.5, borderColor: N.gray200, backgroundColor: N.white,
            borderLeftWidth: 3,
            borderLeftColor: pct >= 100 ? '#059669' : pct > 0 ? pc : N.gray300 }}>
            {/* Module name + % */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: 8.5, fontFamily: F.bold, color: N.gray900 }}>
                {mod}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: F.bold,
                color: pct >= 100 ? '#059669' : pct > 0 ? pc : N.gray400 }}>
                {pct}%
              </Text>
            </View>
            {/* Bar */}
            <View style={{ height: 5, backgroundColor: N.gray150, borderRadius: 3, marginBottom: 6 }}>
              <View style={{ height: 5, width: `${Math.min(pct, 100)}%`,
                backgroundColor: pct >= 100 ? '#059669' : pc, borderRadius: 3 }} />
            </View>
            {/* Status mini-pills */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {done > 0 && (
                <Text style={{ fontSize: FS.caption + 0.5, color: '#065f46' }}>
                  ● {done} completada{done !== 1 ? 's' : ''}
                </Text>
              )}
              {inProg > 0 && (
                <Text style={{ fontSize: FS.caption + 0.5, color: '#1e40af' }}>
                  ● {inProg} en progreso
                </Text>
              )}
              {blocked > 0 && (
                <Text style={{ fontSize: FS.caption + 0.5, color: '#dc2626' }}>
                  ● {blocked} bloqueada{blocked !== 1 ? 's' : ''}
                </Text>
              )}
              {pend > 0 && (
                <Text style={{ fontSize: FS.caption + 0.5, color: '#92400e' }}>
                  ● {pend} pendiente{pend !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
