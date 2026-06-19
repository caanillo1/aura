'use client';
import React from 'react';

// ── Checklists por defecto ────────────────────────────────────────────────────
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
  'Internet ≥ 5 Mbps estable',
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

const fmtD = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '';

const TYPE_LABEL: Record<string, string> = {
  inicio:          'ACTA DE INICIO',
  visita:          'ACTA DE VISITA',
  cierre:          'ACTA DE CIERRE',
  capacitacion:    'ACTA DE CAPACITACION',
  entrega_soporte: 'ENTREGA A SOPORTE',
};

// hex → rgba
function alpha(hex: string, op: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${op})`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ActaDocumentoProps {
  acta: any;
  company?: any;
  currentFirmanteId?: string;
  userSignature?: string | null;
}

// ── Responsive CSS (container queries) ───────────────────────────────────────
const RESPONSIVE_CSS = `
#acta-print {
  container-type: inline-size;
  container-name: acta;
}

@container acta (max-width: 560px) {
  .acta-right-panel   { min-width: 108px !important; padding: 8px 10px !important; }
  .acta-title-text    { font-size: 16px !important; }
  .acta-company-label { font-size: 7px !important; }

  .acta-info-bar      { flex-direction: column !important; align-items: stretch !important; }
  .acta-info-divider  { display: none !important; }

  .acta-body-inner  { padding: 4px 12px 16px !important; }
  .acta-inicio-left { width: 100% !important; }

  .acta-sh-decobar  { display: none !important; }

  .acta-table-scroll { overflow-x: unset !important; }
  .acta-dt thead     { display: none !important; }
  .acta-dt tbody tr  {
    display: block !important;
    margin-bottom: 8px !important;
    border-radius: 6px !important;
    border: 1px solid #e2e8f0 !important;
    padding: 6px 8px !important;
    background: #fff !important;
  }
  .acta-dt tbody td {
    display: flex !important;
    align-items: flex-start !important;
    padding: 3px 0 !important;
    border: none !important;
    font-size: 10px !important;
    line-height: 1.35 !important;
    color: #374151 !important;
    background: transparent !important;
  }
  .acta-dt tbody td::before {
    content: attr(data-label);
    font-weight: 700 !important;
    color: #475569 !important;
    font-size: 9px !important;
    min-width: 72px !important;
    max-width: 72px !important;
    flex-shrink: 0 !important;
    margin-right: 6px !important;
    padding-top: 1px !important;
  }

  .acta-firmantes-grid { grid-template-columns: 1fr !important; }
}

@container acta (max-width: 420px) {
  .acta-right-panel { min-width: 90px !important; padding: 6px 8px !important; }
  .acta-title-text  { font-size: 14px !important; }
}
`;

// ── Componente ────────────────────────────────────────────────────────────────
export function ActaDocumento({ acta, company, currentFirmanteId, userSignature }: ActaDocumentoProps) {
  const pc       = company?.primaryColor   ?? '#003087';
  const sc       = company?.secondaryColor ?? '#0D7B6E';
  const logoData = company?.logoData;
  const compName = company?.commercialName || company?.name || 'EMPRESA';
  const client   = acta?.project?.serviceOrder?.client;

  const modulos = parseChecklist(acta?.modulosChecklist,            MODULOS_DEFAULT);
  const infra   = parseChecklist(acta?.infraestructuraChecklist,    INFRA_DEFAULT);
  const docs    = parseChecklist(acta?.documentacionChecklist,      DOCS_DEFAULT);
  const emision = parseChecklist(acta?.emisionElectronicaChecklist, EMISION_DEFAULT);

  const allFirmantes = acta?.firmantes ?? [];
  const actatitle    = TYPE_LABEL[acta?.type] ?? 'ACTA';

  // ── Sub-components ──────────────────────────────────────────────────────────

  // Matches PDF: circle+dot → colored band (clip-path arrow) → decorative line
  const SectionHeader = ({ title, color }: { title: string; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, marginTop: 16 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)' }} />
      </div>
      <div style={{ background: color, padding: '6px 18px 6px 8px', marginLeft: -4,
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff',
          textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{title}</span>
      </div>
      <div className="acta-sh-decobar" style={{ flex: 1, height: 1, background: alpha(color, 0.3), marginLeft: 6 }} />
    </div>
  );

  // Matches PDF InfoCard: label (bold colored) + value (gray uppercase) + bottom border
  const InfoCard = ({ label, value }: { label: string; value: string }) => (
    <div style={{ marginBottom: 11, paddingBottom: 10, borderBottom: '0.5px solid #f1f5f9' }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: pc, textTransform: 'uppercase' as const,
        letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 11, color: '#374151', textTransform: 'uppercase' as const,
        margin: 0, lineHeight: 1.4 }}>{value}</p>
    </div>
  );

  // Matches PDF SubInfoBar: gray boxes with colored left border
  const SubInfoBar = ({ items, color }: { items: { label: string; value: string }[]; color: string }) => {
    if (!items.length) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 14 }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ flex: 1, minWidth: 180, padding: '9px 12px',
            background: '#f9fafb', borderRadius: 6, borderLeft: `3px solid ${color}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
    );
  };

  // Matches PDF table: colored header row, alternating body rows
  const DataTable = ({ cols, rows, color }: { cols: string[]; rows: string[][]; color: string }) => (
    <div className="acta-table-scroll" style={{ overflowX: 'auto' } as React.CSSProperties}>
      <table className="acta-dt" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: color }}>
            {cols.map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left',
                fontWeight: 700, color: '#fff', fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 !== 0 ? '#f9fafb' : '#fff' }}>
              {row.map((v, j) => (
                <td key={j} data-label={cols[j]} style={{ padding: '6px 10px', color: '#374151',
                  borderBottom: '1px solid #f1f5f9' }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Matches PDF ChecklistTable: checkbox squares + colored header
  const ChecklistTable = ({ items, title, color }: { items: CheckItem[]; title: string; color: string }) => {
    const hasMedio = items.some(it => it.medio !== undefined);
    return (
      <div style={{ marginBottom: 14 }}>
        <SectionHeader title={title} color={color} />
        <div className="acta-table-scroll" style={{ overflowX: 'auto' } as React.CSSProperties}>
          <table className="acta-dt" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: color }}>
                <th style={{ width: 28, padding: '7px 10px', textAlign: 'center',
                  color: '#fff', fontSize: 10, fontWeight: 700 }}>V</th>
                <th style={{ padding: '7px 10px', textAlign: 'left',
                  color: '#fff', fontSize: 10, fontWeight: 700 }}>Item</th>
                <th style={{ width: 160, padding: '7px 10px', textAlign: 'left',
                  color: '#fff', fontSize: 10, fontWeight: 700 }}>Observación</th>
                {hasMedio && (
                  <th style={{ width: 90, padding: '7px 10px', textAlign: 'left',
                    color: '#fff', fontSize: 10, fontWeight: 700 }}>Medio</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 !== 0 ? '#f9fafb' : '#fff' }}>
                  <td data-label="V" style={{ padding: '6px 10px', textAlign: 'center',
                    borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2,
                      border: `1px solid ${item.checked ? '#059669' : '#d1d5db'}`,
                      background: item.checked ? '#d1fae5' : '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.checked && (
                        <span style={{ fontSize: 8, color: '#059669', fontWeight: 700, lineHeight: 1 }}>V</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Item" style={{ padding: '6px 10px',
                    color: item.checked ? '#065f46' : '#374151',
                    fontWeight: item.checked ? 700 : 400,
                    borderBottom: '1px solid #f1f5f9' }}>{item.label}</td>
                  <td data-label="Observación" style={{ padding: '6px 10px', color: '#9ca3af',
                    borderBottom: '1px solid #f1f5f9' }}>{item.obs || '—'}</td>
                  {hasMedio && (
                    <td data-label="Medio" style={{ padding: '6px 10px', color: '#9ca3af',
                      borderBottom: '1px solid #f1f5f9' }}>{item.medio || '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const CompromisosSection = ({ compromisos, color }: { compromisos: any[]; color: string }) => {
    if (!compromisos?.length) return null;
    return (
      <div style={{ marginBottom: 14 }}>
        <SectionHeader title="Compromisos" color={color} />
        <DataTable color={color} cols={['#','Compromiso','Agente','Resp. Cliente','Módulo / Fase','Estado']}
          rows={compromisos.map((c: any, i: number) => [
            String(i + 1),
            c.compromiso,
            c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : (c.responsable || '—'),
            c.clientStaff ? `${c.clientStaff.firstName} ${c.clientStaff.lastName}` : '—',
            [c.module?.name, c.phase?.name].filter(Boolean).join(' > ') || '—',
            c.estado ?? '—',
          ])} />
      </div>
    );
  };

  const AccionesSection = ({ acciones }: { acciones: any[] }) => {
    if (!acciones?.length) return null;
    return (
      <div style={{ marginBottom: 14 }}>
        <SectionHeader title="Observaciones y Acciones a Tomar" color={sc} />
        <DataTable color={sc} cols={['Acción','Responsable','Fecha Límite']}
          rows={acciones.map((a: any) => [
            a.accion ?? '—',
            a.responsable ?? '—',
            a.fechaLimite ? fmtD(a.fechaLimite) : '—',
          ])} />
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />

      <div id="acta-print" style={{
        fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff',
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', minHeight: 900,
      }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: 'flex', minHeight: 76, background: '#f8f9fb' }}>
          {/* Left: logo + separator + company name + acta title */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center',
            padding: '10px 16px', gap: 12, minWidth: 0 }}>
            {logoData ? (
              <img src={logoData} alt="logo"
                style={{ height: 46, maxWidth: 82, objectFit: 'contain', flexShrink: 0 }} />
            ) : (
              <div style={{ height: 46, width: 68, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: alpha(pc, 0.1), borderRadius: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 6.5, fontWeight: 700, color: pc, textAlign: 'center' as const }}>
                  {compName.slice(0, 7)}
                </span>
              </div>
            )}
            <div style={{ width: 1.5, height: 46, background: pc, flexShrink: 0, borderRadius: 1 }} />
            <div style={{ minWidth: 0 }}>
              <p className="acta-company-label" style={{ fontSize: 7, fontWeight: 700, color: pc,
                letterSpacing: '0.15em', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>{compName}</p>
              <p className="acta-title-text" style={{ fontSize: 20, fontWeight: 900, color: pc,
                letterSpacing: '0.04em', textTransform: 'uppercase' as const, margin: 0, lineHeight: 1.1 }}>{actatitle}</p>
            </div>
          </div>

          {/* Right: Código / Versión / Fecha panel */}
          <div className="acta-right-panel" style={{ background: pc, padding: '10px 14px', minWidth: 130,
            display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', gap: 5 }}>
            {[
              { label: 'Código:',        value: `FT-PRY-${String(acta?.numero ?? '01').padStart(2, '0')}` },
              { label: 'Versión:',       value: '01' },
              { label: 'Fecha Emisión:', value: fmtD(acta?.fecha) || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#fff', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ INFO BAR — Acta No | Fecha | Cliente ═══ */}
        <div className="acta-info-bar" style={{ margin: '10px 20px 4px', background: '#fff',
          borderRadius: 8, border: `0.5px solid ${alpha(pc, 0.2)}`,
          padding: '8px 14px', display: 'flex', alignItems: 'center' }}>
          {([
            { label: 'Acta No.', value: String(acta?.numero ?? '—') },
            { label: 'Fecha',    value: fmtD(acta?.fecha) || '—' },
            ...(client?.businessName ? [{ label: 'Cliente', value: client.businessName }] : []),
          ] as { label: string; value: string }[]).map(({ label, value }, i, arr) => (
            <React.Fragment key={label}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const,
                alignItems: 'center', padding: '0 8px' }}>
                <p style={{ fontSize: 9, color: '#9ca3af', margin: '0 0 2px' }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: pc, margin: 0 }}>{value}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="acta-info-divider"
                  style={{ width: 0.5, height: 30, background: '#e2e8f0', flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ═══ BODY ═══ */}
        <div className="acta-body-inner" style={{ padding: '6px 20px 16px', flex: 1 }}>

          {/* ── INICIO ── */}
          {acta?.type === 'inicio' && (() => {
            const agentName = acta.implementadorNombre
              || (acta.createdBy ? `${acta.createdBy.firstName} ${acta.createdBy.lastName}` : null);
            const leftCards = [
              agentName          && { label: 'Agente',          value: agentName },
              acta.asunto        && { label: 'Asunto',          value: acta.asunto },
              acta.project?.name && { label: 'Proyecto',        value: acta.project.name },
              acta.fecha         && { label: 'Fecha de Inicio', value: fmtD(acta.fecha) },
              acta.lugar         && { label: 'Lugar',           value: acta.lugar },
            ].filter(Boolean) as { label: string; value: string }[];
            return (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
                <div className="acta-inicio-left" style={{ width: 160, flexShrink: 0, paddingTop: 4 }}>
                  {leftCards.map((c, i) => <InfoCard key={i} label={c.label} value={c.value} />)}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {acta.objetivoGeneral && (
                    <div style={{ marginBottom: 12 }}>
                      <SectionHeader title="Objetivo General" color={pc} />
                      <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.75,
                        margin: '4px 0 0', whiteSpace: 'pre-line' as const }}>{acta.objetivoGeneral}</p>
                    </div>
                  )}
                  {acta.alcance && (
                    <div style={{ marginBottom: 12 }}>
                      <SectionHeader title="Alcance" color={sc} />
                      <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.75,
                        margin: '4px 0 0', whiteSpace: 'pre-line' as const }}>{acta.alcance}</p>
                    </div>
                  )}
                  <CompromisosSection compromisos={acta.compromisos ?? []} color={pc} />
                  <AccionesSection    acciones={acta.acciones ?? []} />
                </div>
              </div>
            );
          })()}

          {/* ── VISITA ── */}
          {acta?.type === 'visita' && (() => {
            const subItems = [
              acta.implementadorNombre && { label: 'Implementador',       value: acta.implementadorNombre },
              acta.jefeNombre          && { label: 'Jefe Implementacion',  value: acta.jefeNombre },
            ].filter(Boolean) as { label: string; value: string }[];
            return (
              <div>
                <SubInfoBar items={subItems} color={pc} />
                {acta.fechasVisita?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Fechas de Visita" color={pc} />
                    <DataTable color={pc} cols={['Fecha','H. Inicio','H. Fin']}
                      rows={acta.fechasVisita.map((f: any) => [fmtD(f.fecha), f.horaInicio ?? '—', f.horaFin ?? '—'])} />
                  </div>
                )}
                {acta.actividadesRealizadas && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Actividades Realizadas" color={pc} />
                    <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.75,
                      margin: '4px 0 0', whiteSpace: 'pre-line' as const }}>{acta.actividadesRealizadas}</p>
                  </div>
                )}
                {acta.actaActividades?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Actividades del Plan de Trabajo" color={pc} />
                    <DataTable color={pc} cols={['Módulo','Fase','Actividad','Agente','Resp. Cliente']}
                      rows={acta.actaActividades.map((aa: any) => [
                        aa.activity?.phase?.projectModule?.name ?? '—',
                        aa.activity?.phase?.name ?? '—',
                        `${aa.activity?.code ?? ''} ${aa.activity?.name ?? ''}`.trim(),
                        aa.assignedTo  ? `${aa.assignedTo.firstName} ${aa.assignedTo.lastName}`   : '—',
                        aa.clientStaff ? `${aa.clientStaff.firstName} ${aa.clientStaff.lastName}` : '—',
                      ])} />
                  </div>
                )}
                <CompromisosSection compromisos={acta.compromisos ?? []} color={sc} />
                <AccionesSection    acciones={acta.acciones ?? []} />
              </div>
            );
          })()}

          {/* ── CAPACITACION ── */}
          {acta?.type === 'capacitacion' && (() => {
            const subItems = [
              acta.modulo?.name                  && { label: 'Módulo',    value: acta.modulo.name },
              acta.expositor                      && { label: 'Expositor', value: acta.expositor },
              (acta.horaInicio || acta.horaFin)  && { label: 'Horario',   value: `${acta.horaInicio ?? '—'} – ${acta.horaFin ?? '—'}` },
            ].filter(Boolean) as { label: string; value: string }[];
            return (
              <div>
                <SubInfoBar items={subItems} color={pc} />
                {acta.temasCapacitacion && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Temas y Ejercicios Prácticos" color={pc} />
                    <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.75,
                      margin: '4px 0 0', whiteSpace: 'pre-line' as const }}>{acta.temasCapacitacion}</p>
                  </div>
                )}
                {acta.actaActividades?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Actividades del Plan de Trabajo" color={pc} />
                    <DataTable color={pc} cols={['Módulo','Fase','Actividad','Agente','Estado']}
                      rows={acta.actaActividades.map((aa: any) => [
                        aa.activity?.phase?.projectModule?.name ?? '—',
                        aa.activity?.phase?.name ?? '—',
                        `${aa.activity?.code ?? ''} ${aa.activity?.name ?? ''}`.trim(),
                        aa.assignedTo ? `${aa.assignedTo.firstName} ${aa.assignedTo.lastName}` : '—',
                        aa.status ?? '—',
                      ])} />
                  </div>
                )}
                {acta.participantes?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Participantes" color={sc} />
                    <DataTable color={sc} cols={['#','Nombre','Cargo','Documento','Entrada','Salida']}
                      rows={acta.participantes.map((p: any, i: number) => [
                        String(i + 1), p.nombre, p.cargo ?? '—', p.documento ?? '—',
                        p.horaEntrada ?? '—', p.horaSalida ?? '—',
                      ])} />
                  </div>
                )}
                <AccionesSection acciones={acta.acciones ?? []} />
              </div>
            );
          })()}

          {/* ── CIERRE ── */}
          {acta?.type === 'cierre' && (() => {
            const cierreMods: any[] = (() => {
              try { return JSON.parse(acta.cierreModulosJson ?? '[]'); } catch { return []; }
            })();
            return (
              <div>
                {acta.cuerpo && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Descripción" color={pc} />
                    <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.75,
                      margin: '4px 0 0', whiteSpace: 'pre-line' as const }}>{acta.cuerpo}</p>
                  </div>
                )}
                {cierreMods.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Módulos Cerrados" color={sc} />
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
                      {cierreMods.map((m: any, i: number) => (
                        <div key={i} style={{ padding: '4px 10px', background: alpha(pc, 0.1),
                          borderRadius: 10, border: `0.5px solid ${alpha(pc, 0.2)}` }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pc }}>{m.name ?? m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {acta.contactos?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="Contactos de Soporte" color={sc} />
                    <DataTable color={sc} cols={['Nombre','Teléfono','Área']}
                      rows={acta.contactos.map((c: any) => [c.nombre ?? '—', c.telefono ?? '—', c.area ?? '—'])} />
                  </div>
                )}
                <CompromisosSection compromisos={acta.compromisos ?? []} color={pc} />
                <AccionesSection    acciones={acta.acciones ?? []} />
              </div>
            );
          })()}

          {/* ── ENTREGA SOPORTE ── */}
          {acta?.type === 'entrega_soporte' && (() => {
            const metaItems = [
              acta.nitCliente               && { label: 'NIT Cliente',          value: acta.nitCliente },
              acta.sedes                    && { label: 'Sede(s)',               value: acta.sedes },
              acta.responsableImplementador && { label: 'Resp. Implementacion', value: acta.responsableImplementador },
              acta.responsableSoporte       && { label: 'Resp. Soporte',        value: acta.responsableSoporte },
            ].filter(Boolean) as { label: string; value: string }[];
            return (
              <div>
                {metaItems.length > 0 && <SubInfoBar items={metaItems} color={pc} />}
                <ChecklistTable items={modulos} title="1. Módulos Entregados"      color={pc} />
                <ChecklistTable items={infra}   title="3. Infraestructura Técnica"  color={sc} />
                <ChecklistTable items={docs}    title="5. Documentación Entregada"  color={pc} />
                <ChecklistTable items={emision} title="8. Emisión Electrónica"      color={sc} />
                {acta.observacionesGenerales && (
                  <div style={{ marginBottom: 14 }}>
                    <SectionHeader title="6. Observaciones Generales" color={sc} />
                    <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.75,
                      margin: '4px 0 0', whiteSpace: 'pre-line' as const }}>{acta.observacionesGenerales}</p>
                  </div>
                )}
              </div>
            );
          })()}

        </div>

        {/* ═══ FIRMANTES ═══ */}
        {allFirmantes.length > 0 && (
          <div style={{ padding: '6px 20px 16px' }}>
            <SectionHeader title="Firmas y Rúbricas" color={pc} />
            <div className="acta-firmantes-grid" style={{
              display: 'grid', gap: 10, marginTop: 8,
              gridTemplateColumns: `repeat(${Math.min(allFirmantes.length, 3)}, 1fr)`,
            }}>
              {allFirmantes.map((f: any, i: number) => {
                const isAgent   = f.signerType !== 'client';
                const barColor  = isAgent ? pc : sc;
                const role      = f.cargo || (isAgent ? 'Representante' : 'Gerente');
                const isCurrent = f.id === currentFirmanteId;
                const sigImg    = f.signatureData || (isCurrent ? userSignature : null);
                return (
                  <div key={i} style={{ borderRadius: 6, overflow: 'hidden',
                    border: `${isCurrent ? 2 : 0.5}px solid ${isCurrent ? barColor : alpha(barColor, 0.3)}`,
                    boxShadow: isCurrent ? `0 0 0 3px ${alpha(barColor, 0.13)}` : 'none' }}>
                    <div style={{ background: barColor, padding: '5px 10px',
                      display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ flex: 1, fontSize: 8, fontWeight: 700, color: '#fff',
                        textTransform: 'uppercase' as const, letterSpacing: '0.03em',
                        lineHeight: 1.3, wordBreak: 'break-word' as const }}>{role}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)',
                        textTransform: 'uppercase' as const, flexShrink: 0 }}>
                        {isCurrent ? 'TU FIRMA' : isAgent ? 'Agente' : 'Cliente'}
                      </span>
                    </div>
                    <div style={{ background: '#fff', padding: '8px 10px', textAlign: 'center' as const }}>
                      <div style={{ height: 44, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', marginBottom: 5 }}>
                        {sigImg ? (
                          <img src={sigImg} alt="firma"
                            style={{ maxHeight: 40, maxWidth: '90%', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ width: '85%', height: 0.5, background: '#e2e8f0' }} />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ flex: 1, height: 1, background: alpha(barColor, 0.25) }} />
                        <div style={{ width: 4, height: 4, borderRadius: '50%',
                          background: barColor, margin: '0 3px' }} />
                        <div style={{ flex: 1, height: 1, background: alpha(barColor, 0.25) }} />
                      </div>
                      <p style={{ fontSize: 8, fontWeight: 700, color: pc,
                        textTransform: 'uppercase' as const, margin: '0 0 1px',
                        letterSpacing: '0.03em', lineHeight: 1.3,
                        wordBreak: 'break-word' as const }}>{f.nombre}</p>
                      {f.cargo && f.cargo !== role && (
                        <p style={{ fontSize: 7.5, color: '#6b7280', margin: '0 0 1px', lineHeight: 1.3 }}>{f.cargo}</p>
                      )}
                      {f.empresa && (
                        <p style={{ fontSize: 7, color: '#9ca3af', margin: 0, lineHeight: 1.3 }}>{f.empresa}</p>
                      )}
                      {f.signedAt ? (
                        <p style={{ fontSize: 7, color: barColor, fontWeight: 700, margin: '3px 0 0' }}>
                          Firmado: {new Date(f.signedAt).toLocaleDateString('es-CO')}
                        </p>
                      ) : (
                        <p style={{ fontSize: 7, color: '#d97706', fontWeight: 700, margin: '3px 0 0' }}>
                          Pendiente de firma
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div style={{ borderTop: `1.5px solid ${pc}`, background: '#f9fafb', marginTop: 'auto',
          display: 'flex', alignItems: 'center', padding: '0 20px', minHeight: 36, gap: 10,
          flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: pc, flexShrink: 0 }}>{compName}</span>
          {(company?.address || company?.phone || company?.email) && (
            <div style={{ width: 0.5, height: 18, background: '#d1d5db', flexShrink: 0 }} />
          )}
          {([company?.address, company?.phone, company?.email] as (string | undefined)[])
            .filter((t): t is string => !!t)
            .map((text, i, arr) => (
              <React.Fragment key={i}>
                {i > 0 && <div style={{ width: 0.5, height: 14, background: '#e5e7eb', flexShrink: 0 }} />}
                <span style={{ fontSize: 8, color: '#6b7280' }}>{text}</span>
              </React.Fragment>
            ))}
        </div>

      </div>
    </>
  );
}
