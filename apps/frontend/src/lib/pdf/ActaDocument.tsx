import React from 'react';
import { Document, Page, View, Text, Image, Font } from '@react-pdf/renderer';
import { F, FS, LH } from './design/typography';
import { N, alpha, textOn } from './design/colors';
import { PAGE, CELL } from './design/spacing';
import { Table, TR, TC } from './components/Table';

Font.registerHyphenationCallback((word: string) => [word]);

// ── Checklist defaults ────────────────────────────────────────────────────────
interface CheckItem { label: string; checked: boolean; obs: string; medio?: string }

const MODULOS_DEFAULT: CheckItem[] = [
  'Archivo','Agenda médica','Consulta externa (historias clínicas)','Hospitalización',
  'Inventario / Farmacia','Facturación (todas las modalidades)','Emisión electrónica (FEV / DSA / NE)',
  'Dashboard Power BI','Contabilidad','Cartera y glosas','Tesorería','Nómina',
  'Consentimiento informado','Compras',
].map(l => ({ label: l, checked: false, obs: '' }));

const INFRA_DEFAULT: CheckItem[] = [
  'Certificado SSL instalado','IP pública o VPN activa (autogestión)',
  'Servidor cumple condiciones mínimas','Estaciones cumplen condiciones mínimas',
  'Internet >= 5 Mbps estable',
].map(l => ({ label: l, checked: false, obs: '' }));

const DOCS_DEFAULT: CheckItem[] = [
  'Manuales de usuario','Video grabación capacitaciones',
  'Contrato / SLA firmado','Certificados digitales (emisión electrónica)',
].map(l => ({ label: l, checked: false, obs: '', medio: '' }));

const EMISION_DEFAULT: CheckItem[] = [
  'Emisión de FEV, NE, DSA','Generación de XML (UBL 2.1)','Resolución y rangos de facturación',
  'Firma electrónica cargada','Código CUFE / CUNE / CUDS','Representación gráfica estándar',
  'Manejo de anexos en factura','Acceso a portal del proveedor',
  'Consulta y descarga de XML y PDF','Reenvío de facturas por correo',
].map(l => ({ label: l, checked: false, obs: '' }));

function parseChecklist(json: string | null | undefined, def: CheckItem[]): CheckItem[] {
  if (!json) return def.map(x => ({ ...x }));
  try { return JSON.parse(json); } catch { return def.map(x => ({ ...x })); }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtD = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

const TYPE_LABEL: Record<string, string> = {
  inicio:          'ACTA DE INICIO',
  visita:          'ACTA DE VISITA',
  cierre:          'ACTA DE CIERRE',
  capacitacion:    'ACTA DE CAPACITACION',
  entrega_soporte: 'ENTREGA A SOPORTE',
};

// ── Column widths — must sum to PAGE.contentWidth = 523 pt ───────────────────
const W = {
  fechasVisita:   { fecha: 200, inicio: 162, fin: 161 },
  actActs:        { modulo: 75, fase: 75, actividad: 185, agente: 94, cliente: 94 },
  compromisos:    { num: 22, comp: 165, agente: 100, cliente: 100, modFase: 80, estado: 56 },
  acciones:       { accion: 265, responsable: 145, fecha: 113 },
  participantes:  { num: 22, nombre: 155, cargo: 115, documento: 105, entrada: 63, salida: 63 },
  checklist:      { check: 22, item: 320, obs: 181 },
  checklistMedio: { check: 22, item: 240, obs: 165, medio: 96 },
  contactos:      { nombre: 200, telefono: 160, area: 163 },
} as const;

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ title, color }: { title: string; color: string }) {
  const onC = textOn(color);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 16 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: alpha('#ffffff', 0.85) }} />
      </View>
      <View style={{ backgroundColor: color, paddingVertical: 6, paddingLeft: 8, paddingRight: 18, marginLeft: -4 }}>
        <Text style={{ fontSize: FS.small, fontFamily: F.bold, color: onC,
          textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
      </View>
      {/* Arrow tip via border trick */}
      <View style={{ width: 0, height: 0,
        borderTopWidth: 13, borderTopColor: 'transparent' as any,
        borderBottomWidth: 13, borderBottomColor: 'transparent' as any,
        borderLeftWidth: 10, borderLeftColor: color }} />
      <View style={{ flex: 1, height: 1, backgroundColor: alpha(color, 0.3), marginLeft: 6 }} />
    </View>
  );
}

// ── InfoCard (for inicio left column) ─────────────────────────────────────────
function InfoCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ marginBottom: 11, paddingBottom: 10,
      borderBottomWidth: 0.5, borderBottomColor: N.gray100 }}>
      <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, color,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: FS.body, color: N.gray700, textTransform: 'uppercase', lineHeight: LH.normal }}>{value}</Text>
    </View>
  );
}

// ── SubInfoBar (implementador, jefe, módulo, etc.) ───────────────────────────
function SubInfoBar({ items, color }: { items: { label: string; value: string }[]; color: string }) {
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      {items.map(({ label, value }) => (
        <View key={label} style={{ flex: 1, minWidth: 180, paddingVertical: 9, paddingHorizontal: 12,
          backgroundColor: N.gray50, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: color }}>
          <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, color: N.gray400,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
          <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: N.gray800 }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Compromisos table ─────────────────────────────────────────────────────────
function CompromisosTable({ compromisos, pc }: { compromisos: any[]; pc: string }) {
  if (!compromisos?.length) return null;
  const W2 = W.compromisos;
  return (
    <View style={{ marginBottom: 14 }}>
      <SectionHeader title="Compromisos" color={pc} />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W2.num}     isHeader center>#</TC>
          <TC w={W2.comp}    isHeader>Compromiso</TC>
          <TC w={W2.agente}  isHeader>Agente</TC>
          <TC w={W2.cliente} isHeader>Resp. Cliente</TC>
          <TC w={W2.modFase} isHeader>Módulo / Fase</TC>
          <TC w={W2.estado}  isHeader>Estado</TC>
        </TR>
        {compromisos.map((c: any, i: number) => {
          const agente  = c.assignedTo
            ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}`
            : c.responsable ?? '—';
          const cliente = c.clientStaff
            ? `${c.clientStaff.firstName} ${c.clientStaff.lastName}`
            : '—';
          const modFase = [c.module?.name, c.phase?.name].filter(Boolean).join(' > ') || '—';
          return (
            <TR key={i} isOdd={i % 2 !== 0}>
              <TC w={W2.num}     center color={N.gray400}>{i + 1}</TC>
              <TC w={W2.comp}>{c.compromiso}</TC>
              <TC w={W2.agente}>{agente}</TC>
              <TC w={W2.cliente}>{cliente}</TC>
              <TC w={W2.modFase}>{modFase}</TC>
              <TC w={W2.estado}>{c.estado ?? '—'}</TC>
            </TR>
          );
        })}
      </Table>
    </View>
  );
}

// ── Acciones table ────────────────────────────────────────────────────────────
function AccionesTable({ acciones, color }: { acciones: any[]; color: string }) {
  if (!acciones?.length) return null;
  const W2 = W.acciones;
  return (
    <View style={{ marginBottom: 14 }}>
      <SectionHeader title="Observaciones y Acciones a Tomar" color={color} />
      <Table>
        <TR isHeader bg={color}>
          <TC w={W2.accion}      isHeader>Acción</TC>
          <TC w={W2.responsable} isHeader>Responsable</TC>
          <TC w={W2.fecha}       isHeader>Fecha Límite</TC>
        </TR>
        {acciones.map((a: any, i: number) => (
          <TR key={i} isOdd={i % 2 !== 0}>
            <TC w={W2.accion}>{a.accion}</TC>
            <TC w={W2.responsable}>{a.responsable ?? '—'}</TC>
            <TC w={W2.fecha}>{fmtD(a.fechaLimite)}</TC>
          </TR>
        ))}
      </Table>
    </View>
  );
}

// ── Checklist table ───────────────────────────────────────────────────────────
function ChecklistTable({ items, title, color }: { items: CheckItem[]; title: string; color: string }) {
  const hasMedio = items.some(i => i.medio !== undefined);
  const W2 = hasMedio ? W.checklistMedio : W.checklist;
  return (
    <View style={{ marginBottom: 14 }}>
      <SectionHeader title={title} color={color} />
      <Table>
        <TR isHeader bg={color}>
          <TC w={W2.check} isHeader center>V</TC>
          <TC w={W2.item}  isHeader>Item</TC>
          <TC w={W2.obs}   isHeader>Observación</TC>
          {hasMedio ? <TC w={(W2 as typeof W.checklistMedio).medio} isHeader>Medio</TC> : null}
        </TR>
        {items.map((item, i) => (
          <TR key={i} isOdd={i % 2 !== 0}>
            <View style={{ width: W2.check, paddingVertical: CELL.paddingV,
              alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, borderWidth: 1,
                borderColor: item.checked ? '#059669' : N.gray300,
                backgroundColor: item.checked ? '#d1fae5' : N.white,
                alignItems: 'center', justifyContent: 'center' }}>
                {item.checked
                  ? <Text style={{ fontSize: 7, color: '#059669', fontFamily: F.bold }}>V</Text>
                  : null}
              </View>
            </View>
            <TC w={W2.item}  bold={item.checked} color={item.checked ? '#065f46' : N.gray700}>{item.label}</TC>
            <TC w={W2.obs}   color={N.gray500}>{item.obs || '—'}</TC>
            {hasMedio
              ? <TC w={(W2 as typeof W.checklistMedio).medio} color={N.gray500}>{item.medio || '—'}</TC>
              : null}
          </TR>
        ))}
      </Table>
    </View>
  );
}

// ── ActaBody — content by type ────────────────────────────────────────────────
function ActaBody({ acta, pc, sc }: { acta: any; pc: string; sc: string }) {

  switch (acta?.type) {

    // ── INICIO ──────────────────────────────────────────────────────────────
    case 'inicio': {
      const agentName = acta.implementadorNombre
        ?? (acta.createdBy ? `${acta.createdBy.firstName} ${acta.createdBy.lastName}` : null);
      const leftCards = [
        agentName           ? { label: 'Agente',          value: agentName }          : null,
        acta.asunto         ? { label: 'Asunto',          value: acta.asunto }         : null,
        acta.project?.name  ? { label: 'Proyecto',        value: acta.project.name }   : null,
        acta.fecha          ? { label: 'Fecha de Inicio', value: fmtD(acta.fecha) }    : null,
        acta.lugar          ? { label: 'Lugar',           value: acta.lugar }          : null,
      ].filter(Boolean) as { label: string; value: string }[];

      return (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ width: 160, flexShrink: 0, paddingTop: 4 }}>
            {leftCards.map(({ label, value }, i) => (
              <InfoCard key={i} label={label} value={value} color={pc} />
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {acta.objetivoGeneral && (
              <View style={{ marginBottom: 12 }}>
                <SectionHeader title="Objetivo General" color={pc} />
                <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>{acta.objetivoGeneral}</Text>
              </View>
            )}
            {acta.alcance && (
              <View style={{ marginBottom: 12 }}>
                <SectionHeader title="Alcance" color={sc} />
                <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>{acta.alcance}</Text>
              </View>
            )}
            <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
            <AccionesTable    acciones={acta.acciones ?? []}       color={sc} />
          </View>
        </View>
      );
    }

    // ── VISITA ──────────────────────────────────────────────────────────────
    case 'visita': {
      const subItems = [
        acta.implementadorNombre ? { label: 'Implementador',      value: acta.implementadorNombre } : null,
        acta.jefeNombre          ? { label: 'Jefe Implementacion', value: acta.jefeNombre }          : null,
      ].filter(Boolean) as { label: string; value: string }[];

      return (
        <View>
          <SubInfoBar items={subItems} color={pc} />

          {(acta.fechasVisita ?? []).length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Fechas de Visita" color={pc} />
              <Table>
                <TR isHeader bg={pc}>
                  <TC w={W.fechasVisita.fecha}  isHeader>Fecha</TC>
                  <TC w={W.fechasVisita.inicio} isHeader center>H. Inicio</TC>
                  <TC w={W.fechasVisita.fin}    isHeader center>H. Fin</TC>
                </TR>
                {acta.fechasVisita.map((f: any, i: number) => (
                  <TR key={i} isOdd={i % 2 !== 0}>
                    <TC w={W.fechasVisita.fecha}>{fmtD(f.fecha)}</TC>
                    <TC w={W.fechasVisita.inicio} center>{f.horaInicio ?? '—'}</TC>
                    <TC w={W.fechasVisita.fin}    center>{f.horaFin ?? '—'}</TC>
                  </TR>
                ))}
              </Table>
            </View>
          )}

          {acta.actividadesRealizadas && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Actividades Realizadas" color={pc} />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>{acta.actividadesRealizadas}</Text>
            </View>
          )}

          {(acta.actaActividades ?? []).length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Actividades del Plan de Trabajo" color={pc} />
              <Table>
                <TR isHeader bg={pc}>
                  <TC w={W.actActs.modulo}    isHeader>Módulo</TC>
                  <TC w={W.actActs.fase}      isHeader>Fase</TC>
                  <TC w={W.actActs.actividad} isHeader>Actividad</TC>
                  <TC w={W.actActs.agente}    isHeader>Agente</TC>
                  <TC w={W.actActs.cliente}   isHeader>Resp. Cliente</TC>
                </TR>
                {acta.actaActividades.map((aa: any, i: number) => (
                  <TR key={i} isOdd={i % 2 !== 0}>
                    <TC w={W.actActs.modulo}>{aa.activity?.phase?.projectModule?.name ?? '—'}</TC>
                    <TC w={W.actActs.fase}>{aa.activity?.phase?.name ?? '—'}</TC>
                    <TC w={W.actActs.actividad}>{`${aa.activity?.code ?? ''} ${aa.activity?.name ?? ''}`.trim()}</TC>
                    <TC w={W.actActs.agente}>{aa.assignedTo ? `${aa.assignedTo.firstName} ${aa.assignedTo.lastName}` : '—'}</TC>
                    <TC w={W.actActs.cliente}>{aa.clientStaff ? `${aa.clientStaff.firstName} ${aa.clientStaff.lastName}` : '—'}</TC>
                  </TR>
                ))}
              </Table>
            </View>
          )}

          <CompromisosTable compromisos={acta.compromisos ?? []} pc={sc} />
          <AccionesTable    acciones={acta.acciones ?? []}       color={sc} />
        </View>
      );
    }

    // ── CAPACITACION ─────────────────────────────────────────────────────────
    case 'capacitacion': {
      const subItems2 = [
        acta.modulo?.name                   ? { label: 'Módulo',    value: acta.modulo.name }                             : null,
        acta.expositor                       ? { label: 'Expositor', value: acta.expositor }                               : null,
        (acta.horaInicio || acta.horaFin)   ? { label: 'Horario',   value: `${acta.horaInicio ?? '—'} – ${acta.horaFin ?? '—'}` } : null,
      ].filter(Boolean) as { label: string; value: string }[];

      return (
        <View>
          <SubInfoBar items={subItems2} color={pc} />

          {acta.temasCapacitacion && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Temas y Ejercicios Practicos" color={pc} />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>{acta.temasCapacitacion}</Text>
            </View>
          )}

          {(acta.actaActividades ?? []).length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Actividades del Plan de Trabajo" color={pc} />
              <Table>
                <TR isHeader bg={pc}>
                  <TC w={W.actActs.modulo}    isHeader>Módulo</TC>
                  <TC w={W.actActs.fase}      isHeader>Fase</TC>
                  <TC w={W.actActs.actividad} isHeader>Actividad</TC>
                  <TC w={W.actActs.agente}    isHeader>Agente</TC>
                  <TC w={W.actActs.cliente}   isHeader>Estado</TC>
                </TR>
                {acta.actaActividades.map((aa: any, i: number) => (
                  <TR key={i} isOdd={i % 2 !== 0}>
                    <TC w={W.actActs.modulo}>{aa.activity?.phase?.projectModule?.name ?? '—'}</TC>
                    <TC w={W.actActs.fase}>{aa.activity?.phase?.name ?? '—'}</TC>
                    <TC w={W.actActs.actividad}>{`${aa.activity?.code ?? ''} ${aa.activity?.name ?? ''}`.trim()}</TC>
                    <TC w={W.actActs.agente}>{aa.assignedTo ? `${aa.assignedTo.firstName} ${aa.assignedTo.lastName}` : '—'}</TC>
                    <TC w={W.actActs.cliente}>{aa.status ?? '—'}</TC>
                  </TR>
                ))}
              </Table>
            </View>
          )}

          {(acta.participantes ?? []).length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Participantes" color={sc} />
              <Table>
                <TR isHeader bg={sc}>
                  <TC w={W.participantes.num}       isHeader center>#</TC>
                  <TC w={W.participantes.nombre}    isHeader>Nombre</TC>
                  <TC w={W.participantes.cargo}     isHeader>Cargo</TC>
                  <TC w={W.participantes.documento} isHeader>Documento</TC>
                  <TC w={W.participantes.entrada}   isHeader center>Entrada</TC>
                  <TC w={W.participantes.salida}    isHeader center>Salida</TC>
                </TR>
                {acta.participantes.map((p: any, i: number) => (
                  <TR key={i} isOdd={i % 2 !== 0}>
                    <TC w={W.participantes.num}       center color={N.gray400}>{i + 1}</TC>
                    <TC w={W.participantes.nombre}    bold>{p.nombre}</TC>
                    <TC w={W.participantes.cargo}>{p.cargo ?? '—'}</TC>
                    <TC w={W.participantes.documento}>{p.documento ?? '—'}</TC>
                    <TC w={W.participantes.entrada}   center>{p.horaEntrada ?? '—'}</TC>
                    <TC w={W.participantes.salida}    center>{p.horaSalida ?? '—'}</TC>
                  </TR>
                ))}
              </Table>
            </View>
          )}

          <AccionesTable acciones={acta.acciones ?? []} color={sc} />
        </View>
      );
    }

    // ── CIERRE ──────────────────────────────────────────────────────────────
    case 'cierre': {
      const cierreMods: any[] = (() => {
        try { return JSON.parse(acta.cierreModulosJson ?? '[]'); } catch { return []; }
      })();

      return (
        <View>
          {acta.cuerpo && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Descripción" color={pc} />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>{acta.cuerpo}</Text>
            </View>
          )}

          {cierreMods.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Módulos Cerrados" color={sc} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {cierreMods.map((m: any, i: number) => (
                  <View key={i} style={{ paddingVertical: 4, paddingHorizontal: 10,
                    backgroundColor: alpha(pc, 0.1), borderRadius: 10, borderWidth: 0.5, borderColor: alpha(pc, 0.2) }}>
                    <Text style={{ fontSize: FS.body, fontFamily: F.bold, color: pc }}>{m.name ?? m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(acta.contactos ?? []).length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Contactos de Soporte" color={sc} />
              <Table>
                <TR isHeader bg={sc}>
                  <TC w={W.contactos.nombre}   isHeader>Nombre</TC>
                  <TC w={W.contactos.telefono} isHeader>Teléfono</TC>
                  <TC w={W.contactos.area}     isHeader>Área</TC>
                </TR>
                {acta.contactos.map((c: any, i: number) => (
                  <TR key={i} isOdd={i % 2 !== 0}>
                    <TC w={W.contactos.nombre}   bold>{c.nombre ?? '—'}</TC>
                    <TC w={W.contactos.telefono}>{c.telefono ?? '—'}</TC>
                    <TC w={W.contactos.area}>{c.area ?? '—'}</TC>
                  </TR>
                ))}
              </Table>
            </View>
          )}

          <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
          <AccionesTable    acciones={acta.acciones ?? []}       color={sc} />
        </View>
      );
    }

    // ── ENTREGA SOPORTE ──────────────────────────────────────────────────────
    case 'entrega_soporte': {
      const modulos = parseChecklist(acta.modulosChecklist,            MODULOS_DEFAULT);
      const infra   = parseChecklist(acta.infraestructuraChecklist,    INFRA_DEFAULT);
      const docs    = parseChecklist(acta.documentacionChecklist,      DOCS_DEFAULT);
      const emision = parseChecklist(acta.emisionElectronicaChecklist, EMISION_DEFAULT);

      const metaItems = [
        acta.nitCliente               ? { label: 'NIT Cliente',          value: acta.nitCliente }               : null,
        acta.sedes                    ? { label: 'Sede(s)',               value: acta.sedes }                    : null,
        acta.responsableImplementador ? { label: 'Resp. Implementacion', value: acta.responsableImplementador } : null,
        acta.responsableSoporte       ? { label: 'Resp. Soporte',        value: acta.responsableSoporte }       : null,
      ].filter(Boolean) as { label: string; value: string }[];

      return (
        <View>
          {metaItems.length > 0 && <SubInfoBar items={metaItems} color={pc} />}
          <ChecklistTable items={modulos} title="1. Módulos Entregados"      color={pc} />
          <ChecklistTable items={infra}   title="3. Infraestructura Tecnica"  color={sc} />
          <ChecklistTable items={docs}    title="5. Documentación Entregada"  color={pc} />
          <ChecklistTable items={emision} title="8. Emision Electronica"      color={sc} />
          {acta.observacionesGenerales && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="6. Observaciones Generales" color={sc} />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>{acta.observacionesGenerales}</Text>
            </View>
          )}
        </View>
      );
    }

    default:
      return null;
  }
}

// ── Firmantes grid ────────────────────────────────────────────────────────────
function FirmantesSection({ firmantes, pc, sc }: { firmantes: any[]; pc: string; sc: string }) {
  if (!firmantes.length) return null;

  const numCols   = Math.min(firmantes.length, 3);
  const gap       = 10;
  const colW      = (PAGE.contentWidth - gap * (numCols - 1)) / numCols;
  const rows: any[][] = [];
  for (let i = 0; i < firmantes.length; i += numCols) rows.push(firmantes.slice(i, i + numCols));

  return (
    <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
      <SectionHeader title="Firmas y Rúbricas" color={pc} />
      {rows.map((row, rowIdx) => (
        // wrap={false} → la fila completa se mueve a la siguiente página si no cabe entera
        <View key={rowIdx} wrap={false}
          style={{ flexDirection: 'row', gap, marginTop: rowIdx > 0 ? gap : 0 }}>
          {row.map((f: any, i: number) => {
            const isAgent  = f.signerType !== 'client';
            const barColor = isAgent ? pc : sc;
            const role     = f.cargo || (isAgent ? 'Representante' : 'Gerente');
            return (
              // wrap={false} en cada tarjeta individual — nunca se parte por la mitad
              <View key={i} wrap={false} style={{ width: colW, borderWidth: 0.5,
                borderColor: alpha(barColor, 0.3), borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ backgroundColor: barColor, paddingVertical: 5, paddingHorizontal: 10,
                  flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Text style={{ flex: 1, fontSize: 7, fontFamily: F.bold, color: N.white,
                    textTransform: 'uppercase', letterSpacing: 0.3 }}>{role}</Text>
                  <Text style={{ fontSize: 6, color: alpha(N.white, 0.7), textTransform: 'uppercase' }}>
                    {isAgent ? 'Agente' : 'Cliente'}
                  </Text>
                </View>
                <View style={{ backgroundColor: N.white, padding: '8 10', alignItems: 'center' }}>
                  {f.signatureData
                    ? <Image src={f.signatureData} style={{ height: 38, maxWidth: colW - 20, objectFit: 'contain', marginBottom: 5 }} />
                    : <View style={{ height: 38, width: '85%', borderBottomWidth: 0.5, borderBottomColor: N.gray200, marginBottom: 5 }} />
                  }
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, width: '100%' }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: alpha(barColor, 0.25) }} />
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: barColor, marginHorizontal: 3 }} />
                    <View style={{ flex: 1, height: 1, backgroundColor: alpha(barColor, 0.25) }} />
                  </View>
                  <Text style={{ fontSize: 8, fontFamily: F.bold, color: pc,
                    textTransform: 'uppercase', textAlign: 'center' }}>{f.nombre}</Text>
                  {f.cargo && f.cargo !== role && (
                    <Text style={{ fontSize: 7, color: N.gray500, marginTop: 1, textAlign: 'center' }}>{f.cargo}</Text>
                  )}
                  {f.empresa && (
                    <Text style={{ fontSize: 6.5, color: N.gray400, marginTop: 1, textAlign: 'center' }}>{f.empresa}</Text>
                  )}
                  {f.signedAt
                    ? <Text style={{ fontSize: 6, color: barColor, fontFamily: F.bold, marginTop: 3 }}>
                        Firmado: {new Date(f.signedAt).toLocaleDateString('es-CO')}
                      </Text>
                    : <Text style={{ fontSize: 6, color: '#d97706', fontFamily: F.bold, marginTop: 3 }}>
                        Pendiente de firma
                      </Text>
                  }
                </View>
              </View>
            );
          })}
          {Array.from({ length: numCols - row.length }).map((_, i) => (
            <View key={`empty-${i}`} style={{ width: colW }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Page footer (fixed — appears on every page) ───────────────────────────────
function PageFooter({ company, pc }: { company: any; pc: string }) {
  const nom = company?.commercialName ?? company?.name ?? '';
  const contactItems = [
    company?.address && { text: company.address },
    company?.phone   && { text: company.phone },
    company?.email   && { text: company.email },
  ].filter(Boolean) as { text: string }[];

  return (
    <View fixed style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4,
      borderTopWidth: 1.5, borderTopColor: pc, backgroundColor: N.gray50, gap: 10 }}>
      <Text style={{ fontSize: 7, fontFamily: F.bold, color: pc, flexShrink: 0 }}>{nom}</Text>
      {contactItems.length > 0 && (
        <View style={{ width: 0.5, height: 18, backgroundColor: N.gray300, flexShrink: 0 }} />
      )}
      {contactItems.map(({ text }, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={{ width: 0.5, height: 14, backgroundColor: N.gray200 }} />}
          <Text style={{ fontSize: 7, color: N.gray500 }}>{text}</Text>
        </React.Fragment>
      ))}
      <View style={{ flex: 1 }} />
      <Text style={{ fontSize: 7, color: N.gray400, fontFamily: F.bold }}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export interface ActaDocumentProps {
  acta:     any;
  company?: any;
}

export function ActaDocument({ acta, company }: ActaDocumentProps) {
  const pc       = company?.primaryColor   ?? '#003087';
  const sc       = company?.secondaryColor ?? '#0D7B6E';
  const onPc     = textOn(pc);
  const compName = company?.commercialName || company?.name || 'EMPRESA';
  const logoData = company?.logoData;
  const client   = acta?.project?.serviceOrder?.client;
  const actatitle = TYPE_LABEL[acta?.type] ?? 'ACTA';

  return (
    <Document title={actatitle} author={compName}>
      <Page size="A4" style={{ fontFamily: F.regular, paddingTop: 80, paddingBottom: 44 }}>

        {/* Fixed footer */}
        <PageFooter company={company} pc={pc} />

        {/* ═══ DECORATIVE HEADER (fixed — all pages) ═══ */}
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0,
          flexDirection: 'row', minHeight: 76, backgroundColor: N.gray50 }}>
          {/* Left: logo + separator + company + title */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
            paddingVertical: 10, paddingHorizontal: 16, gap: 12 }}>
            {logoData ? (
              <Image src={logoData} style={{ height: 46, maxWidth: 82, objectFit: 'contain', flexShrink: 0 } as any} />
            ) : (
              <View style={{ height: 46, width: 68, backgroundColor: alpha(pc, 0.1), borderRadius: 6,
                alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 6.5, fontFamily: F.bold, color: pc, textAlign: 'center' }}>
                  {compName.slice(0, 7)}
                </Text>
              </View>
            )}
            <View style={{ width: 1.5, height: 46, backgroundColor: pc, flexShrink: 0 }} />
            <View>
              <Text style={{ fontSize: 7, fontFamily: F.bold, color: pc,
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>{compName}</Text>
              <Text style={{ fontSize: 20, fontFamily: F.bold, color: pc,
                letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1.1 }}>{actatitle}</Text>
            </View>
          </View>

          {/* Right: code/version panel */}
          <View style={{ backgroundColor: pc, paddingVertical: 10, paddingHorizontal: 14,
            justifyContent: 'center', gap: 5, minWidth: 130 }}>
            {([
              { label: 'Código:',       value: `FT-PRY-${String(acta?.numero ?? '01').padStart(2, '0')}` },
              { label: 'Versión:',      value: '01' },
              { label: 'Fecha Emisión:', value: fmtD(acta?.fecha) },
            ] as { label: string; value: string }[]).map(({ label, value }) => (
              <View key={label}>
                <Text style={{ fontSize: 6, color: alpha(N.white, 0.6) }}>{label}</Text>
                <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: N.white }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ INFO BAR (Acta No | Fecha | Cliente) ═══ */}
        <View style={{ flexDirection: 'row', alignItems: 'center',
          marginHorizontal: 20, marginTop: 10, marginBottom: 4,
          backgroundColor: N.white, borderRadius: 8,
          borderWidth: 0.5, borderColor: alpha(pc, 0.2),
          paddingVertical: 8, paddingHorizontal: 14 }}>
          {([
            { label: 'Acta No.',  value: String(acta?.numero ?? '—') },
            { label: 'Fecha',     value: fmtD(acta?.fecha) },
            ...(client?.businessName ? [{ label: 'Cliente', value: client.businessName }] : []),
          ] as { label: string; value: string }[]).map(({ label, value }, i, arr) => (
            <React.Fragment key={label}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: FS.label, color: N.gray400, marginBottom: 2 }}>{label}</Text>
                <Text style={{ fontSize: 13, fontFamily: F.bold, color: pc }}>{value}</Text>
              </View>
              {i < arr.length - 1 && (
                <View style={{ width: 0.5, height: 30, backgroundColor: N.gray200, flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ═══ BODY ═══ */}
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <ActaBody acta={acta} pc={pc} sc={sc} />
        </View>

        {/* ═══ FIRMANTES ═══ */}
        <FirmantesSection firmantes={acta?.firmantes ?? []} pc={pc} sc={sc} />

      </Page>
    </Document>
  );
}
