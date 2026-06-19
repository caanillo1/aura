import React from 'react';
import { Document, Page, View, Text, Image, Font } from '@react-pdf/renderer';
import { F, FS } from './design/typography';
import { N, alpha, textOn, statusColor, STATUS_LABEL } from './design/colors';
import { PAGE, CELL } from './design/spacing';
import { Table, TR, TC } from './components/Table';
import { PageHeader } from './components/PageHeader';
import { PageFooter } from './components/PageFooter';
import { SectionTitle } from './components/SectionTitle';

Font.registerHyphenationCallback((word: string) => [word]);

// ─── Portrait table column widths (must sum to 523pt) ────────────────────────
const W = {
  modulo:      68,
  fase:        58,
  actividad:  113,
  estado:      70,
  finicio:     50,
  ffin:        50,
  fejec:       50,
  responsable: 64,
} as const;

// ─── Gantt layout constants (landscape A4: 841.89 × 595.28 pt) ───────────────
const G = {
  padH:     28,   // horizontal padding
  padTop:   54,   // space for fixed header
  padBot:   36,   // space for fixed footer
  leftW:   175,   // left label column
  rowH:     13,   // activity row height
  modH:     15,   // module header row height
  hdrH:     14,   // week/month header row height
} as const;
const GANTT_CONTENT_W = 841.89 - G.padH * 2;  // ≈ 786pt
const GANTT_TL_W      = GANTT_CONTENT_W - G.leftW; // ≈ 611pt

// ─── Date helpers ─────────────────────────────────────────────────────────────
const toDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const fmtD = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO',
    { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

const fmtShortDate = (d: Date) =>
  d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });

function getMondayOf(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildWeeks(rangeStart: Date, rangeEnd: Date): Date[] {
  const weeks: Date[] = [];
  const d = getMondayOf(rangeStart);
  const cap = new Date(rangeEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
  let n = 0;
  while (d <= cap && n < 60) {
    weeks.push(new Date(d.getTime()));
    d.setUTCDate(d.getUTCDate() + 7);
    n++;
  }
  return weeks;
}

// Bar colors by status
const BAR: Record<string, string> = {
  completado:  '#059669',
  en_progreso: '#2563EB',
  bloqueado:   '#DC2626',
  pendiente:   '#9CA3AF',
};

// ─── Public interface ─────────────────────────────────────────────────────────
export interface PlanTrabajoData {
  company?: any;
  os?: any;
  project?: any;
  generatedAt?: string;
}

// ─── Document ─────────────────────────────────────────────────────────────────
export function PlanTrabajoDocument({ data }: { data: PlanTrabajoData }) {
  const company  = data.company ?? {};
  const os       = data.os ?? {};
  const project  = data.project;
  const pc       = company.primaryColor   ?? '#003087';
  const sc       = company.secondaryColor ?? '#0D7B6E';
  const onPc     = textOn(pc);
  const compName = company.commercialName ?? company.name ?? 'EMPRESA';
  const client   = os.client ?? {};
  const tasks: any[] = os.projectTasks ?? [];

  // Group by module
  const byModule: Record<string, any[]> = {};
  for (const t of tasks) {
    const key = t.module ?? '—';
    (byModule[key] = byModule[key] ?? []).push(t);
  }

  // Stats
  const total  = tasks.length;
  const done   = tasks.filter(t => t.status === 'completado').length;
  const inProg = tasks.filter(t => t.status === 'en_progreso').length;
  const pend   = tasks.filter(t => t.status === 'pendiente').length;
  const pct    = project?.progressPercent != null
    ? Math.round(Number(project.progressPercent))
    : (total ? Math.round((done / total) * 100) : 0);

  const genDate = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('es-CO',
        { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  // ── Gantt computation ───────────────────────────────────────────────────────
  const tasksWithDates = tasks.filter(t => t.plannedStartDate || t.plannedEndDate);
  let ganttWeeks: Date[]  = [];
  let firstMonday: Date   = new Date();
  let colW                = 30;
  let todayX              = -1;

  if (tasksWithDates.length > 0) {
    const allTs: number[] = [];
    for (const t of tasks) {
      if (t.plannedStartDate) allTs.push(new Date(t.plannedStartDate).getTime());
      if (t.plannedEndDate)   allTs.push(new Date(t.plannedEndDate).getTime());
    }
    const rangeStart = new Date(Math.min(...allTs));
    const rangeEnd   = new Date(Math.max(...allTs));

    ganttWeeks  = buildWeeks(rangeStart, rangeEnd);
    firstMonday = ganttWeeks[0] ?? getMondayOf(rangeStart);
    colW        = ganttWeeks.length > 0 ? GANTT_TL_W / ganttWeeks.length : 30;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    todayX = ((today.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) * colW;
  }

  const dateToX = (d: Date): number =>
    ((d.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) * colW;

  // Month groups for Gantt header
  type MonthGroup = { label: string; count: number; x: number };
  const monthGroups: MonthGroup[] = [];
  if (ganttWeeks.length > 0) {
    let cur = ''; let cnt = 0; let startX = 0;
    ganttWeeks.forEach((w, i) => {
      const m = fmtMonthYear(w);
      if (m !== cur) {
        if (cnt > 0) monthGroups.push({ label: cur, count: cnt, x: startX });
        cur = m; cnt = 1; startX = i * colW;
      } else { cnt++; }
    });
    if (cnt > 0) monthGroups.push({ label: cur, count: cnt, x: startX });
  }

  const showWeekDate = colW >= 18;

  let rowIdx = 0;

  return (
    <Document title="Plan de Trabajo" author={compName}>

      {/* ══════════════════════════ PAGE 1+: ACTIVITIES TABLE (Portrait) ═══════════════════════ */}
      <Page size="A4" style={{
        fontFamily:        F.regular,
        paddingTop:        PAGE.paddingTop,
        paddingBottom:     PAGE.paddingBottom,
        paddingHorizontal: PAGE.paddingH,
      }}>
        <PageHeader company={company} os={os} reportTitle="Plan de Trabajo" pc={pc} />
        <PageFooter company={company} os={os} reportTitle="Plan de Trabajo" generatedAt={data.generatedAt ?? ''} />

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {([
            { label: 'Proyecto', value: project?.name ?? os.product ?? '—',       color: pc },
            { label: 'Cliente',  value: client.businessName ?? '—',               color: pc },
            { label: 'OS',       value: os.osNumber ?? '—',                       color: pc },
            { label: 'Inicio',   value: fmtD(os.startDate ?? project?.startDate), color: sc },
            { label: 'Fin',      value: fmtD(os.endDate   ?? project?.endDate),   color: sc },
            { label: 'Progreso', value: `${pct}%`,                                color: pc },
          ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
            <View key={label} style={{ flex: 1, minWidth: 110, padding: '6 10',
              backgroundColor: N.gray50, borderRadius: 4, borderLeftWidth: 2.5, borderLeftColor: color }}>
              <Text style={{ fontSize: 7, fontFamily: F.bold, color: N.gray400,
                textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</Text>
              <Text style={{ fontSize: 9, fontFamily: F.bold, color: N.gray900 }}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Progress pills */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {([
            { n: done,   label: 'Completadas', text: '#065f46', bg: '#d1fae5' },
            { n: inProg, label: 'En Progreso', text: '#1e40af', bg: '#dbeafe' },
            { n: pend,   label: 'Pendientes',  text: '#92400e', bg: '#fef3c7' },
            { n: total,  label: 'Total',        text: N.gray700, bg: N.gray100 },
          ] as { n: number; label: string; text: string; bg: string }[]).map(({ n, label, text, bg }) => (
            <View key={label} style={{ paddingVertical: 4, paddingHorizontal: 10,
              borderRadius: 12, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 9, fontFamily: F.bold, color: text }}>{n}</Text>
              <Text style={{ fontSize: 7.5, color: text }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Activities section */}
        <SectionTitle n="1" text="Actividades del Plan de Trabajo" pc={pc} onPc={onPc} />

        {tasks.length === 0 ? (
          <Text style={{ fontSize: FS.body, color: N.gray500, marginTop: 8 }}>
            No hay actividades registradas en este proyecto.
          </Text>
        ) : (
          <Table>
            <TR isHeader bg={pc}>
              <TC w={W.modulo}      isHeader>Módulo</TC>
              <TC w={W.fase}        isHeader>Fase</TC>
              <TC w={W.actividad}   isHeader>Actividad</TC>
              <TC w={W.estado}      isHeader>Estado</TC>
              <TC w={W.finicio}     isHeader center>F. Inicio</TC>
              <TC w={W.ffin}        isHeader center>F. Fin</TC>
              <TC w={W.fejec}       isHeader center>F. Ejec.</TC>
              <TC w={W.responsable} isHeader>Responsable</TC>
            </TR>

            {Object.entries(byModule).map(([, modTasks]) =>
              modTasks.map((t: any) => {
                const isOdd = rowIdx++ % 2 !== 0;
                const stC   = statusColor(t.status);
                const resp  = t.assignedUser
                  ? `${t.assignedUser.firstName ?? ''} ${(t.assignedUser.lastName ?? '')[0] ?? ''}.`.trim()
                  : '—';
                return (
                  <TR key={t.id} isOdd={isOdd}>
                    <TC w={W.modulo}    bold>{t.module}</TC>
                    <TC w={W.fase}>{t.phase}</TC>
                    <TC w={W.actividad}>{t.taskName}</TC>
                    <View style={{ width: W.estado,
                      paddingVertical: CELL.paddingV, paddingHorizontal: CELL.paddingH }}>
                      <View style={{ paddingVertical: 2, paddingHorizontal: 4, borderRadius: 3,
                        backgroundColor: stC.bg, borderWidth: 0.5, borderColor: stC.border,
                        alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 7, fontFamily: F.bold, color: stC.text }}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Text>
                      </View>
                    </View>
                    <TC w={W.finicio} center color={N.gray500}>{fmtD(t.plannedStartDate)}</TC>
                    <TC w={W.ffin}    center color={N.gray500}>{fmtD(t.plannedEndDate)}</TC>
                    <TC w={W.fejec}   center color={t.executionDate ? '#059669' : N.gray400}>
                      {fmtD(t.executionDate)}
                    </TC>
                    <TC w={W.responsable} color={N.gray600}>{resp}</TC>
                  </TR>
                );
              })
            )}
          </Table>
        )}

        {/* Legend */}
        {tasks.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            {([
              { status: 'completado',  label: 'Completada'  },
              { status: 'en_progreso', label: 'En Progreso' },
              { status: 'bloqueado',   label: 'Bloqueada'   },
              { status: 'pendiente',   label: 'Pendiente'   },
            ] as { status: string; label: string }[]).map(({ status, label }) => {
              const c = statusColor(status);
              return (
                <View key={status} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.text }} />
                  <Text style={{ fontSize: 7, color: N.gray500 }}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {genDate && (
          <Text style={{ fontSize: 7, color: N.gray400, marginTop: 12, textAlign: 'right' }}>
            Generado el {genDate}
          </Text>
        )}
      </Page>

      {/* ══════════════════════════ PAGE 2+: GANTT (Landscape) ══════════════════════════ */}
      {ganttWeeks.length > 0 && (
        <Page size="A4" orientation="landscape" style={{
          fontFamily:        F.regular,
          paddingTop:        G.padTop,
          paddingBottom:     G.padBot,
          paddingHorizontal: G.padH,
        }}>

          {/* Fixed landscape header */}
          <View fixed style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: G.padTop - 4,
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: G.padH, paddingVertical: 8,
            backgroundColor: N.white,
            borderBottomWidth: 0.5, borderBottomColor: N.gray200,
          }}>
            <View style={{ width: 72, alignItems: 'flex-start' }}>
              {company?.logoData
                ? <Image src={company.logoData} style={{ height: 24, maxWidth: 70, objectFit: 'contain' }} />
                : <Text style={{ fontSize: 8, fontFamily: F.bold, color: pc }}>{compName}</Text>
              }
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontFamily: F.bold, color: N.gray900 }}>
                Diagrama de Gantt — Plan de Trabajo
              </Text>
              <Text style={{ fontSize: 7, color: N.gray400, marginTop: 1 }}>
                {compName} · OS {os.osNumber ?? '—'} · {client.businessName ?? '—'}
              </Text>
            </View>
            <View style={{ width: 140, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: pc }}>Plan de Trabajo</Text>
              <Text style={{ fontSize: 6.5, color: N.gray400, marginTop: 1 }}>
                {fmtShortDate(ganttWeeks[0])} → {fmtShortDate(ganttWeeks[ganttWeeks.length - 1])}
                {' · '}{ganttWeeks.length} sem.
              </Text>
            </View>
          </View>

          {/* Fixed landscape footer */}
          <View fixed style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: G.padBot,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: G.padH,
            borderTopWidth: 1, borderTopColor: pc, backgroundColor: N.gray50,
          }}>
            <Text style={{ fontSize: 7, fontFamily: F.bold, color: pc }}>{compName}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 7, color: N.gray400 }}
              render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
                `Página ${pageNumber} de ${totalPages}`} />
          </View>

          {/* Legend row */}
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 8, alignItems: 'center' }}>
            {([
              { color: BAR.completado,  label: 'Completada'  },
              { color: BAR.en_progreso, label: 'En Progreso' },
              { color: BAR.bloqueado,   label: 'Bloqueada'   },
              { color: BAR.pendiente,   label: 'Pendiente'   },
            ] as { color: string; label: string }[]).map(({ color, label }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 14, height: 7, borderRadius: 2, backgroundColor: color }} />
                <Text style={{ fontSize: 7, color: N.gray500 }}>{label}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 2, height: 9, backgroundColor: '#ef4444', borderRadius: 1 }} />
              <Text style={{ fontSize: 7, color: N.gray500 }}>Hoy</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 7, color: N.gray400 }}>
              {ganttWeeks.length} semanas ·{' '}
              {fmtD(tasks.find(t => t.plannedStartDate)?.plannedStartDate)} →{' '}
              {fmtD([...tasks].reverse().find(t => t.plannedEndDate)?.plannedEndDate)}
            </Text>
          </View>

          {/* Month header row */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: G.leftW }} />
            <View style={{ width: GANTT_TL_W, flexDirection: 'row' }}>
              {monthGroups.map((mg, i) => (
                <View key={i} style={{
                  width: mg.count * colW, height: G.hdrH,
                  backgroundColor: i % 2 === 0 ? pc : sc,
                  justifyContent: 'center', alignItems: 'center',
                  borderRightWidth: 0.5, borderRightColor: alpha('#ffffff', 0.3),
                }}>
                  <Text style={{ fontSize: 7, fontFamily: F.bold, color: '#ffffff',
                    textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {mg.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Week number + date subheader */}
          <View style={{ flexDirection: 'row', marginBottom: 3,
            borderBottomWidth: 0.5, borderBottomColor: N.gray200 }}>
            <View style={{ width: G.leftW, paddingLeft: 8, paddingBottom: 3 }}>
              <Text style={{ fontSize: 6.5, fontFamily: F.bold, color: N.gray400,
                textTransform: 'uppercase', letterSpacing: 0.4 }}>Actividad</Text>
            </View>
            <View style={{ width: GANTT_TL_W, flexDirection: 'row' }}>
              {ganttWeeks.map((w, i) => (
                <View key={i} style={{ width: colW, alignItems: 'center', paddingBottom: 3 }}>
                  <Text style={{ fontSize: 6, fontFamily: F.bold, color: N.gray600 }}>
                    {`S${i + 1}`}
                  </Text>
                  {showWeekDate && (
                    <Text style={{ fontSize: 5, color: N.gray400, marginTop: 1 }}>
                      {fmtShortDate(w)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Activity rows grouped by module */}
          {Object.entries(byModule).map(([modName, modTasks]) => (
            <React.Fragment key={modName}>
              {/* Module header bar */}
              <View style={{ flexDirection: 'row', height: G.modH, marginTop: 4 }}>
                <View style={{
                  width: G.leftW + GANTT_TL_W,
                  backgroundColor: alpha(pc, 0.1),
                  borderLeftWidth: 3, borderLeftColor: pc,
                  justifyContent: 'center', paddingHorizontal: 8,
                }}>
                  <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: pc,
                    textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {modName}
                  </Text>
                </View>
              </View>

              {/* Activity rows */}
              {modTasks.map((t: any, ti: number) => {
                const startD  = toDate(t.plannedStartDate);
                const endD    = toDate(t.plannedEndDate);
                const barColor = BAR[t.status as keyof typeof BAR] ?? BAR.pendiente;
                const barX    = startD ? Math.max(0, dateToX(startD)) : null;
                const barW    = (startD && endD)
                  ? Math.max(dateToX(endD) - dateToX(startD), colW * 0.3)
                  : null;
                const isOdd   = ti % 2 !== 0;
                const rowBg   = isOdd ? N.gray50 : N.white;

                return (
                  <View key={t.id} style={{ flexDirection: 'row', height: G.rowH }}>
                    {/* Activity label */}
                    <View style={{
                      width: G.leftW, height: G.rowH,
                      backgroundColor: rowBg,
                      borderBottomWidth: 0.5, borderBottomColor: N.gray100,
                      borderRightWidth: 0.5,  borderRightColor: N.gray200,
                      justifyContent: 'center', paddingHorizontal: 8, paddingLeft: 16,
                    }}>
                      <Text style={{ fontSize: 6.5, color: N.gray700 }}>
                        {t.taskName}
                      </Text>
                    </View>

                    {/* Timeline area */}
                    <View style={{
                      width: GANTT_TL_W, height: G.rowH,
                      backgroundColor: rowBg,
                      borderBottomWidth: 0.5, borderBottomColor: N.gray100,
                      position: 'relative',
                    }}>
                      {/* Week column separators */}
                      {ganttWeeks.map((_, wi) => (
                        <View key={wi} style={{
                          position: 'absolute', left: wi * colW, top: 0, bottom: 0,
                          width: 0.5, backgroundColor: N.gray100,
                        }} />
                      ))}

                      {/* Today vertical line */}
                      {todayX >= 0 && todayX <= GANTT_TL_W && (
                        <View style={{
                          position: 'absolute', left: todayX, top: 0, bottom: 0,
                          width: 1.5, backgroundColor: '#ef4444', opacity: 0.65,
                        }} />
                      )}

                      {/* Planned bar */}
                      {barX !== null && barW !== null && barX < GANTT_TL_W && (
                        <View style={{
                          position: 'absolute',
                          left: barX,
                          width: Math.min(barW, GANTT_TL_W - barX),
                          top: Math.floor(G.rowH * 0.2),
                          height: Math.floor(G.rowH * 0.6),
                          backgroundColor: barColor,
                          borderRadius: 2,
                          opacity: t.status === 'completado' ? 1 : 0.82,
                        }} />
                      )}

                      {/* Execution date dot (if available and within range) */}
                      {t.executionDate && (() => {
                        const exD = toDate(t.executionDate);
                        if (!exD) return null;
                        const exX = dateToX(exD);
                        if (exX < 0 || exX > GANTT_TL_W) return null;
                        return (
                          <View style={{
                            position: 'absolute', left: exX - 3,
                            top: Math.floor(G.rowH * 0.5) - 3,
                            width: 6, height: 6, borderRadius: 3,
                            backgroundColor: '#059669',
                            borderWidth: 1, borderColor: '#ffffff',
                          }} />
                        );
                      })()}
                    </View>
                  </View>
                );
              })}
            </React.Fragment>
          ))}

        </Page>
      )}

    </Document>
  );
}
