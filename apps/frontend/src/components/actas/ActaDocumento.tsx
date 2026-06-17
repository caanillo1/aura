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

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ActaDocumentoProps {
  acta: any;
  /** Branding de la empresa. Si no se pasa se usan los colores por defecto. */
  company?: any;
  /** ID del firmante actual — resalta su bloque con borde doble + chip "TU FIRMA" */
  currentFirmanteId?: string;
  /** Firma del usuario logueado como fallback para firmantes tipo agente sin firma guardada */
  userSignature?: string | null;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function ActaDocumento({ acta, company, currentFirmanteId, userSignature }: ActaDocumentoProps) {
  const primary   = company?.primaryColor   ?? '#003087';
  const secondary = company?.secondaryColor ?? '#0D7B6E';
  const logoData  = company?.logoData;
  const compName  = company?.commercialName || company?.name || 'EMPRESA';

  const client = acta?.project?.serviceOrder?.client;

  const modulos = parseChecklist(acta?.modulosChecklist, MODULOS_DEFAULT);
  const infra   = parseChecklist(acta?.infraestructuraChecklist, INFRA_DEFAULT);
  const docs    = parseChecklist(acta?.documentacionChecklist, DOCS_DEFAULT);
  const emision = parseChecklist(acta?.emisionElectronicaChecklist, EMISION_DEFAULT);

  const allFirmantes = acta?.firmantes ?? [];

  const TYPE_LABEL: Record<string, string> = {
    inicio:          'Acta de Inicio',
    visita:          'Acta de Visita',
    cierre:          'Acta de Cierre',
    capacitacion:    'Acta de Capacitacion',
    entrega_soporte: 'Entrega a Soporte',
  };
  const actatitle = (TYPE_LABEL[acta?.type] ?? 'ACTA').toUpperCase();

  const agentName = acta?.implementadorNombre
    || (acta?.createdBy ? `${acta.createdBy.firstName} ${acta.createdBy.lastName}` : null);
  const leftInfo = [
    agentName             && { icon: '👷', label: 'Agente:',          value: agentName },
    acta?.asunto          && { icon: '📋', label: 'Tema:',            value: acta.asunto },
    acta?.project?.name   && { icon: '🖥',  label: 'Proyecto:',        value: acta.project.name },
    client?.businessName  && { icon: '🏢', label: 'Empresa:',         value: client.businessName },
    acta?.fecha           && { icon: '▶',  label: 'Fecha de Inicio:',  value: fmtD(acta.fecha) },
    acta?.lugar           && { icon: '📢', label: 'Lugar:',            value: acta.lugar },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  // ── Sub-components ─────────────────────────────────────────────────────────
  const SectionHeader = ({ icon, title, color }: { icon: string; title: string; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 0 }}>
      <div style={{
        width: 46, height: 46, borderRadius: '50%', background: color, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 22, zIndex: 1, position: 'relative',
        boxShadow: `0 4px 12px ${color}55`,
      }}>{icon}</div>
      <div style={{
        background: color, color: '#fff', fontWeight: 800, fontSize: 13,
        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
        padding: '11px 22px 11px 16px', marginLeft: -6,
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
      }}>{title}</div>
      <div style={{ flex: 1, height: 2, background: color, opacity: 0.25, marginLeft: 10 }} />
      <span style={{ color, opacity: 0.55, letterSpacing: 5, fontSize: 18, paddingLeft: 10, paddingRight: 2 }}>:::::</span>
    </div>
  );

  const InfoCard = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: primary, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 20,
      }}>{icon}</div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: primary, margin: '0 0 3px 0' }}>{label}</p>
        <p style={{ fontSize: 11, color: '#374151', textTransform: 'uppercase' as const,
          margin: 0, lineHeight: 1.4, fontWeight: 500 }}>{value}</p>
      </div>
    </div>
  );

  const DataTable = ({ cols, rows }: { cols: string[]; rows: string[][] }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead><tr style={{ background: '#eef2f7' }}>
        {cols.map(h => <th key={h} style={{ padding: '7px 10px', textAlign: 'left',
          fontWeight: 600, color: '#475569', borderBottom: '1px solid #dde3ed' }}>{h}</th>)}
      </tr></thead>
      <tbody>{rows.map((row, i) => (
        <tr key={i}>{row.map((v, j) => (
          <td key={j} style={{ padding: '6px 10px', color: '#374151',
            borderBottom: '1px solid #f1f5f9' }}>{v}</td>
        ))}</tr>
      ))}</tbody>
    </table>
  );

  const SectionBody = ({ children }: { children: React.ReactNode }) => (
    <div style={{ padding: '4px 0 0 8px', marginBottom: 20,
      fontSize: 12, color: '#374151', lineHeight: 1.75 }}>{children}</div>
  );

  return (
    <div id="acta-print" style={{
      fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff',
      borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      display: 'flex', flexDirection: 'column', minHeight: 900,
    }}>

      {/* ═══ HEADER — compacto, se repite en cada página del PDF ═══ */}
      <div id="acta-header-bar" style={{ display: 'flex', minHeight: 82, position: 'relative',
        background: '#f8f9fb', overflow: 'hidden' }}>

        {/* Formas decorativas angulares */}
        <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 3, lineHeight: 0 }}>
          <svg width="160" height="88" viewBox="0 0 160 88" style={{ display: 'block' }}>
            <polygon points="40,0 160,0 160,88" fill={primary} />
            <polygon points="80,0 160,0 160,55" fill={primary} opacity="0.6" />
            <polygon points="0,0 160,0 160,18" fill={primary} opacity="0.15" />
          </svg>
        </div>

        {/* Logo + separador + nombre + título */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '12px 20px',
          gap: 14, zIndex: 4, position: 'relative' }}>
          {logoData ? (
            <img src={logoData} alt="logo" style={{ height: 52, maxWidth: 90, objectFit: 'contain' }} />
          ) : (
            <div style={{ height: 52, width: 80, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#e8edf5', borderRadius: 8,
              color: '#64748b', fontSize: 9, textAlign: 'center', padding: 6, fontWeight: 600 }}>
              {compName}
            </div>
          )}
          <div style={{ width: 2, height: 52, background: primary, borderRadius: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: primary, letterSpacing: '0.22em',
              textTransform: 'uppercase', margin: '0 0 2px 0' }}>{compName}</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: primary, letterSpacing: '0.04em',
              textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>{actatitle}</p>
          </div>
        </div>

        {/* Panel navy derecho */}
        <div style={{ background: primary, zIndex: 4, position: 'relative', overflow: 'hidden',
          padding: '10px 16px 10px 36px', minWidth: 160,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <svg style={{ position: 'absolute', left: 0, top: 0, width: 22, height: '100%', display: 'block' }}
               preserveAspectRatio="none" viewBox="0 0 22 88">
            <polygon points="0,0 22,0 0,88" fill="#f8f9fb" />
          </svg>
          {[
            { label: 'Código:', value: `FT-PRY-${String(acta?.numero ?? '01').padStart(2, '0')}` },
            { label: 'Versión:', value: '01' },
            { label: 'Fecha Emisión:', value: fmtD(acta?.fecha) || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ lineHeight: 1.2 }}>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.60)', margin: 0 }}>{label}</p>
              <p style={{ fontSize: 9, color: '#fff', fontWeight: 700, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ BODY (barra + contenido) — sección paginable ═══ */}
      <div id="acta-body-content">

      {/* BARRA: Acta No | Fecha | Cliente */}
      <div style={{ padding: '10px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center',
          background: '#fff', borderRadius: 12, padding: '10px 18px',
          boxShadow: '0 2px 12px rgba(0,60,140,0.08)', border: '1px solid #e6ecf8' }}>
          {([
            { icon: '📋', label: 'Acta No:', value: String(acta?.numero ?? '—') },
            { icon: '📅', label: 'Fecha:', value: fmtD(acta?.fecha) || '—' },
            ...(client?.businessName ? [{ icon: '🏢', label: 'Cliente:', value: client.businessName }] : []),
          ] as { icon: string; label: string; value: string }[]).map(({ icon, label, value }, i, arr) => (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: primary,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 17, flexShrink: 0 }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 1px 0' }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 900, color: primary, margin: 0, lineHeight: 1 }}>{value}</p>
                </div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ width: 1, height: 32, background: '#e2e8f0', margin: '0 20px' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ═══ CUERPO ═══ */}
      <div style={{ padding: '4px 24px 16px', flex: 1 }}>

        {/* INICIO — dos columnas */}
        {acta?.type === 'inicio' && (
          <div style={{ display: 'flex', gap: 22 }}>
            <div style={{ width: 196, flexShrink: 0, paddingTop: 6 }}>
              {leftInfo.map((row, i) => (
                <InfoCard key={i} icon={row.icon} label={row.label} value={row.value} />
              ))}
            </div>
            <div style={{ flex: 1, paddingTop: 6 }}>
              {acta.objetivoGeneral && (
                <div style={{ marginBottom: 22 }}>
                  <SectionHeader icon="🎯" title="Objetivo General" color={primary} />
                  <SectionBody><span style={{ whiteSpace: 'pre-line' }}>{acta.objetivoGeneral}</span></SectionBody>
                </div>
              )}
              {acta.alcance && (
                <div style={{ marginBottom: 22 }}>
                  <SectionHeader icon="👥" title="Alcance" color={secondary} />
                  <SectionBody><span style={{ whiteSpace: 'pre-line' }}>{acta.alcance}</span></SectionBody>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISITA */}
        {acta?.type === 'visita' && (
          <div>
            {(acta.implementadorNombre || acta.jefeNombre) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {acta.implementadorNombre && <InfoCard icon="👷" label="Implementador:" value={acta.implementadorNombre} />}
                {acta.jefeNombre && <InfoCard icon="👔" label="Jefe implementacion:" value={acta.jefeNombre} />}
              </div>
            )}
            {acta.fechasVisita?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="📅" title="Fechas de Visita" color={primary} />
                <SectionBody>
                  <DataTable cols={['Fecha','H. Inicio','H. Fin']}
                    rows={acta.fechasVisita.map((f: any) => [fmtD(f.fecha), f.horaInicio ?? '—', f.horaFin ?? '—'])} />
                </SectionBody>
              </div>
            )}
            {acta.actividadesRealizadas && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="✅" title="Actividades Realizadas" color={primary} />
                <SectionBody><span style={{ whiteSpace: 'pre-line' }}>{acta.actividadesRealizadas}</span></SectionBody>
              </div>
            )}
            {acta.actaActividades?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="📋" title="Actividades del Plan de Trabajo" color={primary} />
                <SectionBody>
                  <DataTable
                    cols={['Módulo','Fase','Actividad','Agente','Responsable Cliente']}
                    rows={acta.actaActividades.map((aa: any) => [
                      aa.activity?.phase?.projectModule?.name ?? '—',
                      aa.activity?.phase?.name ?? '—',
                      `${aa.activity?.code ?? ''} ${aa.activity?.name ?? ''}`.trim(),
                      aa.assignedTo ? `${aa.assignedTo.firstName} ${aa.assignedTo.lastName}` : '—',
                      aa.clientStaff ? `${aa.clientStaff.firstName} ${aa.clientStaff.lastName}` : '—',
                    ])}
                  />
                </SectionBody>
              </div>
            )}
            {acta.compromisos?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="📌" title="Compromisos" color={secondary} />
                <SectionBody>
                  <DataTable
                    cols={['#','Compromiso','Agente','Resp. Cliente','Módulo / Fase','Estado']}
                    rows={acta.compromisos.map((c: any, i: number) => [
                      String(i + 1),
                      c.compromiso,
                      c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : (c.responsable || '—'),
                      c.clientStaff ? `${c.clientStaff.firstName} ${c.clientStaff.lastName}` : '—',
                      [c.module?.name, c.phase?.name].filter(Boolean).join(' › ') || '—',
                      c.estado,
                    ])}
                  />
                </SectionBody>
              </div>
            )}
            {acta.acciones?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="✅" title="Observaciones y Acciones a Tomar" color={secondary} />
                <SectionBody>
                  <DataTable
                    cols={['Acción','Responsable','Fecha límite']}
                    rows={acta.acciones.map((a: any) => [
                      a.accion ?? '—', a.responsable ?? '—',
                      a.fechaLimite ? fmtD(a.fechaLimite) : '—',
                    ])} />
                </SectionBody>
              </div>
            )}
          </div>
        )}

        {/* CIERRE */}
        {acta?.type === 'cierre' && (() => {
          const cierreMods: {id:string;name:string}[] = (() => {
            try { return JSON.parse(acta.cierreModulosJson ?? '[]'); } catch { return []; }
          })();
          return (
            <div>
              {acta.cuerpo && (
                <div style={{ marginBottom: 18 }}>
                  <SectionHeader icon="📋" title="Descripción" color={primary} />
                  <SectionBody><span style={{ whiteSpace: 'pre-line' }}>{acta.cuerpo}</span></SectionBody>
                </div>
              )}
              {cierreMods.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <SectionHeader icon="📦" title="Módulos Cerrados" color={secondary} />
                  <SectionBody>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {cierreMods.map((m) => (
                        <li key={m.id} style={{ fontSize: 12, color: '#1e293b', marginBottom: 4, lineHeight: 1.5 }}>
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  </SectionBody>
                </div>
              )}
              {acta.contactos?.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <SectionHeader icon="📞" title="Contactos de Soporte" color={secondary} />
                  <SectionBody>
                    <DataTable cols={['Nombre','Teléfono','Área']}
                      rows={acta.contactos.map((c: any) => [c.nombre ?? '—', c.telefono ?? '—', c.area ?? '—'])} />
                  </SectionBody>
                </div>
              )}
            </div>
          );
        })()}

        {/* CAPACITACIÓN */}
        {acta?.type === 'capacitacion' && (
          <div>
            {(acta.modulo || acta.expositor || acta.horaInicio || acta.horaFin) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {acta.modulo && <InfoCard icon="📚" label="Modulo:" value={acta.modulo.name} />}
                {acta.expositor && <InfoCard icon="🎤" label="Expositor:" value={acta.expositor} />}
                {acta.horaInicio && <InfoCard icon="🕐" label="Hora inicio:" value={acta.horaInicio} />}
                {acta.horaFin && <InfoCard icon="🕑" label="Hora fin:" value={acta.horaFin} />}
              </div>
            )}
            {acta.actaActividades?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="📋" title="Actividades del Plan de Trabajo" color={primary} />
                <SectionBody>
                  <DataTable
                    cols={['Módulo','Fase','Actividad','Agente','Estado']}
                    rows={acta.actaActividades.map((aa: any) => [
                      aa.activity?.phase?.projectModule?.name ?? '—',
                      aa.activity?.phase?.name ?? '—',
                      `${aa.activity?.code ?? ''} ${aa.activity?.name ?? ''}`.trim(),
                      aa.assignedTo ? `${aa.assignedTo.firstName} ${aa.assignedTo.lastName}` : '—',
                      aa.status ?? '—',
                    ])}
                  />
                </SectionBody>
              </div>
            )}
            {acta.temasCapacitacion && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="📝" title="Temas y Ejercicios Prácticos" color={primary} />
                <SectionBody><span style={{ whiteSpace: 'pre-line' }}>{acta.temasCapacitacion}</span></SectionBody>
              </div>
            )}
            {acta.participantes?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="👥" title="Participantes" color={secondary} />
                <SectionBody>
                  <DataTable
                    cols={['#','Nombre','Cargo','Documento']}
                    rows={acta.participantes.map((p: any, i: number) => [
                      String(i+1), p.nombre, p.cargo ?? '—', p.documento ?? '—',
                    ])} />
                </SectionBody>
              </div>
            )}
            {acta.acciones?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="✅" title="Observaciones y Acciones a Tomar" color={secondary} />
                <SectionBody>
                  <DataTable
                    cols={['Acción','Responsable','Fecha límite']}
                    rows={acta.acciones.map((a: any) => [
                      a.accion ?? '—', a.responsable ?? '—',
                      a.fechaLimite ? fmtD(a.fechaLimite) : '—',
                    ])} />
                </SectionBody>
              </div>
            )}
          </div>
        )}

        {/* ENTREGA SOPORTE */}
        {acta?.type === 'entrega_soporte' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {acta.nitCliente && <InfoCard icon="🆔" label="NIT:" value={acta.nitCliente} />}
              {acta.sedes && <InfoCard icon="🏢" label="Sede(s):" value={acta.sedes} />}
              {acta.responsableImplementador && <InfoCard icon="👷" label="Resp. implementacion:" value={acta.responsableImplementador} />}
              {acta.responsableSoporte && <InfoCard icon="🛠" label="Resp. soporte:" value={acta.responsableSoporte} />}
            </div>
            {([
              { title: '1. Modulos entregados',    icon: '📦', color: primary,    cols: ['Modulo','Entregado','Observaciones'], rows: modulos.map((m: any) => [m.label, m.checked ? '✓ Si' : '✗ No', m.obs ?? '']) },
              { title: '3. Infraestructura tecnica', icon: '🖥', color: secondary, cols: ['Requisito','Cumple','Obs.'],          rows: infra.map((m: any)    => [m.label, m.checked ? '✓' : '✗', m.obs ?? '']) },
              { title: '5. Documentacion entregada', icon: '📄', color: primary,   cols: ['Documento','Entregado','Medio'],      rows: docs.map((m: any)     => [m.label, m.checked ? '✓' : '✗', m.medio ?? '']) },
              { title: '8. Emision electronica',     icon: '📡', color: secondary, cols: ['Componente','Entregado'],             rows: emision.map((m: any)  => [m.label, m.checked ? '✓' : '✗']) },
            ] as any[]).map(({ title, icon, color, cols, rows }) => (
              <div key={title} style={{ marginBottom: 18 }}>
                <SectionHeader icon={icon} title={title} color={color} />
                <SectionBody><DataTable cols={cols} rows={rows} /></SectionBody>
              </div>
            ))}
            {acta.observacionesGenerales && (
              <div style={{ marginBottom: 18 }}>
                <SectionHeader icon="💬" title="6. Observaciones Generales" color={secondary} />
                <SectionBody><span style={{ whiteSpace: 'pre-line' }}>{acta.observacionesGenerales}</span></SectionBody>
              </div>
            )}
          </div>
        )}

      </div>

      </div>{/* fin acta-body-content */}

      {/* ═══ FIRMANTES — sección independiente, nunca se parte ═══ */}
      {allFirmantes.length > 0 && (
        <div id="acta-firmantes-bar" style={{ padding: '6px 24px 16px' }}>
          <div style={{ display: 'grid', gap: 10,
            gridTemplateColumns: `repeat(${Math.min(allFirmantes.length, 3)}, 1fr)` }}>
            {allFirmantes.map((f: any, i: number) => {
              const isAgent   = f.signerType !== 'client';
              const barColor  = isAgent ? primary : secondary;
              const role      = f.cargo || (isAgent ? 'Representante Infotec' : 'Gerente');
              const isCurrent = f.id === currentFirmanteId;
              const sigImg    = f.signatureData || (isAgent ? userSignature : null);
              return (
                <div key={i} style={{ borderRadius: 8, overflow: 'hidden',
                  border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? barColor : barColor + '30'}`,
                  boxShadow: isCurrent ? `0 0 0 3px ${barColor}22` : '0 1px 6px rgba(0,0,0,0.05)' }}>
                  {/* Header pill */}
                  <div style={{ background: barColor, padding: '5px 10px',
                    display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' as const }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 9,
                      textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1,
                      lineHeight: 1.3, wordBreak: 'break-word' as const }}>{role}</span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)',
                      textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                      {isCurrent ? 'TU FIRMA' : isAgent ? 'Agente' : 'Cliente'}
                    </span>
                  </div>
                  {/* Área de firma */}
                  <div style={{ background: '#fff', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ height: 44, display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center', marginBottom: 5 }}>
                      {sigImg ? (
                        <img src={sigImg} alt="firma"
                          style={{ maxHeight: 40, maxWidth: '90%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '85%', height: 1, background: '#e2e8f0' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ flex: 1, height: 1.5, background: barColor, opacity: 0.22 }} />
                      <div style={{ width: 5, height: 5, borderRadius: '50%',
                        background: barColor, margin: '0 4px', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 1.5, background: barColor, opacity: 0.22 }} />
                    </div>
                    <p style={{ fontWeight: 800, fontSize: 9, color: primary,
                      textTransform: 'uppercase', margin: '0 0 1px 0', letterSpacing: '0.03em',
                      lineHeight: 1.3, wordBreak: 'break-word' as const }}>{f.nombre}</p>
                    {f.cargo && f.cargo !== role && (
                      <p style={{ fontSize: 8, color: '#64748b', margin: '0 0 1px 0',
                        lineHeight: 1.3 }}>{f.cargo}</p>
                    )}
                    {f.empresa && (
                      <p style={{ fontSize: 8, color: '#94a3b8', margin: 0,
                        lineHeight: 1.3 }}>{f.empresa}</p>
                    )}
                    {f.signedAt && (
                      <p style={{ fontSize: 7, color: barColor, fontWeight: 600, margin: '3px 0 0' }}>
                        Firmado: {new Date(f.signedAt).toLocaleDateString('es-CO')}
                      </p>
                    )}
                    {!f.signedAt && isCurrent && (
                      <p style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, margin: '2px 0 0' }}>
                        Pendiente tu firma
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ FOOTER — compacto, se repite en cada página del PDF ═══ */}
      <div id="acta-footer-bar" style={{
        background: '#f8f9fb', borderTop: '2px solid ' + primary,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
        gap: 10, padding: '8px 24px', flexWrap: 'wrap' as const, marginTop: 'auto',
      }}>
        {[
          { icon: '📍', text: company?.address || 'Barranquilla, Colombia', color: primary },
          { icon: '📞', text: company?.phone   || '',                       color: primary },
          { icon: '✉',  text: company?.email   || '',                       color: secondary },
          ...(company?.website ? [{ icon: '🌐', text: company.website,      color: secondary }] : []),
        ].filter(({ text }) => !!text).map(({ icon, text, color }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 120 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11 }}>{icon}</div>
            <p style={{ fontSize: 9, color: '#374151', margin: 0, lineHeight: 1.4 }}>{text}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
