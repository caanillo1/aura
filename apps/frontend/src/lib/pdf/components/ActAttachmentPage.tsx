import React from 'react';
import { Page, View, Text, Image } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N, statusColor, STATUS_LABEL, TIPO_LABEL, alpha } from '../design/colors';
import { PAGE } from '../design/spacing';
import {
  W_COMPROMISOS, W_ACCIONES, W_PARTICIPANTES,
  W_FECHAS_VISITA, W_ACTA_ACTIVITIES, W_CHECKLIST, W_CHECKLIST_MEDIO,
  W_CONTACTOS,
} from '../design/tableWidths';
import { Table, TR, TC } from './Table';
import { SignatureSection } from './SignatureSection';

interface ActPageProps { acta: any; pc: string; sc: string; company: any; os: any; reportTitle: string; generatedAt: string; }

const fmt = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtTime = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
};

// ── Reusable sub-section label ────────────────────────────────────────────────
function SubLabel({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
      letterSpacing: 0.8, color: N.gray400, marginTop: 12, marginBottom: 5,
      paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: N.gray150 }}>
      {text}
    </Text>
  );
}

// ── Compromisos table ─────────────────────────────────────────────────────────
function CompromisosTable({ compromisos, pc }: { compromisos: any[]; pc: string }) {
  if (!compromisos?.length) return null;
  const W = W_COMPROMISOS;
  const ESTADO: Record<string, string> = { cumplido: 'Cumplido', pendiente: 'Pendiente', en_proceso: 'En Proceso' };
  return (
    <>
      <SubLabel text="Compromisos" />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W.num}         isHeader center>#</TC>
          <TC w={W.compromiso}  isHeader>Compromiso</TC>
          <TC w={W.responsable} isHeader>Responsable</TC>
          <TC w={W.estado}      isHeader>Estado</TC>
        </TR>
        {compromisos.map((c: any, i) => {
          const sc_ = statusColor(c.estado ?? c.status);
          return (
            <TR key={c.id ?? i} isOdd={i % 2 !== 0}>
              <TC w={W.num} center color={N.gray400}>{i + 1}</TC>
              <TC w={W.compromiso}>{c.compromiso ?? c.description}</TC>
              <TC w={W.responsable}>{c.responsable ?? c.assignedTo ?? '—'}</TC>
              <View style={{ width: W.estado, paddingVertical: 4, paddingHorizontal: 6 }}>
                <View style={{ paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3,
                  backgroundColor: sc_.bg, borderWidth: 0.5, borderColor: sc_.border }}>
                  <Text style={{ fontSize: FS.caption + 0.5, fontFamily: F.bold, color: sc_.text }}>
                    {ESTADO[c.estado ?? c.status] ?? c.estado ?? c.status ?? '—'}
                  </Text>
                </View>
              </View>
            </TR>
          );
        })}
      </Table>
    </>
  );
}

// ── Acciones table ────────────────────────────────────────────────────────────
function AccionesTable({ acciones, pc }: { acciones: any[]; pc: string }) {
  if (!acciones?.length) return null;
  const W = W_ACCIONES;
  return (
    <>
      <SubLabel text="Acciones" />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W.accion}      isHeader>Acción</TC>
          <TC w={W.responsable} isHeader>Responsable</TC>
          <TC w={W.fecha}       isHeader>Fecha Límite</TC>
        </TR>
        {acciones.map((a: any, i) => (
          <TR key={a.id ?? i} isOdd={i % 2 !== 0}>
            <TC w={W.accion}>{a.accion ?? a.description}</TC>
            <TC w={W.responsable}>{a.responsable ?? a.assignedTo ?? '—'}</TC>
            <TC w={W.fecha}>{fmt(a.fechaLimite ?? a.dueDate)}</TC>
          </TR>
        ))}
      </Table>
    </>
  );
}

// ── Checklist ─────────────────────────────────────────────────────────────────
function Checklist({ items, pc }: { items: any[]; pc: string }) {
  if (!items?.length) return null;
  const hasMedio = items.some((i: any) => i.evidenceMedio || i.medio);
  const W = hasMedio ? W_CHECKLIST_MEDIO : W_CHECKLIST;
  return (
    <Table>
      <TR isHeader bg={pc}>
        <TC w={W.check} isHeader center>✓</TC>
        <TC w={W.item}  isHeader>Ítem</TC>
        <TC w={W.obs}   isHeader>Observación</TC>
        {hasMedio ? <TC w={(W as typeof W_CHECKLIST_MEDIO).medio} isHeader>Medio</TC> : null}
      </TR>
      {items.map((item: any, i) => {
        const checked = item.checked || item.cumplido;
        return (
          <TR key={item.id ?? i} isOdd={i % 2 !== 0}>
            <View style={{ width: W.check, paddingVertical: 4, paddingHorizontal: 6,
              alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, borderWidth: 1,
                borderColor: checked ? '#059669' : N.gray300,
                backgroundColor: checked ? '#d1fae5' : N.white,
                alignItems: 'center', justifyContent: 'center' }}>
                {checked ? <Text style={{ fontSize: 7, color: '#059669', fontFamily: F.bold }}>✓</Text> : null}
              </View>
            </View>
            <TC w={W.item} bold={checked}
              color={checked ? '#065f46' : N.gray700}>{item.item ?? item.name}</TC>
            <TC w={W.obs} color={N.gray600}>{item.observacion ?? item.observation ?? '—'}</TC>
            {hasMedio ? <TC w={(W as typeof W_CHECKLIST_MEDIO).medio} color={N.gray600}>
              {item.evidenceMedio ?? item.medio ?? '—'}
            </TC> : null}
          </TR>
        );
      })}
    </Table>
  );
}

// ── Participants table (capacitacion) ─────────────────────────────────────────
function ParticipantesTable({ participants, pc }: { participants: any[]; pc: string }) {
  if (!participants?.length) return null;
  const W = W_PARTICIPANTES;
  return (
    <>
      <SubLabel text="Participantes" />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W.num}       isHeader center>#</TC>
          <TC w={W.nombre}    isHeader>Nombre</TC>
          <TC w={W.cargo}     isHeader>Cargo</TC>
          <TC w={W.documento} isHeader>Documento</TC>
          <TC w={W.entrada}   isHeader center>Entrada</TC>
          <TC w={W.salida}    isHeader center>Salida</TC>
        </TR>
        {participants.map((p: any, i) => (
          <TR key={p.id ?? i} isOdd={i % 2 !== 0}>
            <TC w={W.num}       center color={N.gray400}>{i + 1}</TC>
            <TC w={W.nombre}    bold>{p.nombre ?? p.name ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`}</TC>
            <TC w={W.cargo}>{p.cargo ?? p.jobTitle ?? '—'}</TC>
            <TC w={W.documento}>{p.documento ?? p.documentId ?? '—'}</TC>
            <TC w={W.entrada}   center>{fmtTime(p.entryTime ?? p.entrada)}</TC>
            <TC w={W.salida}    center>{fmtTime(p.exitTime ?? p.salida)}</TC>
          </TR>
        ))}
      </Table>
    </>
  );
}

// ── Acta actividades table (visita) ───────────────────────────────────────────
function ActaActivitiesTable({ activities, pc }: { activities: any[]; pc: string }) {
  if (!activities?.length) return null;
  const W = W_ACTA_ACTIVITIES;
  return (
    <>
      <SubLabel text="Actividades Revisadas" />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W.modulo}    isHeader>Módulo</TC>
          <TC w={W.fase}      isHeader>Fase</TC>
          <TC w={W.codigo}    isHeader>Código</TC>
          <TC w={W.actividad} isHeader>Actividad</TC>
          <TC w={W.estado}    isHeader>Estado</TC>
        </TR>
        {activities.map((a: any, i) => {
          const sc_ = statusColor(a.status ?? a.estado);
          return (
            <TR key={a.id ?? i} isOdd={i % 2 !== 0}>
              <TC w={W.modulo}    bold>{a.module ?? a.modulo}</TC>
              <TC w={W.fase}>{a.phase ?? a.fase}</TC>
              <TC w={W.codigo}>{a.code ?? a.codigo}</TC>
              <TC w={W.actividad}>{a.taskName ?? a.actividad}</TC>
              <View style={{ width: W.estado, paddingVertical: 4, paddingHorizontal: 6 }}>
                <View style={{ paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3,
                  backgroundColor: sc_.bg, borderWidth: 0.5, borderColor: sc_.border }}>
                  <Text style={{ fontSize: FS.caption + 0.5, fontFamily: F.bold, color: sc_.text }}>
                    {STATUS_LABEL[a.status ?? a.estado] ?? a.status ?? a.estado ?? '—'}
                  </Text>
                </View>
              </View>
            </TR>
          );
        })}
      </Table>
    </>
  );
}

// ── Acta header banner ────────────────────────────────────────────────────────
function ActaBanner({ acta, pc, sc, index }: { acta: any; pc: string; sc: string; index: number }) {
  const sc_ = statusColor(acta.status);
  const title = TIPO_LABEL[acta.actaType] ?? acta.actaType ?? 'Acta';
  return (
    <View style={{ marginBottom: 16 }}>
      {/* Type banner */}
      <View style={{ padding: '12 16', backgroundColor: pc, borderRadius: '6 6 0 0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: alpha('#ffffff', 0.2),
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontFamily: F.bold, color: N.white }}>{index}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontFamily: F.bold, color: N.white }}>{title}</Text>
            <Text style={{ fontSize: FS.small, color: alpha('#ffffff', 0.8), marginTop: 2 }}>
              Nro. {acta.actaNumber ?? '—'}  ·  {fmt(acta.visitDate ?? acta.createdAt)}
            </Text>
          </View>
          <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4,
            backgroundColor: sc_.bg }}>
            <Text style={{ fontSize: FS.small, fontFamily: F.bold, color: sc_.text }}>
              {STATUS_LABEL[acta.status] ?? acta.status}
            </Text>
          </View>
        </View>
      </View>
      {/* Metadata row */}
      <View style={{ flexDirection: 'row', borderWidth: 0.5, borderTopWidth: 0, borderColor: N.gray200, borderRadius: '0 0 6 6', overflow: 'hidden' }}>
        {([
          { l: 'Ciudad',  v: acta.city ?? '—' },
          { l: 'Módulo',  v: acta.module ?? '—' },
          { l: 'Sede',    v: acta.sede ?? '—' },
          { l: 'Inicio',  v: fmtTime(acta.startTime) },
          { l: 'Fin',     v: fmtTime(acta.endTime)   },
        ] as { l: string; v: string }[]).map(({ l, v }, i, arr) => (
          <View key={l} style={{ flex: 1, padding: '7 10',
            borderRightWidth: i < arr.length - 1 ? 0.5 : 0, borderRightColor: N.gray100,
            backgroundColor: i % 2 === 0 ? N.gray50 : N.white }}>
            <Text style={{ fontSize: FS.caption + 0.5, fontFamily: F.bold, textTransform: 'uppercase',
              letterSpacing: 0.5, color: N.gray400, marginBottom: 2 }}>{l}</Text>
            <Text style={{ fontSize: FS.small, fontFamily: F.bold, color: N.gray800 }}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main contact card (acta cierre) ──────────────────────────────────────────
function ContactosCierreTable({ contactos, pc }: { contactos: any[]; pc: string }) {
  if (!contactos?.length) return null;
  const W = W_CONTACTOS;
  return (
    <>
      <SubLabel text="Contactos" />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W.nombre}   isHeader>Nombre</TC>
          <TC w={W.area}     isHeader>Área</TC>
          <TC w={W.telefono} isHeader>Teléfono</TC>
        </TR>
        {contactos.map((c: any, i) => (
          <TR key={c.id ?? i} isOdd={i % 2 !== 0}>
            <TC w={W.nombre}   bold>{c.nombre ?? c.name}</TC>
            <TC w={W.area}>{c.area ?? '—'}</TC>
            <TC w={W.telefono}>{c.telefono ?? c.phone ?? '—'}</TC>
          </TR>
        ))}
      </Table>
    </>
  );
}

// ── Inline page header/footer (for acta pages — lighter than main header) ─────
function ActaPageBand({ company, os, pc }: { company: any; pc: string; os: any }) {
  const nom = company?.commercialName ?? company?.name ?? '';
  return (
    <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 36, paddingTop: 8,
      backgroundColor: N.white, borderBottomWidth: 0.5, borderBottomColor: N.gray100 }}>
      {company?.logoData
        ? <Image src={company.logoData} style={{ height: 22, maxWidth: 64, objectFit: 'contain', marginRight: 10 }} />
        : null}
      <Text style={{ flex: 1, fontSize: 7, fontFamily: F.bold, color: N.gray600 }}>{nom}</Text>
      <Text style={{ fontSize: FS.label, color: N.gray400 }}>
        Anexo de Actas  ·  OS: {os?.osNumber}
      </Text>
    </View>
  );
}

function ActaPageFooter({ company, os, pc }: { company: any; pc: string; os: any }) {
  const nom = company?.commercialName ?? company?.name ?? '';
  return (
    <View fixed style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 36, paddingBottom: 5,
      borderTopWidth: 0.5, borderTopColor: N.gray100, backgroundColor: N.white }}>
      <Text style={{ flex: 1, fontSize: FS.caption + 0.5, color: N.gray400 }}>
        {nom}  ·  Documento Confidencial
      </Text>
      <Text style={{ fontSize: FS.caption + 0.5, color: N.gray400 }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

// ── Render acta body by type ──────────────────────────────────────────────────
function ActaBody({ acta, pc }: { acta: any; pc: string }) {
  switch (acta.actaType) {
    case 'inicio':
      return (
        <View>
          {acta.objetivos && (
            <>
              <SubLabel text="Objetivos" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.objetivos}
              </Text>
            </>
          )}
          {acta.alcance && (
            <>
              <SubLabel text="Alcance" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.alcance}
              </Text>
            </>
          )}
          <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
          <AccionesTable    acciones={acta.acciones ?? []}     pc={pc} />
        </View>
      );

    case 'visita': {
      const fechas: any[] = acta.visitDates ?? (acta.visitDate ? [{ date: acta.visitDate, startTime: acta.startTime, endTime: acta.endTime }] : []);
      const W = W_FECHAS_VISITA;
      return (
        <View>
          {fechas.length > 0 && (
            <>
              <SubLabel text="Fechas de Visita" />
              <Table>
                <TR isHeader bg={pc}>
                  <TC w={W.fecha}  isHeader>Fecha</TC>
                  <TC w={W.inicio} isHeader center>Hora Inicio</TC>
                  <TC w={W.fin}    isHeader center>Hora Fin</TC>
                </TR>
                {fechas.map((f: any, i) => (
                  <TR key={i} isOdd={i % 2 !== 0}>
                    <TC w={W.fecha}>{fmt(f.date ?? f.visitDate)}</TC>
                    <TC w={W.inicio} center>{fmtTime(f.startTime)}</TC>
                    <TC w={W.fin}    center>{fmtTime(f.endTime)}</TC>
                  </TR>
                ))}
              </Table>
            </>
          )}
          <ActaActivitiesTable activities={acta.actividades ?? acta.activities ?? []} pc={pc} />
          {acta.observaciones && (
            <>
              <SubLabel text="Observaciones" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.observaciones}
              </Text>
            </>
          )}
          <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
          <AccionesTable    acciones={acta.acciones ?? []}     pc={pc} />
        </View>
      );
    }

    case 'capacitacion':
      return (
        <View>
          {(acta.tema || acta.temasCapacitacion) && (
            <>
              <SubLabel text="Temas de Capacitacion" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.tema ?? acta.temasCapacitacion}
              </Text>
            </>
          )}
          {(acta.modulos ?? acta.modules ?? []).length > 0 && (
            <>
              <SubLabel text="Módulos Cubiertos" />
              <Checklist items={(acta.modulos ?? acta.modules ?? [])} pc={pc} />
            </>
          )}
          <ParticipantesTable participants={acta.participants ?? acta.participantes ?? []} pc={pc} />
          <ActaActivitiesTable activities={acta.actividades ?? acta.activities ?? []} pc={pc} />
          {acta.observaciones && (
            <>
              <SubLabel text="Observaciones" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.observaciones}
              </Text>
            </>
          )}
          <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
          <AccionesTable    acciones={acta.acciones ?? []}     pc={pc} />
        </View>
      );

    case 'cierre':
      return (
        <View>
          {acta.resumen && (
            <>
              <SubLabel text="Resumen del Proyecto" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.resumen}
              </Text>
            </>
          )}
          {(acta.checklistModulos ?? []).length > 0 && (
            <>
              <SubLabel text="Módulos Entregados" />
              <Checklist items={acta.checklistModulos} pc={pc} />
            </>
          )}
          {(acta.checklistInfra ?? []).length > 0 && (
            <>
              <SubLabel text="Infraestructura" />
              <Checklist items={acta.checklistInfra} pc={pc} />
            </>
          )}
          {(acta.checklistDocs ?? []).length > 0 && (
            <>
              <SubLabel text="Documentación" />
              <Checklist items={acta.checklistDocs} pc={pc} />
            </>
          )}
          <ContactosCierreTable contactos={acta.contactos ?? []} pc={pc} />
          <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
        </View>
      );

    case 'entrega_soporte':
      return (
        <View>
          {acta.descripcionServicio && (
            <>
              <SubLabel text="Descripcion del Servicio" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.descripcionServicio}
              </Text>
            </>
          )}
          {(acta.checklistEmision ?? []).length > 0 && (
            <>
              <SubLabel text="Checklist de Emisión" />
              <Checklist items={acta.checklistEmision} pc={pc} />
            </>
          )}
          <CompromisosTable compromisos={acta.compromisos ?? []} pc={pc} />
          <AccionesTable    acciones={acta.acciones ?? []}     pc={pc} />
          {acta.observaciones && (
            <>
              <SubLabel text="Observaciones" />
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {acta.observaciones}
              </Text>
            </>
          )}
        </View>
      );

    default:
      return null;
  }
}

// ── Public export: one Page per acta ─────────────────────────────────────────
export function ActAttachmentPage({ acta, pc, sc, company, os, reportTitle, generatedAt, index }: ActPageProps & { index: number }) {
  return (
    <Page
      size="A4"
      style={{ fontFamily: F.regular, paddingTop: 60, paddingBottom: 46, paddingHorizontal: 36 }}
    >
      <ActaPageBand  company={company} os={os} pc={pc} />
      <ActaPageFooter company={company} os={os} pc={pc} />

      <ActaBanner acta={acta} pc={pc} sc={sc} index={index} />
      <ActaBody   acta={acta} pc={pc} />
      <SignatureSection signatures={acta.signatures ?? []} pc={pc} />
    </Page>
  );
}
