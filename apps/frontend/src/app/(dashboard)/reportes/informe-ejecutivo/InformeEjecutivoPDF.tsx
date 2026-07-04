import {
  Document, Page, Text, View, StyleSheet, Svg,
  Circle, Path,
} from '@react-pdf/renderer';

// ── Paleta corporativa ────────────────────────────────────────────────────────
const C = {
  navy:      '#0A1628',
  navy2:     '#162640',
  navy3:     '#1E3A5F',
  gold:      '#C9A453',
  white:     '#FFFFFF',
  offwhite:  '#F8FAFC',
  rowAlt:    '#EEF2F7',
  border:    '#CBD5E1',
  textDark:  '#0F172A',
  textMid:   '#334155',
  textLight: '#64748B',
  verde:     '#16A34A',
  amarillo:  '#CA8A04',
  rojo:      '#DC2626',
  azul:      '#2563EB',
  naranja:   '#EA580C',
  violeta:   '#7C3AED',
};

const SEM_COLOR: Record<string, string> = { verde: C.verde, amarillo: C.amarillo, rojo: C.rojo };
const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo', pausado: 'Pausado', completado: 'Completado', cancelado: 'Cancelado',
};

function getSem(endDate: string, progress: number, status: string): 'verde' | 'amarillo' | 'rojo' {
  if (status === 'completado') return 'verde';
  const days = Math.floor((Date.now() - new Date(endDate).getTime()) / 86400000);
  if (days > 30 || (days > 0 && progress < 50)) return 'rojo';
  if (days > 0 || (days > -30 && progress < 70)) return 'amarillo';
  return 'verde';
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

// ── SVG Donut ─────────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number) {
  const s1 = polar(cx, cy, ro, a0), e1 = polar(cx, cy, ro, a1);
  const s2 = polar(cx, cy, ri, a1), e2 = polar(cx, cy, ri, a0);
  const lg = a1 - a0 > 180 ? 1 : 0;
  return `M${s1.x.toFixed(1)} ${s1.y.toFixed(1)} A${ro} ${ro} 0 ${lg} 1 ${e1.x.toFixed(1)} ${e1.y.toFixed(1)} L${s2.x.toFixed(1)} ${s2.y.toFixed(1)} A${ri} ${ri} 0 ${lg} 0 ${e2.x.toFixed(1)} ${e2.y.toFixed(1)}Z`;
}

function DonutChart({ data, size }: {
  data: { value: number; color: string }[];
  size: number;
}) {
  const cx = size / 2, cy = size / 2, ro = size * 0.42, ri = size * 0.25;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={ro} fill={C.border} />
        <Circle cx={cx} cy={cy} r={ri} fill={C.white} />
      </Svg>
    );
  }
  const segs: { path: string; color: string }[] = [];
  let start = -90;
  data.forEach(d => {
    if (d.value === 0) return;
    const sweep = (d.value / total) * 356;
    segs.push({ path: donutArc(cx, cy, ro, ri, start, start + sweep), color: d.color });
    start += sweep + 2;
  });
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={ro} fill={C.offwhite} />
      {segs.map((seg, i) => <Path key={i} d={seg.path} fill={seg.color} />)}
      <Circle cx={cx} cy={cy} r={ri} fill={C.white} />
    </Svg>
  );
}

// Progress bar using View (% widths work in Yoga/react-pdf)
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ flex: 1, height: 7, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(pct, 2)}%` as any, height: 7, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return <Svg width={8} height={8}><Circle cx={4} cy={4} r={4} fill={color} /></Svg>;
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  pageP: { backgroundColor: C.navy, flexDirection: 'column' },
  pageL: { backgroundColor: C.offwhite, flexDirection: 'column' },

  hdr:     { backgroundColor: C.navy, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '10 24' },
  hdrMain: { color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 },
  hdrSub:  { color: C.gold,  fontSize: 7.5, marginTop: 2 },
  hdrConf: { color: C.gold,  fontSize: 7.5, letterSpacing: 2 },
  ftr:     { borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between', padding: '5 24', marginTop: 'auto' },
  ftrTxt:  { fontSize: 6.5, color: C.textLight },

  sec:      { margin: '8 24 0 24' },
  secTitle: { fontSize: 7.5, color: C.navy3, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 0.75, borderBottomColor: C.border },

  kpiRow: { flexDirection: 'row', gap: 6 },
  kpiBox: { flex: 1, backgroundColor: C.white, borderRadius: 5, padding: 9, borderWidth: 0.75, borderColor: C.border, alignItems: 'center' },
  kpiVal: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  kpiLbl: { fontSize: 6, color: C.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, textAlign: 'center' },

  tblHdr: { backgroundColor: C.navy, flexDirection: 'row' },
  tblRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border },
  tblAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.rowAlt },
  th:     { color: C.white, fontSize: 6.5, fontFamily: 'Helvetica-Bold', padding: '6 3', textAlign: 'center' },
  td:     { fontSize: 6.5, color: C.textMid,  padding: '5 3', textAlign: 'center' },
  tdB:    { fontSize: 6.5, color: C.textDark, padding: '5 3', fontFamily: 'Helvetica-Bold' },
  tdSm:   { fontSize: 6,   color: C.textMid,  padding: '5 3' },

  chartCard:  { backgroundColor: C.white, borderRadius: 5, padding: 10, borderWidth: 0.75, borderColor: C.border, alignItems: 'center' },
  chartTitle: { fontSize: 7.5, color: C.textLight, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' },
  lgRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  lgTxt:      { fontSize: 6.5, color: C.textMid },

  obsCard: { backgroundColor: C.white, borderRadius: 5, padding: 10, borderWidth: 0.75, borderColor: C.border, flex: 1 },
  obsTxt:  { fontSize: 7.5, color: C.textMid, lineHeight: 1.6 },
});

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface FilaPDF {
  id: string; clienteNombre: string; osName: string; startDate: string; endDate: string;
  status: string; progressPercent: number; motivoRetraso: string;
  responsableRetraso: string; accionRequerida: string; nuevaFechaEstimada: string | null;
}

interface Props {
  filas: FilaPDF[]; company: { name: string } | null;
  obs: string; recs: string; fecha: string;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function InformeEjecutivoPDF({ filas, company, obs, recs, fecha }: Props) {
  const co = company?.name ?? 'AURA ERP';

  const total       = filas.length;
  const enCurso     = filas.filter(f => f.status === 'activo').length;
  const completados = filas.filter(f => f.status === 'completado').length;
  const pausados    = filas.filter(f => f.status === 'pausado').length;
  const verdes      = filas.filter(f => getSem(f.endDate, f.progressPercent, f.status) === 'verde').length;
  const amarillos   = filas.filter(f => getSem(f.endDate, f.progressPercent, f.status) === 'amarillo').length;
  const rojos       = filas.filter(f => getSem(f.endDate, f.progressPercent, f.status) === 'rojo').length;
  const resp        = filas.reduce((a, f) => {
    if (f.responsableRetraso) a[f.responsableRetraso] = (a[f.responsableRetraso] ?? 0) + 1;
    return a;
  }, {} as Record<string, number>);

  const W = { sem:'4%', cli:'12%', os:'12%', fi:'7%', fe:'7%', est:'6%', av:'4%', mot:'14%', re:'7%', acc:'13%', nf:'7%' };

  return (
    <Document title="Informe Ejecutivo" author={co}>

      {/* ══ PORTADA ══════════════════════════════════════════════════════════ */}
      <Page size="A4" orientation="portrait" style={s.pageP}>

        <View style={{ backgroundColor: C.gold, height: 6 }} />

        <View style={{ flex: 1, padding: '50 52', justifyContent: 'center' }}>
          <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 10 }}>{co}</Text>

          <Text style={{ fontSize: 40, color: C.white, fontFamily: 'Helvetica-Bold', letterSpacing: 1, lineHeight: 1.15 }}>
            {'INFORME\nEJECUTIVO'}
          </Text>

          <View style={{ height: 1.5, backgroundColor: C.gold, width: 72, marginTop: 26, marginBottom: 24 }} />

          <Text style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6 }}>
            {'Estado de Proyectos\nde Implementación'}
          </Text>

          <Text style={{ fontSize: 10, color: C.gold, marginTop: 30, letterSpacing: 2, textTransform: 'uppercase' }}>
            {fecha}
          </Text>

          <View style={{ marginTop: 60, gap: 8 }}>
            {[44, 64, 32].map((w, i) => (
              <View key={i} style={{ height: 1, backgroundColor: C.navy3, width: `${w}%` as any }} />
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: '#070e1a', padding: '16 52', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 7.5, color: '#4B5563', letterSpacing: 2.5, textTransform: 'uppercase' }}>Documento Confidencial</Text>
          <Text style={{ fontSize: 7.5, color: '#374151' }}>Uso exclusivo de accionistas y directivos</Text>
        </View>

      </Page>

      {/* ══ RESUMEN + GRÁFICAS ═══════════════════════════════════════════════ */}
      <Page size="A4" orientation="landscape" style={s.pageL}>

        <View style={s.hdr}>
          <View><Text style={s.hdrMain}>RESUMEN EJECUTIVO</Text><Text style={s.hdrSub}>{co} — {fecha}</Text></View>
          <Text style={s.hdrConf}>CONFIDENCIAL</Text>
        </View>

        {/* KPIs */}
        <View style={s.sec} wrap={false}>
          <Text style={s.secTitle}>Indicadores Clave</Text>
          <View style={s.kpiRow}>
            {[
              { val: total,       lbl: 'Total proyectos',  color: C.navy     },
              { val: enCurso,     lbl: 'En curso',         color: C.azul     },
              { val: completados, lbl: 'Completados',      color: C.verde    },
              { val: pausados,    lbl: 'Pausados',         color: C.amarillo },
              { val: verdes,      lbl: 'En fecha',         color: C.verde    },
              { val: amarillos,   lbl: 'En riesgo',        color: C.naranja  },
              { val: rojos,       lbl: 'Crítico',          color: C.rojo     },
            ].map(k => (
              <View key={k.lbl} style={s.kpiBox}>
                <Text style={{ ...s.kpiVal, color: k.color }}>{k.val}</Text>
                <Text style={s.kpiLbl}>{k.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Gráficas */}
        <View wrap={false} style={{ flexDirection: 'row', gap: 8, margin: '8 24 0 24' }}>

          <View style={[s.chartCard, { flex: 1 }]}>
            <Text style={s.chartTitle}>Semáforo</Text>
            <DonutChart size={90} data={[{ value: verdes, color: C.verde }, { value: amarillos, color: C.amarillo }, { value: rojos, color: C.rojo }]} />
            {[{ c: C.verde, l: `En fecha (${verdes})` }, { c: C.amarillo, l: `Riesgo (${amarillos})` }, { c: C.rojo, l: `Crítico (${rojos})` }].map(i => (
              <View key={i.l} style={s.lgRow}><Dot color={i.c} /><Text style={s.lgTxt}>{i.l}</Text></View>
            ))}
          </View>

          <View style={[s.chartCard, { flex: 1 }]}>
            <Text style={s.chartTitle}>Estado</Text>
            <DonutChart size={90} data={[{ value: enCurso, color: C.azul }, { value: completados, color: C.verde }, { value: pausados, color: C.amarillo }]} />
            {[{ c: C.azul, l: `En curso (${enCurso})` }, { c: C.verde, l: `Completados (${completados})` }, { c: C.amarillo, l: `Pausados (${pausados})` }].map(i => (
              <View key={i.l} style={s.lgRow}><Dot color={i.c} /><Text style={s.lgTxt}>{i.l}</Text></View>
            ))}
          </View>

          <View style={[s.chartCard, { flex: 2.2 }]}>
            <Text style={s.chartTitle}>Avance por proyecto</Text>
            <View style={{ gap: 5, width: '100%' }}>
              {filas.slice(0, 18).map(f => {
                const sem   = getSem(f.endDate, f.progressPercent, f.status);
                const short = f.clienteNombre.length > 22 ? f.clienteNombre.slice(0, 22) + '…' : f.clienteNombre;
                return (
                  <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 5.5, color: C.textLight, width: 84 }}>{short}</Text>
                    <ProgressBar pct={f.progressPercent} color={SEM_COLOR[sem]} />
                    <Text style={{ fontSize: 6, color: SEM_COLOR[sem], fontFamily: 'Helvetica-Bold', width: 22, textAlign: 'right' }}>{f.progressPercent}%</Text>
                  </View>
                );
              })}
              {filas.length > 18 && (
                <Text style={{ fontSize: 6, color: C.textLight, marginTop: 2 }}>+ {filas.length - 18} proyectos más…</Text>
              )}
            </View>
          </View>

          <View style={[s.chartCard, { flex: 1 }]}>
            <Text style={s.chartTitle}>Retrasos</Text>
            <DonutChart size={90} data={[{ value: resp['Cliente'] ?? 0, color: C.rojo }, { value: resp['IHCE'] ?? 0, color: C.naranja }, { value: resp['Compartido'] ?? 0, color: C.violeta }]} />
            {[{ c: C.rojo, l: `Cliente (${resp['Cliente'] ?? 0})` }, { c: C.naranja, l: `Implementador (${resp['IHCE'] ?? 0})` }, { c: C.violeta, l: `Compartido (${resp['Compartido'] ?? 0})` }].map(i => (
              <View key={i.l} style={s.lgRow}><Dot color={i.c} /><Text style={s.lgTxt}>{i.l}</Text></View>
            ))}
          </View>

        </View>

        {/* Obs + Recs */}
        <View wrap={false} style={{ flexDirection: 'row', gap: 8, margin: '8 24 0 24' }}>
          <View style={s.obsCard}>
            <Text style={s.secTitle}>Observaciones</Text>
            <Text style={s.obsTxt}>{obs || 'Sin observaciones registradas.'}</Text>
          </View>
          <View style={s.obsCard}>
            <Text style={s.secTitle}>Recomendaciones</Text>
            <Text style={s.obsTxt}>{recs || 'Sin recomendaciones registradas.'}</Text>
          </View>
        </View>

        <View style={s.ftr}>
          <Text style={s.ftrTxt}>{co} — Documento Confidencial</Text>
          <Text style={s.ftrTxt}>Página 2 de 3</Text>
        </View>

      </Page>

      {/* ══ TABLA DE PROYECTOS ═══════════════════════════════════════════════ */}
      <Page size="A4" orientation="landscape" style={s.pageL}>

        <View fixed style={s.hdr}>
          <View><Text style={s.hdrMain}>ESTADO DE PROYECTOS</Text><Text style={s.hdrSub}>{co} — {fecha}</Text></View>
          <Text style={s.hdrConf}>CONFIDENCIAL</Text>
        </View>

        <View style={{ margin: '10 24 0 24' }}>
          {/* Encabezado fijo — se repite en cada página de desborde */}
          <View fixed style={s.tblHdr}>
            {([ ['SEM', W.sem], ['CLIENTE', W.cli], ['ORDEN DE SERVICIO', W.os], ['INICIO', W.fi], ['COMPROMISO', W.fe], ['ESTADO', W.est], ['%', W.av], ['MOTIVO RETRASO', W.mot], ['RESPONSABLE', W.re], ['ACCIÓN REQUERIDA', W.acc], ['NUEVA FECHA', W.nf] ] as [string, string][]).map(([lbl, w]) =>
              <Text key={lbl} style={{ ...s.th, width: w as any }}>{lbl}</Text>
            )}
          </View>

          {filas.map((f, i) => {
            const sem   = getSem(f.endDate, f.progressPercent, f.status);
            const color = SEM_COLOR[sem];
            const row   = i % 2 === 0 ? s.tblRow : s.tblAlt;
            return (
              <View key={f.id} wrap={false} style={row}>
                <View style={{ width: W.sem as any, justifyContent: 'center', alignItems: 'center', padding: '3 2' }}>
                  <Svg width={10} height={10}><Circle cx={5} cy={5} r={5} fill={color} /></Svg>
                </View>
                <Text style={{ ...s.tdB,  width: W.cli as any }}>{f.clienteNombre}</Text>
                <Text style={{ ...s.td,   width: W.os  as any }}>{f.osName || '—'}</Text>
                <Text style={{ ...s.td,   width: W.fi  as any }}>{fmt(f.startDate)}</Text>
                <Text style={{ ...s.td,   width: W.fe  as any }}>{fmt(f.endDate)}</Text>
                <Text style={{ ...s.td,   width: W.est as any }}>{STATUS_LABEL[f.status] ?? f.status}</Text>
                <Text style={{ ...s.td,   width: W.av  as any, color, fontFamily: 'Helvetica-Bold' }}>{f.progressPercent}%</Text>
                <Text style={{ ...s.tdSm, width: W.mot as any }}>{f.motivoRetraso || '—'}</Text>
                <Text style={{ ...s.td,   width: W.re  as any }}>{f.responsableRetraso || '—'}</Text>
                <Text style={{ ...s.tdSm, width: W.acc as any }}>{f.accionRequerida || '—'}</Text>
                <Text style={{ ...s.td,   width: W.nf  as any, color: f.nuevaFechaEstimada ? color : C.textLight }}>
                  {fmt(f.nuevaFechaEstimada)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Leyenda + nota — fijas al final de cada página de desborde */}
        <View fixed style={{ flexDirection: 'row', gap: 18, margin: '6 24 0 24' }}>
          {[{ c: C.verde, l: 'En fecha — dentro del plazo con avance adecuado' }, { c: C.amarillo, l: 'Riesgo — plazo próximo o avance bajo' }, { c: C.rojo, l: 'Crítico — plazo vencido o avance insuficiente' }].map(i => (
            <View key={i.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Dot color={i.c} />
              <Text style={{ fontSize: 6.5, color: C.textLight }}>{i.l}</Text>
            </View>
          ))}
        </View>

        <View fixed style={{ margin: '4 24 0 24', padding: '5 10', backgroundColor: '#EFF6FF', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: C.azul }}>
          <Text style={{ fontSize: 6.5, color: C.textMid }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Nota: </Text>
            Las nuevas fechas estimadas están sujetas a la validación y cumplimiento de los compromisos por parte del cliente.
          </Text>
        </View>

        <View fixed style={s.ftr}>
          <Text style={s.ftrTxt}>{co} — Documento Confidencial — Uso exclusivo de accionistas y directivos</Text>
          <Text style={s.ftrTxt} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>

    </Document>
  );
}
