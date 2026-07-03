import type { InformeData } from './InformeDocument';

/**
 * Maps the raw API response (DB field names) to the InformeData shape
 * expected by the react-pdf components.
 *
 * Must mirror the backend's transformPdfData() in service-orders.service.ts.
 */
export function transformForPdf(raw: any): InformeData {
  const { company, os, project, actas, notes,
          personalCapacitado, personalEnProceso, personalPendiente, personalInasistente,
          requerimientos, generatedAt } = raw;

  // ── 1. Flatten project modules → phases → activities into os.projectTasks ──
  const projectTasks = (project?.modules ?? []).flatMap((mod: any) =>
    (mod.phases ?? []).flatMap((phase: any) =>
      (phase.activities ?? []).map((act: any) => ({
        id:                   act.id,
        module:               mod.name,
        fase:                 phase.name,
        phase:                phase.name,
        code:                 act.code,
        taskName:             act.name,
        status:               act.status,
        completionPercentage: act.progressPercent ?? 0,
        assignedUser:         act.assignedTo ?? null,
        plannedStartDate:     act.plannedStartDate ?? null,
        plannedEndDate:       act.plannedEndDate ?? null,
        actualEndDate:        act.actualEndDate ?? null,
      })),
    ),
  );

  // ── 2. Transform actas (rename DB fields → PDF field names) ───────────────
  const transformedActas = (actas ?? []).map((a: any) => ({
    ...a,
    actaType:   a.type       ?? a.actaType,
    actaNumber: a.numero     ?? a.actaNumber,
    visitDate:  a.fecha      ?? a.visitDate,
    city:       a.municipio?.nombreMunicipio ?? a.city,
    module:     a.modulo?.name ?? a.module,
    sede:       a.sede       ?? null,
    startTime:  a.horaInicio ?? a.startTime ?? null,
    endTime:    a.horaFin    ?? a.endTime   ?? null,
    observaciones: a.observaciones ?? a.observations ?? null,
    objetivos:     a.objetivos  ?? null,
    alcance:       a.alcance    ?? null,
    tema:          a.tema       ?? null,
    resumen:       a.resumen    ?? null,
    descripcionServicio: a.descripcionServicio ?? null,

    // firmantes → signatures
    signatures: (a.firmantes ?? a.signatures ?? []).map((f: any) => ({
      id:            f.id ?? f.nombre,
      fullName:      f.nombre    ?? f.fullName,
      jobTitle:      f.cargo     ?? f.jobTitle,
      signatureData: f.signatureData ?? null,
      signedAt:      f.signedAt  ?? null,
      empresa:       f.empresa   ?? null,
      signerType:    f.signerType ?? null,
    })),

    // participants
    participants: (a.participantes ?? a.participants ?? []).map((p: any) => ({
      id:        p.id,
      nombre:    p.nombre ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
      cargo:     p.cargo  ?? p.jobTitle,
      documento: p.documento ?? p.document,
      entryTime: p.entryTime ?? p.horaEntrada,
      exitTime:  p.exitTime  ?? p.horaSalida,
      entrada:   p.horaEntrada ?? p.entryTime,
      salida:    p.horaSalida  ?? p.exitTime,
    })),

    // fechasVisita → visitDates
    visitDates: (a.fechasVisita ?? a.visitDates ?? []).map((fv: any) => ({
      date:      fv.fecha     ?? fv.date,
      startTime: fv.horaInicio ?? fv.startTime,
      endTime:   fv.horaFin    ?? fv.endTime,
    })),

    // actaActividades → actividades
    actividades: (a.actaActividades ?? a.actividades ?? []).map((aa: any) => {
      const act = aa.activity ?? aa;
      return {
        id:        aa.id,
        module:    act.phase?.projectModule?.name ?? act.module ?? '',
        modulo:    act.phase?.projectModule?.name ?? act.module ?? '',
        fase:      act.phase?.name ?? act.fase ?? '',
        phase:     act.phase?.name ?? act.fase ?? '',
        codigo:    act.code  ?? act.codigo ?? '',
        code:      act.code  ?? act.codigo ?? '',
        actividad: act.name  ?? act.actividad ?? act.taskName ?? '',
        taskName:  act.name  ?? act.actividad ?? act.taskName ?? '',
        status:    act.status ?? aa.status,
        estado:    act.status ?? aa.status,
      };
    }),

    // compromisos — normalize responsable field
    compromisos: (a.compromisos ?? []).map((c: any) => ({
      ...c,
      compromiso:  c.compromiso  ?? c.description,
      responsable: c.responsable
        ?? (c.assignedTo   ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : null)
        ?? (c.clientStaff  ? `${c.clientStaff.firstName} ${c.clientStaff.lastName}` : null)
        ?? '—',
      estado: c.estado ?? c.status,
    })),

    // acciones
    acciones: (a.acciones ?? []).map((ac: any) => ({
      ...ac,
      accion:      ac.accion      ?? ac.description,
      responsable: ac.responsable ?? ac.assignedTo ?? '—',
      fechaLimite: ac.fechaLimite ?? ac.dueDate,
    })),

    // Checklists
    checklistModulos: a.checklistModulos
      ?? (a.modulosChecklist  ? JSON.parse(a.modulosChecklist)  : null)
      ?? [],
    checklistInfra:   a.checklistInfra
      ?? (a.infraChecklist    ? JSON.parse(a.infraChecklist)    : null)
      ?? [],
    checklistDocs:    a.checklistDocs
      ?? (a.docsChecklist     ? JSON.parse(a.docsChecklist)     : null)
      ?? [],
    checklistEmision: a.checklistEmision
      ?? (a.emisionChecklist  ? JSON.parse(a.emisionChecklist)  : null)
      ?? [],

    // modulos covered (capacitacion)
    modulos: a.modulos ?? a.modules ?? [],

    // contactos cierre
    contactos: (a.contactos ?? []).map((c: any) => ({
      ...c,
      nombre:   c.nombre   ?? c.name,
      area:     c.area     ?? null,
      telefono: c.telefono ?? c.phone ?? null,
    })),
  }));

  // ── 3. Transform notes — exclude internal, map reason → title ───────────
  const transformedNotes = (notes ?? [])
    .filter((n: any) => (n.noteType ?? 'general') !== 'interna')
    .map((n: any) => ({
      ...n,
      title:       n.reason         ?? n.title       ?? '(Sin título)',
      description: n.noteMitigation ?? n.description ?? null,
      noteLevel:   n.noteLevel      ?? 'media',
      noteType:    n.noteType       ?? 'general',
      noteSubtype: n.noteSubtype    ?? null,
      resolved:    n.resolved       ?? false,
    }));

  return {
    company: {
      name:           company?.name,
      commercialName: company?.commercialName,
      nit:            company?.nit,
      city:           company?.city,
      phone:          company?.phone,
      email:          company?.email,
      website:        company?.website,
      primaryColor:   company?.primaryColor,
      secondaryColor: company?.secondaryColor ?? '#2563EB',
      logoData:       company?.logoData,
    },
    os: {
      ...os,
      projectTasks,
    },
    project,
    actas:              transformedActas,
    notes:              transformedNotes,
    requerimientos:     requerimientos     ?? [],
    personalCapacitado:  personalCapacitado  ?? [],
    personalEnProceso:   personalEnProceso   ?? [],
    personalPendiente:   personalPendiente   ?? [],
    personalInasistente: personalInasistente ?? [],
    generatedAt:         generatedAt         ?? new Date().toISOString(),
  };
}
