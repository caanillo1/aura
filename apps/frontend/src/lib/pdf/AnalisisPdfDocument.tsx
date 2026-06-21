import React from 'react';
import { Document, Page, View, Text, Svg, Circle } from '@react-pdf/renderer';
import { F, FS, LH } from './design/typography';
import { N, alpha, lighten } from './design/colors';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const RISK_COLOR: Record<string, { text: string; bg: string; border: string; label: string }> = {
  alto:   { text: '#991b1b', bg: '#fee2e2', border: '#fca5a5', label: 'RIESGO ALTO' },
  medio:  { text: '#92400e', bg: '#fef3c7', border: '#fcd34d', label: 'RIESGO MEDIO' },
  normal: { text: '#065f46', bg: '#d1fae5', border: '#a7f3d0', label: 'EN CONTROL' },
};

const HEALTH_COLOR: Record<string, string> = {
  critico:    '#dc2626',
  en_progreso:'#3b82f6',
  completado: '#10b981',
  pendiente:  '#f59e0b',
};

const PRIO_COLOR: Record<string, string> = {
  Alta: '#ef4444',
  Media: '#f59e0b',
  Baja: '#10b981',
};

const ESTADO_COLOR: Record<string, string> = {
  Entregado: '#10b981',
  Devuelto: '#fb923c',
  Negado: '#ef4444',
  Elaborado: '#60a5fa',
  Priorizado: '#a78bfa',
  Repriorizado: '#fbbf24',
};

// ── Micro components ──────────────────────────────────────────────────────────

function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <View style={{ height, backgroundColor: N.gray200, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ height, width: `${w}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (Math.min(pct, 100) / 100) * circ;
  const c    = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={alpha(color, 0.2)} strokeWidth={7} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={7}
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

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={{
      flex: 1, padding: '9 10',
      backgroundColor: lighten(color, 0.93),
      borderRadius: 6,
      borderLeftWidth: 3, borderLeftColor: color,
      borderWidth: 0.5, borderColor: alpha(color, 0.2),
    }}>
      <Text style={{ fontSize: 18, fontFamily: F.bold, color, lineHeight: 1 }}>{value}</Text>
      <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, textTransform: 'uppercase',
        letterSpacing: 0.5, color, marginTop: 3 }}>{label}</Text>
      {sub && <Text style={{ fontSize: FS.caption, color, marginTop: 2, opacity: 0.75 }}>{sub}</Text>}
    </View>
  );
}

function SectionHead({ title, pc }: { title: string; pc: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <View style={{ width: 3, height: 14, backgroundColor: pc, borderRadius: 2 }} />
      <Text style={{ fontSize: FS.h2, fontFamily: F.bold, textTransform: 'uppercase',
        letterSpacing: 1.2, color: N.gray700 }}>{title}</Text>
    </View>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 3,
      backgroundColor: bg, borderRadius: 4, borderWidth: 0.5, borderColor: alpha(color, 0.3) }}>
      <Text style={{ fontSize: FS.label, fontFamily: F.bold, color }}>{label}</Text>
    </View>
  );
}

function PageFooter({ pc, nom, page }: { pc: string; nom: string; page: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderTopWidth: 0.5, borderTopColor: N.gray200, paddingTop: 6, marginTop: 'auto' }}>
      <Text style={{ fontSize: FS.caption, color: N.gray400 }}>{nom}</Text>
      <Text style={{ fontSize: FS.caption, color: N.gray400 }}>Análisis de Implementación · Pág. {page}</Text>
      <View style={{ width: 24, height: 3, backgroundColor: pc, borderRadius: 2 }} />
    </View>
  );
}

// ── Main document ─────────────────────────────────────────────────────────────

interface Props {
  data: any;
  company: any;
}

export function AnalisisPdfDocument({ data, company }: Props) {
  const { os, project, riskLevel, alerts = [], predictions = {},
          modules = [], visits, timeline, activitySummary = {},
          recommendations = [], tickets } = data ?? {};

  const nom = company?.commercialName ?? company?.name ?? '';
  const pc  = company?.primaryColor ?? '#1E3A5F';
  const risk = RISK_COLOR[riskLevel ?? 'normal'] ?? RISK_COLOR.normal;
  const progressPct = project ? Math.round(Number(project.progressPercent ?? 0)) : 0;
  const probPct = predictions.probabilidadExito != null ? Number(predictions.probabilidadExito) : null;

  const PAGE_STYLE = { backgroundColor: N.white, fontFamily: F.regular, padding: '28 36 20 36', flexDirection: 'column' as const, gap: 0 };

  // ── PAGE 1: Cover + Executive Summary ────────────────────────────────────────
  const Page1 = (
    <Page size="A4" style={PAGE_STYLE}>
      {/* Top accent bar */}
      <View style={{ height: 4, flexDirection: 'row', marginHorizontal: -36, marginTop: -28, marginBottom: 18 }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: risk.border }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>

      {/* Header: Company + Date */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 11, fontFamily: F.bold, color: N.gray900 }}>{nom}</Text>
          {company?.nit && (
            <Text style={{ fontSize: FS.label, color: N.gray400, marginTop: 2 }}>NIT: {company.nit}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 7, fontFamily: F.bold, textTransform: 'uppercase', letterSpacing: 0.8, color: pc }}>
            ANÁLISIS DE IMPLEMENTACIÓN
          </Text>
          <Text style={{ fontSize: FS.label, color: N.gray400, marginTop: 2 }}>
            Generado: {fmtLong(new Date().toISOString())}
          </Text>
        </View>
      </View>

      <View style={{ height: 0.5, backgroundColor: N.gray200, marginBottom: 16 }} />

      {/* Title + Risk + Client */}
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        <View style={{ flex: 1.2 }}>
          <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
            letterSpacing: 2, color: N.gray400, marginBottom: 6 }}>
            DOCUMENTO EJECUTIVO CONFIDENCIAL
          </Text>
          <Text style={{ fontSize: 28, fontFamily: F.bold, color: N.gray900,
            lineHeight: LH.tight, letterSpacing: -0.5 }}>
            {'Análisis\nde\nImplementación'}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 5 }}>
            <View style={{ width: 54, height: 4, backgroundColor: pc, borderRadius: 2 }} />
            <View style={{ width: 22, height: 4, backgroundColor: risk.border, borderRadius: 2 }} />
            <View style={{ width: 10, height: 4, backgroundColor: N.gray200, borderRadius: 2 }} />
          </View>

          {/* Client block */}
          <View style={{ marginTop: 16, borderLeftWidth: 4, borderLeftColor: pc,
            paddingLeft: 14, paddingVertical: 10,
            backgroundColor: lighten(pc, 0.95), borderRadius: 6 }}>
            <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 1.2, color: N.gray400, marginBottom: 4 }}>PREPARADO PARA</Text>
            <Text style={{ fontSize: 18, fontFamily: F.bold, color: pc, lineHeight: LH.tight }}>
              {os?.client?.businessName ?? '—'}
            </Text>
            {os?.client?.nit && (
              <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 3 }}>
                NIT: {os.client.nit}
              </Text>
            )}
          </View>

          {/* Risk badge */}
          <View style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 9,
            backgroundColor: risk.bg, borderRadius: 8,
            borderWidth: 1, borderColor: risk.border }}>
            <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 1.5, color: risk.text, marginBottom: 2 }}>NIVEL DE RIESGO</Text>
            <Text style={{ fontSize: FS.h1, fontFamily: F.bold, color: risk.text }}>{risk.label}</Text>
          </View>
        </View>

        {/* Right: KPI column */}
        <View style={{ flex: 1, gap: 8 }}>
          {/* Progress ring */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 12, backgroundColor: N.gray50, borderRadius: 8,
            borderWidth: 0.5, borderColor: alpha(pc, 0.18) }}>
            <ProgressRing pct={progressPct} color={pc} size={60} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9.5, fontFamily: F.bold, color: N.gray900 }}>Avance del Proyecto</Text>
              <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 2 }}>
                {activitySummary.done ?? 0} / {activitySummary.total ?? 0} actividades
              </Text>
              <View style={{ marginTop: 6 }}>
                <ProgressBar pct={progressPct} color={pc} height={5} />
              </View>
            </View>
          </View>

          {/* Probability */}
          {probPct != null && (
            <View style={{ padding: 12, backgroundColor: lighten(pc, 0.93),
              borderRadius: 8, borderWidth: 0.5, borderColor: alpha(pc, 0.2) }}>
              <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
                letterSpacing: 0.8, color: pc, marginBottom: 4 }}>PROBABILIDAD DE ÉXITO</Text>
              <Text style={{ fontSize: 24, fontFamily: F.bold, color: pc }}>{probPct}%</Text>
              <View style={{ marginTop: 5 }}>
                <ProgressBar pct={probPct}
                  color={probPct >= 70 ? '#10b981' : probPct >= 40 ? '#f59e0b' : '#ef4444'} height={5} />
              </View>
            </View>
          )}

          {/* Activity status pills */}
          <View style={{ gap: 5 }}>
            {([
              { label: 'Completadas',  value: activitySummary.done ?? 0,       color: '#065f46', bg: '#d1fae5' },
              { label: 'En Progreso',  value: activitySummary.inProgress ?? 0, color: '#1e40af', bg: '#dbeafe' },
              { label: 'Bloqueadas',   value: activitySummary.blocked ?? 0,    color: '#991b1b', bg: '#fee2e2' },
              { label: 'Vencidas',     value: activitySummary.overdue ?? 0,    color: '#92400e', bg: '#fef3c7' },
            ] as { label: string; value: number; color: string; bg: string }[]).map(({ label, value, color, bg }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', padding: '5 10', backgroundColor: bg,
                borderRadius: 5, borderWidth: 0.5, borderColor: alpha(color, 0.25) }}>
                <Text style={{ fontSize: FS.body, fontFamily: F.bold, color }}>{label}</Text>
                <Text style={{ fontSize: FS.h2, fontFamily: F.bold, color }}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Visits */}
          {visits && (
            <View style={{ padding: '8 10', backgroundColor: N.gray50,
              borderRadius: 6, borderWidth: 0.5, borderColor: N.gray200 }}>
              <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
                letterSpacing: 0.8, color: N.gray500, marginBottom: 5 }}>VISITAS</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: FS.h2, fontFamily: F.bold, color: N.gray900 }}>{visits.total}</Text>
                  <Text style={{ fontSize: FS.caption, color: N.gray500 }}>Total</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: FS.h2, fontFamily: F.bold, color: '#10b981' }}>{visits.confirmed}</Text>
                  <Text style={{ fontSize: FS.caption, color: N.gray500 }}>Conf.</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: FS.h2, fontFamily: F.bold, color: '#3b82f6' }}>{visits.upcoming}</Text>
                  <Text style={{ fontSize: FS.caption, color: N.gray500 }}>Próx.</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: FS.h2, fontFamily: F.bold, color: '#ef4444' }}>{visits.cancelled}</Text>
                  <Text style={{ fontSize: FS.caption, color: N.gray500 }}>Canc.</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* OS metadata grid */}
      <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: N.gray200,
        borderRadius: 6, marginBottom: 14 }}>
        {([
          { l: 'No. Orden', v: os?.osNumber ?? '—' },
          { l: 'Servicio',  v: os?.product ?? '—'  },
          { l: 'Estado OS', v: os?.status ?? '—'   },
          { l: 'Inicio',    v: fmt(os?.startDate)   },
          { l: 'Fin',       v: fmt(os?.endDate)     },
        ] as { l: string; v: string }[]).map(({ l, v }, i, arr) => (
          <View key={l} style={{ flex: 1, padding: '8 10',
            borderRightWidth: i < arr.length - 1 ? 0.5 : 0, borderRightColor: N.gray100,
            backgroundColor: i % 2 === 0 ? N.gray50 : N.white }}>
            <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.8, color: N.gray400, marginBottom: 2 }}>{l}</Text>
            <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: N.gray900 }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Timeline */}
      {timeline && (
        <View style={{ marginBottom: 14, padding: '10 14', backgroundColor: N.gray50,
          borderRadius: 8, borderWidth: 0.5, borderColor: N.gray200 }}>
          <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
            letterSpacing: 1, color: N.gray500, marginBottom: 8 }}>LÍNEA DE TIEMPO</Text>
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 6 }}>
            {([
              { l: 'Días transcurridos', v: String(timeline.daysElapsed), color: pc },
              { l: 'Días restantes',     v: String(timeline.daysRemaining), color: '#6366f1' },
              { l: 'Duración total',     v: String(timeline.totalDays) + 'd', color: N.gray600 },
              { l: 'Tiempo avanzado',    v: String(timeline.timeProgressPercent) + '%', color: '#f59e0b' },
            ] as { l: string; v: string; color: string }[]).map(({ l, v, color }) => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: F.bold, color }}>{v}</Text>
                <Text style={{ fontSize: FS.caption, color: N.gray500, marginTop: 2, textAlign: 'center' }}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: FS.caption, color: N.gray500 }}>Tiempo transcurrido</Text>
              <Text style={{ fontSize: FS.caption, color: '#f59e0b', fontFamily: F.bold }}>
                {timeline.timeProgressPercent}%
              </Text>
            </View>
            <ProgressBar pct={timeline.timeProgressPercent} color="#f59e0b" height={5} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 2 }}>
              <Text style={{ fontSize: FS.caption, color: N.gray500 }}>Avance real del proyecto</Text>
              <Text style={{ fontSize: FS.caption, color: pc, fontFamily: F.bold }}>{progressPct}%</Text>
            </View>
            <ProgressBar pct={progressPct} color={pc} height={5} />
          </View>
        </View>
      )}

      <PageFooter pc={pc} nom={nom} page={1} />

      {/* Bottom accent bar */}
      <View style={{ height: 6, flexDirection: 'row', marginHorizontal: -36, marginBottom: -20, marginTop: 8 }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: risk.border }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>
    </Page>
  );

  // ── PAGE 2: Modules + Predictions + Recommendations ──────────────────────────
  const Page2 = (
    <Page size="A4" style={PAGE_STYLE}>
      {/* Top accent */}
      <View style={{ height: 4, flexDirection: 'row', marginHorizontal: -36, marginTop: -28, marginBottom: 18 }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: risk.border }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>

      {/* Modules section */}
      {modules.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <SectionHead title="Progreso por Módulo" pc={pc} />
          <View style={{ gap: 7 }}>
            {modules.map((m: any) => {
              const hColor = HEALTH_COLOR[m.health] ?? N.gray500;
              const pct    = Math.round(m.progressPercent ?? 0);
              return (
                <View key={m.id} style={{ padding: '8 12', backgroundColor: N.gray50,
                  borderRadius: 6, borderWidth: 0.5, borderColor: N.gray200 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: N.gray900, flex: 1 }}>
                      {m.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {m.activities.blocked > 0 && (
                        <Pill label={`${m.activities.blocked} bloq.`} color="#991b1b" bg="#fee2e2" />
                      )}
                      {m.activities.overdue > 0 && (
                        <Pill label={`${m.activities.overdue} venc.`} color="#92400e" bg="#fef3c7" />
                      )}
                      <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: hColor }}>
                        {pct}%
                      </Text>
                    </View>
                  </View>
                  <ProgressBar pct={pct} color={hColor} height={6} />
                  <Text style={{ fontSize: FS.caption, color: N.gray500, marginTop: 3 }}>
                    {m.activities.done}/{m.activities.total} actividades completadas
                    {m.phaseCount > 0 ? `  ·  ${m.phaseCount} fases` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Predictions */}
      {predictions.ritmoActividadesSemana != null && (
        <View style={{ marginBottom: 16 }}>
          <SectionHead title="Predicciones" pc={pc} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <KpiCard label="Ritmo semanal"
              value={`${predictions.ritmoActividadesSemana}`}
              sub="actividades/semana" color={pc} />
            <KpiCard label="Restantes"
              value={`${predictions.actividadesRestantes ?? 0}`}
              sub={`de ${predictions.totalActividades ?? 0} total`} color="#6366f1" />
            {predictions.fechaEstimadaFin && (
              <KpiCard label="Fin estimado"
                value={fmt(predictions.fechaEstimadaFin)}
                sub={predictions.diasDeRetraso != null
                  ? predictions.diasDeRetraso > 0
                    ? `${predictions.diasDeRetraso}d de retraso`
                    : 'A tiempo'
                  : undefined}
                color={predictions.diasDeRetraso != null && predictions.diasDeRetraso > 0 ? '#dc2626' : '#10b981'} />
            )}
          </View>
        </View>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <SectionHead title="Recomendaciones" pc={pc} />
          <View style={{ gap: 6 }}>
            {recommendations.map((r: any, i: number) => {
              const pColor = r.priority === 'alta' ? '#dc2626' : r.priority === 'media' ? '#d97706' : '#059669';
              const pBg    = r.priority === 'alta' ? '#fef2f2' : r.priority === 'media' ? '#fffbeb' : '#f0fdf4';
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 10, padding: '9 12',
                  backgroundColor: pBg, borderRadius: 6,
                  borderLeftWidth: 3, borderLeftColor: pColor,
                  borderWidth: 0.5, borderColor: alpha(pColor, 0.2) }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: pColor,
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Text style={{ fontSize: 8, fontFamily: F.bold, color: N.white }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: pColor }}>
                      {r.titulo}
                    </Text>
                    <Text style={{ fontSize: FS.small, color: N.gray600, lineHeight: LH.normal }}>
                      {r.accion}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <View>
          <SectionHead title="Alertas Activas" pc={pc} />
          <View style={{ gap: 5 }}>
            {alerts.map((a: any, i: number) => {
              const sev = a.severidad ?? a.severity ?? 'media';
              const aColor = sev === 'alta' ? '#dc2626' : sev === 'media' ? '#d97706' : '#059669';
              const aBg    = sev === 'alta' ? '#fef2f2' : sev === 'media' ? '#fffbeb' : '#f0fdf4';
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 8, padding: '7 12',
                  backgroundColor: aBg, borderRadius: 5,
                  borderLeftWidth: 3, borderLeftColor: aColor,
                  borderWidth: 0.5, borderColor: alpha(aColor, 0.2) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: aColor }}>
                      {a.titulo ?? a.title ?? 'Alerta'}
                    </Text>
                    {(a.descripcion ?? a.description) && (
                      <Text style={{ fontSize: FS.small, color: N.gray600, marginTop: 2 }}>
                        {a.descripcion ?? a.description}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <PageFooter pc={pc} nom={nom} page={2} />

      <View style={{ height: 6, flexDirection: 'row', marginHorizontal: -36, marginBottom: -20, marginTop: 8 }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: risk.border }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>
    </Page>
  );

  // ── PAGE 3: Tickets (conditional) ────────────────────────────────────────────
  const hasTickets = tickets?.total > 0;
  const Page3 = hasTickets ? (
    <Page size="A4" style={PAGE_STYLE}>
      {/* Top accent */}
      <View style={{ height: 4, flexDirection: 'row', marginHorizontal: -36, marginTop: -28, marginBottom: 18 }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: risk.border }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>

      <SectionHead title={tickets.vinculadosAOs > 0 ? 'Requerimientos / Tickets' : 'Requerimientos del Cliente'} pc={pc} />

      {tickets.vinculadosAOs === 0 && (
        <View style={{ padding: '6 10', backgroundColor: '#eff6ff',
          borderRadius: 5, borderWidth: 0.5, borderColor: '#93c5fd', marginBottom: 10 }}>
          <Text style={{ fontSize: FS.small, color: '#1e40af' }}>
            Ningún requerimiento está vinculado directamente a esta OS — se muestran los del cliente.
          </Text>
        </View>
      )}

      {/* Ticket KPI row */}
      <View style={{ flexDirection: 'row', gap: 7, marginBottom: 14 }}>
        <KpiCard label="Total" value={String(tickets.total)} color={pc} />
        <KpiCard label="Entregados" value={String(tickets.entregados)} color="#10b981" />
        <KpiCard label="Devueltos" value={String(tickets.devueltos)} color="#f97316" />
        <KpiCard label="Negados" value={String(tickets.negados)} color="#ef4444" />
        <KpiCard label="Pendientes" value={String(tickets.pendientes)} color="#f59e0b" />
        <KpiCard label="Alta prioridad" value={String(tickets.altaPrioridad)} color="#8b5cf6" />
      </View>

      {/* Ticket list table */}
      {tickets.list?.length > 0 && (
        <View>
          <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
            letterSpacing: 1, color: N.gray500, marginBottom: 6 }}>
            DETALLE DE REQUERIMIENTOS ({Math.min(tickets.list.length, 20)} de {tickets.total})
          </Text>
          {/* Header */}
          <View style={{ flexDirection: 'row', backgroundColor: N.gray100,
            borderRadius: 4, padding: '5 8', marginBottom: 4 }}>
            <Text style={{ flex: 0.6, fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray500 }}>N°</Text>
            <Text style={{ flex: 3, fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray500 }}>Título</Text>
            <Text style={{ flex: 1, fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray500 }}>Tipo</Text>
            <Text style={{ flex: 1, fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray500 }}>Prioridad</Text>
            <Text style={{ flex: 1.2, fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray500 }}>Estado</Text>
          </View>
          {tickets.list.slice(0, 20).map((t: any, i: number) => {
            const pColor = PRIO_COLOR[t.prioridad] ?? N.gray500;
            const eColor = ESTADO_COLOR[t.estadoActual] ?? N.gray500;
            return (
              <View key={t.id} style={{ flexDirection: 'row', padding: '5 8',
                backgroundColor: i % 2 === 0 ? N.white : N.gray50,
                borderBottomWidth: 0.5, borderBottomColor: N.gray100 }}>
                <Text style={{ flex: 0.6, fontSize: FS.table, color: N.gray500 }}>
                  {t.numero ?? (i + 1)}
                </Text>
                <Text style={{ flex: 3, fontSize: FS.table, color: N.gray800,
                  fontFamily: t.vinculadoAEstaOS ? F.bold : F.regular }}>
                  {String(t.titulo ?? '').slice(0, 80)}
                </Text>
                <Text style={{ flex: 1, fontSize: FS.table, color: N.gray600 }}>
                  {t.tipo ?? '—'}
                </Text>
                <Text style={{ flex: 1, fontSize: FS.table, fontFamily: F.bold, color: pColor }}>
                  {t.prioridad ?? '—'}
                </Text>
                <Text style={{ flex: 1.2, fontSize: FS.table, fontFamily: F.bold, color: eColor }}>
                  {t.estadoActual ?? '—'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <PageFooter pc={pc} nom={nom} page={3} />

      <View style={{ height: 6, flexDirection: 'row', marginHorizontal: -36, marginBottom: -20, marginTop: 8 }}>
        <View style={{ flex: 3, backgroundColor: pc }} />
        <View style={{ flex: 1, backgroundColor: risk.border }} />
        <View style={{ flex: 0.5, backgroundColor: N.gray200 }} />
      </View>
    </Page>
  ) : null;

  return (
    <Document
      title={`Análisis de Implementación – ${os?.osNumber ?? ''}`}
      author={nom}
      subject="Análisis de Implementación AURA"
      keywords="análisis, implementación, riesgo, avance"
    >
      {Page1}
      {Page2}
      {Page3}
    </Document>
  );
}
