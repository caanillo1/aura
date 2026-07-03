import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateActaDto, UpdateActaDto } from './dto/acta.dto';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

const INCLUDE = {
  firmantes: { orderBy: { orden: 'asc' as const } },
  fechasVisita: { orderBy: { fecha: 'asc' as const } },
  compromisos: {
    select: {
      id: true, numero: true, compromiso: true, responsable: true,
      estado: true, assignedToId: true, clientStaffId: true,
      moduleId: true, phaseId: true, activityId: true,
      fechaLimite: true, responsablePrincipal: true,
      assignedTo:  { select: { id: true, firstName: true, lastName: true } },
      clientStaff: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      module:      { select: { id: true, name: true } },
      phase:       { select: { id: true, name: true } },
    },
  },
  participantes: { orderBy: { numero: 'asc' as const } },
  acciones: true,
  contactos: true,
  modulo: { select: { id: true, name: true } },
  municipio: { select: { id: true, nombreMunicipio: true, nombreDepartamento: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  actaActividades: {
    include: {
      activity: {
        select: {
          id: true, code: true, name: true, status: true, phaseId: true,
          assignedToId: true, clientStaffId: true,
          phase: { select: { id: true, name: true, projectModuleId: true,
            projectModule: { select: { id: true, name: true } } } },
        },
      },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      clientStaff: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
    },
  },
};

@Injectable()
export class ActasService {
  private readonly logger = new Logger(ActasService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private gateway: EventsGateway,
    private notifications: NotificationsService,
    private wa: WhatsAppService,
  ) {}

  async findAll(
    companyId: string,
    filters: { projectId?: string; type?: string; clientId?: string },
  ) {
    const { projectId, type, clientId } = filters;

    if (!projectId && !clientId) {
      throw new BadRequestException('Se requiere projectId o clientId');
    }

    let projectIds: string[];

    if (projectId) {
      await this.assertProjectAccess(companyId, projectId);
      projectIds = [projectId];
    } else {
      const projects = await this.prisma.project.findMany({
        where: { serviceOrder: { companyId, clientId } },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    }

    return this.prisma.acta.findMany({
      where: {
        projectId: { in: projectIds },
        ...(type ? { type } : {}),
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const acta = await this.prisma.acta.findUnique({ where: { id }, include: INCLUDE });
    if (!acta) throw new NotFoundException('Acta no encontrada');
    await this.assertProjectAccess(companyId, acta.projectId);
    return acta;
  }

  async create(companyId: string, userId: string, dto: CreateActaDto) {
    await this.assertProjectAccess(companyId, dto.projectId);

    const result = await this.withDeadlockRetry(() =>
      this.prisma.$transaction(async (tx) => {
        // Generate numero inside transaction so concurrent requests get sequential counts
        const numero = dto.numero ?? await this.generateNumeroTx(tx, dto.fecha);

        const acta = await tx.acta.create({
          data: {
            projectId: dto.projectId,
            type: dto.type,
            numero,
          fecha: new Date(dto.fecha),
          ciudad: dto.ciudad,
          municipioId: dto.municipioId,
          lugar: dto.lugar,
          asunto: dto.asunto,
          objetivoGeneral: dto.objetivoGeneral,
          alcance: dto.alcance,
          implementadorNombre: dto.implementadorNombre,
          jefeNombre: dto.jefeNombre,
          actividadesRealizadas: dto.actividadesRealizadas,
          cuerpo: dto.cuerpo,
          cierreModulosJson: dto.cierreModulosJson,
          moduloId: dto.moduloId,
          expositor: dto.expositor,
          temasCapacitacion: dto.temasCapacitacion,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          nitCliente: dto.nitCliente,
          sedes: dto.sedes,
          responsableImplementador: dto.responsableImplementador,
          responsableSoporte: dto.responsableSoporte,
          capacitacionModalidad: dto.capacitacionModalidad,
          capacitacionHoras: dto.capacitacionHoras,
          capacitacionPruebas: dto.capacitacionPruebas,
          requerimientosAdicionales: dto.requerimientosAdicionales,
          observacionesGenerales: dto.observacionesGenerales,
          ventanasDistintas: dto.ventanasDistintas,
          modulosChecklist: dto.modulosChecklist,
          infraestructuraChecklist: dto.infraestructuraChecklist,
          documentacionChecklist: dto.documentacionChecklist,
          emisionElectronicaChecklist: dto.emisionElectronicaChecklist,
          status: dto.status ?? 'borrador',
          createdById: userId,
        },
      });

      await this.upsertSubEntities(tx, acta.id, dto);
      return tx.acta.findUnique({ where: { id: acta.id }, include: INCLUDE });
    }, { timeout: 60000 }),
    );

    // Post-transaction syncs: errors here must NOT fail the request (acta is already saved)
    await Promise.allSettled([
      dto.actaActividades?.length ? this.syncActivitiesFromActa(result!.id).catch(err => this.logger.error(`syncActivities error: ${err?.message}`)) : Promise.resolve(),
      dto.compromisos?.length ? this.syncCompromisoPhases(result!.id).catch(err => this.logger.error(`syncCompromisos error: ${err?.message}`)) : Promise.resolve(),
    ]);
    this.sendFirmanteNotifications(result!.id, companyId); // fire-and-forget

    const ACTA_TYPE_LABEL: Record<string, string> = {
      inicio: 'Inicio', visita: 'Visita', capacitacion: 'Capacitación',
      parametrizacion: 'Parametrización', cierre: 'Cierre', entrega_soporte: 'Entrega/Soporte',
    };
    this.notifications.broadcastToAgents(
      companyId,
      {
        type: 'acta',
        title: `Acta de ${ACTA_TYPE_LABEL[dto.type] ?? dto.type} creada`,
        message: result!.numero ? `N° ${result!.numero}` : undefined,
        entityType: 'acta',
        entityId: result!.id,
      },
      this.gateway,
    );
    this.gateway.dashboardUpdate(companyId, { type: 'acta_created', payload: { id: result!.id } });

    return result;
  }

  async update(companyId: string, id: string, dto: UpdateActaDto) {
    const acta = await this.prisma.acta.findUnique({ where: { id } });
    if (!acta) throw new NotFoundException('Acta no encontrada');
    await this.assertProjectAccess(companyId, acta.projectId);

    // Pre-fetch emails actuales de firmantes existentes para detectar cambios
    const existingFirmanteIds = dto.firmantes?.filter(f => f.id).map(f => f.id as string) ?? [];
    const previousEmails = existingFirmanteIds.length
      ? await this.prisma.actaFirmante.findMany({
          where: { id: { in: existingFirmanteIds }, signedAt: null },
          select: { id: true, email: true },
        })
      : [];
    const prevEmailMap = new Map(previousEmails.map(f => [f.id, f.email ?? '']));

    // Pre-fetch emails de participantes-firmantes actuales para detectar nuevos
    const existingParticipantEmails = dto.participantes?.some(p => p.email)
      ? new Set<string>(
          (await this.prisma.actaFirmante.findMany({
            where: { actaId: id, signerType: 'participante', signedAt: null, email: { not: null } },
            select: { email: true },
          })).map((f: any) => f.email as string)
        )
      : new Set<string>();

    const result = await this.withDeadlockRetry(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.acta.update({
          where: { id },
        data: {
          ...(dto.numero !== undefined && { numero: dto.numero }),
          ...(dto.fecha && { fecha: new Date(dto.fecha) }),
          ...(dto.ciudad !== undefined && { ciudad: dto.ciudad }),
          ...(dto.municipioId !== undefined && { municipioId: dto.municipioId }),
          ...(dto.lugar !== undefined && { lugar: dto.lugar }),
          ...(dto.asunto !== undefined && { asunto: dto.asunto }),
          ...(dto.objetivoGeneral !== undefined && { objetivoGeneral: dto.objetivoGeneral }),
          ...(dto.alcance !== undefined && { alcance: dto.alcance }),
          ...(dto.implementadorNombre !== undefined && { implementadorNombre: dto.implementadorNombre }),
          ...(dto.jefeNombre !== undefined && { jefeNombre: dto.jefeNombre }),
          ...(dto.actividadesRealizadas !== undefined && { actividadesRealizadas: dto.actividadesRealizadas }),
          ...(dto.cuerpo !== undefined && { cuerpo: dto.cuerpo }),
          ...(dto.cierreModulosJson !== undefined && { cierreModulosJson: dto.cierreModulosJson }),
          ...(dto.moduloId !== undefined && { moduloId: dto.moduloId }),
          ...(dto.expositor !== undefined && { expositor: dto.expositor }),
          ...(dto.temasCapacitacion !== undefined && { temasCapacitacion: dto.temasCapacitacion }),
          ...(dto.horaInicio !== undefined && { horaInicio: dto.horaInicio }),
          ...(dto.horaFin !== undefined && { horaFin: dto.horaFin }),
          ...(dto.nitCliente !== undefined && { nitCliente: dto.nitCliente }),
          ...(dto.sedes !== undefined && { sedes: dto.sedes }),
          ...(dto.responsableImplementador !== undefined && { responsableImplementador: dto.responsableImplementador }),
          ...(dto.responsableSoporte !== undefined && { responsableSoporte: dto.responsableSoporte }),
          ...(dto.capacitacionModalidad !== undefined && { capacitacionModalidad: dto.capacitacionModalidad }),
          ...(dto.capacitacionHoras !== undefined && { capacitacionHoras: dto.capacitacionHoras }),
          ...(dto.capacitacionPruebas !== undefined && { capacitacionPruebas: dto.capacitacionPruebas }),
          ...(dto.requerimientosAdicionales !== undefined && { requerimientosAdicionales: dto.requerimientosAdicionales }),
          ...(dto.observacionesGenerales !== undefined && { observacionesGenerales: dto.observacionesGenerales }),
          ...(dto.ventanasDistintas !== undefined && { ventanasDistintas: dto.ventanasDistintas }),
          ...(dto.modulosChecklist !== undefined && { modulosChecklist: dto.modulosChecklist }),
          ...(dto.infraestructuraChecklist !== undefined && { infraestructuraChecklist: dto.infraestructuraChecklist }),
          ...(dto.documentacionChecklist !== undefined && { documentacionChecklist: dto.documentacionChecklist }),
          ...(dto.emisionElectronicaChecklist !== undefined && { emisionElectronicaChecklist: dto.emisionElectronicaChecklist }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

        await this.upsertSubEntities(tx, id, dto);
        return tx.acta.findUnique({ where: { id }, include: INCLUDE });
      }, { timeout: 60000 }),
    );

    await Promise.allSettled([
      dto.actaActividades?.length ? this.syncActivitiesFromActa(id).catch(err => this.logger.error(`syncActivities error: ${err?.message}`)) : Promise.resolve(),
      dto.compromisos?.length ? this.syncCompromisoPhases(id).catch(err => this.logger.error(`syncCompromisos error: ${err?.message}`)) : Promise.resolve(),
    ]);
    // Notifica: (1) firmantes nuevos sin id, (2) firmantes existentes que cambiaron de email
    const emailsToNotify: string[] = [];
    for (const f of dto.firmantes ?? []) {
      if (!f.email) continue;
      if (!f.id) {
        emailsToNotify.push(f.email);                            // nuevo firmante
      } else if (prevEmailMap.has(f.id) && prevEmailMap.get(f.id) !== f.email) {
        emailsToNotify.push(f.email);                            // email actualizado
      }
    }
    // (3) participantes con email nuevo (no estaban antes)
    for (const p of dto.participantes ?? []) {
      if (p.email && !existingParticipantEmails.has(p.email)) {
        emailsToNotify.push(p.email);
      }
    }
    if (emailsToNotify.length) this.sendFirmanteNotifications(id, companyId, emailsToNotify);
    return result;
  }

  async remove(companyId: string, id: string) {
    const acta = await this.prisma.acta.findFirst({
      where: { id, project: { serviceOrder: { companyId } } },
      select: { id: true },
    });
    if (!acta) throw new NotFoundException('Acta no encontrada o sin acceso');

    await this.prisma.$transaction([
      this.prisma.actaFirmante.deleteMany({ where: { actaId: id } }),
      this.prisma.actaFechaVisita.deleteMany({ where: { actaId: id } }),
      this.prisma.actaCompromiso.deleteMany({ where: { actaId: id } }),
      this.prisma.actaParticipante.deleteMany({ where: { actaId: id } }),
      this.prisma.actaAccion.deleteMany({ where: { actaId: id } }),
      this.prisma.actaContacto.deleteMany({ where: { actaId: id } }),
      this.prisma.actaActividad.deleteMany({ where: { actaId: id } }),
      this.prisma.acta.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  private async upsertSubEntities(tx: any, actaId: string, dto: CreateActaDto | UpdateActaDto) {
    // ── Secciones independientes: corren en paralelo ───────────────────────
    const parallelOps: Promise<any>[] = [];

    if (dto.fechasVisita !== undefined) {
      parallelOps.push(
        tx.actaFechaVisita.deleteMany({ where: { actaId } }).then(() =>
          dto.fechasVisita!.length > 0
            ? tx.actaFechaVisita.createMany({ data: dto.fechasVisita!.map(f => ({ actaId, fecha: new Date(f.fecha), horaInicio: f.horaInicio, horaFin: f.horaFin })) })
            : null
        )
      );
    }
    if (dto.acciones !== undefined) {
      parallelOps.push(
        tx.actaAccion.deleteMany({ where: { actaId } }).then(() =>
          dto.acciones!.length > 0
            ? tx.actaAccion.createMany({ data: dto.acciones!.map(a => ({ actaId, accion: a.accion, responsable: a.responsable, fechaLimite: a.fechaLimite ? new Date(a.fechaLimite) : null })) })
            : null
        )
      );
    }
    if (dto.contactos !== undefined) {
      parallelOps.push(
        tx.actaContacto.deleteMany({ where: { actaId } }).then(() =>
          dto.contactos!.length > 0
            ? tx.actaContacto.createMany({ data: dto.contactos!.map(c => ({ actaId, nombre: c.nombre, telefono: c.telefono, area: c.area })) })
            : null
        )
      );
    }
    if (dto.actaActividades !== undefined) {
      parallelOps.push(
        tx.actaActividad.deleteMany({ where: { actaId } }).then(() =>
          dto.actaActividades!.length > 0
            ? tx.actaActividad.createMany({ data: dto.actaActividades!.map(a => ({ actaId, activityId: a.activityId, assignedToId: a.assignedToId ?? null, clientStaffId: a.clientStaffId ?? null, status: a.status ?? 'completado' })) })
            : null
        )
      );
    }

    await Promise.all(parallelOps);

    // ── Firmantes: delete → updates en paralelo + creates en batch ─────────
    if (dto.firmantes !== undefined) {
      const keptIds = dto.firmantes.filter(f => f.id).map(f => f.id as string);
      await (keptIds.length === 0
        ? tx.actaFirmante.deleteMany({ where: { actaId } })
        : tx.actaFirmante.deleteMany({ where: { actaId, NOT: { id: { in: keptIds } } } })
      );

      const toUpdate = dto.firmantes.filter(f => !!f.id);
      const toCreate = dto.firmantes.filter(f => !f.id);
      await Promise.all([
        ...toUpdate.map((f, i) =>
          tx.actaFirmante.update({
            where: { id: f.id! },
            data: { nombre: f.nombre ?? '', cargo: f.cargo ?? null, empresa: f.empresa ?? null, email: f.email ?? null, telefono: f.telefono ?? null, fecha: f.fecha ? new Date(f.fecha) : null, orden: f.orden ?? i, documento: f.documento ?? null },
          })
        ),
        toCreate.length > 0
          ? tx.actaFirmante.createMany({ data: toCreate.map((f, i) => ({ actaId, nombre: f.nombre ?? '', cargo: f.cargo ?? null, empresa: f.empresa ?? null, email: f.email ?? null, telefono: f.telefono ?? null, fecha: f.fecha ? new Date(f.fecha) : null, orden: f.orden ?? (keptIds.length + i), documento: f.documento ?? null, signerType: f.signerType ?? null, signatureData: f.signatureData ?? null, signedAt: f.signatureData ? new Date() : null })) })
          : Promise.resolve(),
      ]);
    }

    // ── Participantes: recreate table + smart upsert firmantes ─────────────
    // actaParticipante se recrea libremente (sus IDs no son externos).
    // actaFirmante con signerType='participante' se hace UPSERT por documento/email
    // para preservar los IDs y mantener válidos los links de firma ya enviados.
    if (dto.participantes !== undefined) {
      await tx.actaParticipante.deleteMany({ where: { actaId } });
      if (dto.participantes.length > 0) {
        await tx.actaParticipante.createMany({ data: dto.participantes.map((p, i) => ({ actaId, numero: p.numero ?? i + 1, nombre: p.nombre, cargo: p.cargo, documento: p.documento, email: p.email ?? null, horaEntrada: p.horaEntrada, horaSalida: p.horaSalida, comprendio: p.comprendio })) });
      }

      // Fetch estado actual de firmantes-participante
      const [existingUnsigned, signedFirmantes] = await Promise.all([
        tx.actaFirmante.findMany({
          where: { actaId, signerType: 'participante', signedAt: null },
          select: { id: true, documento: true, email: true },
        }),
        tx.actaFirmante.findMany({
          where: { actaId, signerType: 'participante', signedAt: { not: null } },
          select: { documento: true },
        }),
      ]);
      const signedDocs = new Set(signedFirmantes.map((f: any) => f.documento).filter(Boolean));

      // Índices para buscar existentes por documento o email
      const byDoc   = new Map(existingUnsigned.filter(f => f.documento).map(f => [f.documento!, f]));
      const byEmail = new Map(existingUnsigned.filter(f => f.email && !f.documento).map(f => [f.email!, f]));

      // Participantes que necesitan firmante: tienen documento o email y no están ya firmados
      const canSign = dto.participantes.filter(p =>
        (p.documento || p.email) && (!p.documento || !signedDocs.has(p.documento))
      );

      // Separar en: actualizar existentes vs crear nuevos
      const matchedIds = new Set<string>();
      const toUpdate: Array<{ existing: { id: string }; p: typeof canSign[0] }> = [];
      const toCreate: typeof canSign = [];
      for (const p of canSign) {
        const existing = ((p.documento ? byDoc.get(p.documento) : undefined)
          ?? (p.email && !p.documento ? byEmail.get(p.email) : undefined)) as { id: string } | undefined;
        if (existing) {
          matchedIds.add(existing.id);
          toUpdate.push({ existing, p });
        } else {
          toCreate.push(p);
        }
      }

      // Eliminar solo los que ya no están en la lista de participantes
      const orphanIds = existingUnsigned.filter(f => !matchedIds.has(f.id)).map(f => f.id);
      if (orphanIds.length > 0) {
        await tx.actaFirmante.deleteMany({ where: { id: { in: orphanIds } } });
      }

      // Actualizar existentes (preserva el ID → el link de firma sigue siendo válido)
      const currentCount = await tx.actaFirmante.count({ where: { actaId } });
      await Promise.all([
        ...toUpdate.map(({ existing, p }) =>
          tx.actaFirmante.update({
            where: { id: existing.id },
            data: { nombre: p.nombre, cargo: p.cargo ?? '', email: p.email ?? null, documento: p.documento ?? null },
          })
        ),
        ...toCreate.map((p, i) =>
          tx.actaFirmante.create({
            data: { actaId, nombre: p.nombre, cargo: p.cargo ?? '', empresa: '', documento: p.documento ?? null, email: p.email ?? null, signerType: 'participante', orden: currentCount + i, fecha: new Date() },
          })
        ),
      ]);
    }

    // ── Compromisos: pre-fetch paralelo → updates paralelo → creates secuencial → bulk insert ──
    if (dto.compromisos !== undefined) {
      const actaRecord = await tx.acta.findUnique({ where: { id: actaId }, select: { fecha: true } });
      const actaFecha: Date | null = actaRecord?.fecha ?? null;

      await tx.actaCompromiso.deleteMany({ where: { actaId } });

      if (dto.compromisos.length > 0) {
        const compWithPhaseAndActivity = dto.compromisos.filter(c => c.phaseId && c.activityId);
        const phaseIdsForNew = [...new Set(dto.compromisos.filter(c => c.phaseId && !c.activityId).map(c => c.phaseId!))];

        // Pre-fetch: activity existence checks + phase orders (in parallel)
        const [existenceResults, phaseResults] = await Promise.all([
          compWithPhaseAndActivity.length > 0
            ? Promise.all(compWithPhaseAndActivity.map(c =>
                tx.activity.findUnique({ where: { id: c.activityId! }, select: { id: true } }).then((e: any) => [c.activityId!, !!e] as [string, boolean])
              ))
            : Promise.resolve([] as [string, boolean][]),
          phaseIdsForNew.length > 0
            ? Promise.all(phaseIdsForNew.map(phaseId =>
                tx.phase.findUnique({ where: { id: phaseId }, select: { id: true, slug: true, activities: { orderBy: { order: 'desc' }, select: { order: true }, take: 1 } } })
                  .then((p: any) => [phaseId, p] as [string, any])
              ))
            : Promise.resolve([] as [string, any][]),
        ]);

        const existenceMap = new Map<string, boolean>(existenceResults);
        const phaseOrderMap = new Map<string, { slug: string | null; nextOrder: number }>(
          phaseResults.filter(([, p]: [string, any]) => p).map(([id, p]: [string, any]) => [id, { slug: p.slug, nextOrder: (p.activities[0]?.order ?? 0) + 1 }])
        );

        // Update existing activities in parallel
        await Promise.all(
          dto.compromisos
            .filter(c => c.activityId && existenceMap.get(c.activityId))
            .map(c => {
              const actStatus = this.compromisoEstadoToActivityStatus(c.estado ?? 'pendiente');
              return tx.activity.update({ where: { id: c.activityId! }, data: { name: c.compromiso, status: actStatus, progressPercent: this.statusToProgress(actStatus), assignedToId: c.assignedToId ?? null, clientStaffId: c.clientStaffId ?? null } });
            })
        );

        // Resolve activityIds — create new activities sequentially (order counter must be in-order)
        const finalActivityIds: (string | null)[] = [];
        for (const c of dto.compromisos) {
          if (!c.phaseId) { finalActivityIds.push(null); continue; }
          if (c.activityId && existenceMap.get(c.activityId)) { finalActivityIds.push(c.activityId); continue; }

          const phaseInfo = phaseOrderMap.get(c.phaseId);
          if (!phaseInfo) { finalActivityIds.push(null); continue; }

          const actStatus = this.compromisoEstadoToActivityStatus(c.estado ?? 'pendiente');
          const code = `${(phaseInfo.slug ?? 'COMP').toUpperCase()}-${String(phaseInfo.nextOrder).padStart(2, '0')}`;
          const newAct = await tx.activity.create({ data: { phaseId: c.phaseId, code, name: c.compromiso, status: actStatus, progressPercent: this.statusToProgress(actStatus), assignedToId: c.assignedToId ?? null, clientStaffId: c.clientStaffId ?? null, order: phaseInfo.nextOrder, observations: `Generado desde compromiso del Acta de Visita`, plannedStartDate: actaFecha ?? undefined, plannedEndDate: c.fechaLimite ? new Date(c.fechaLimite) : null } });
          phaseInfo.nextOrder++;
          finalActivityIds.push(newAct.id);
        }

        // Bulk insert all compromisos in one query
        await tx.actaCompromiso.createMany({ data: dto.compromisos.map((c, i) => ({ actaId, numero: c.numero ?? i + 1, compromiso: c.compromiso, responsable: c.responsable ?? null, estado: c.estado ?? 'pendiente', assignedToId: c.assignedToId ?? null, clientStaffId: c.clientStaffId ?? null, moduleId: c.moduleId ?? null, phaseId: c.phaseId ?? null, activityId: finalActivityIds[i] ?? null, fechaLimite: c.fechaLimite ? new Date(c.fechaLimite) : null, responsablePrincipal: c.responsablePrincipal ?? null })) });
      }
    }
  }

  async signFirmante(firmanteId: string, signatureData: string, signerType: 'agent' | 'client', comprendio?: boolean) {
    const firmante = await this.prisma.actaFirmante.findUnique({
      where: { id: firmanteId },
      select: {
        actaId: true,
        nombre: true,
        signerType: true,
        acta: {
          select: {
            type: true, numero: true,
            createdBy: { select: { firstName: true, lastName: true, email: true } },
            project: { select: { serviceOrder: { select: { companyId: true, client: { select: { businessName: true } } } } } },
          },
        },
      },
    });
    if (!firmante) throw new NotFoundException('Firmante no encontrado');

    // Preserve existing signerType (e.g. 'participante') — only set if currently null
    const resolvedSignerType = firmante.signerType ?? signerType;

    await this.prisma.actaFirmante.update({
      where: { id: firmanteId },
      data: {
        signatureData, signedAt: new Date(), signerType: resolvedSignerType,
        ...(comprendio !== undefined && { comprendio }),
      },
    });

    // Notificar al implementador que el firmante ya firmó (fire-and-forget)
    this.notifyImplementadorFirma(firmante, signerType);

    // Notificación in-app a todos los agentes
    const companyId = firmante.acta?.project?.serviceOrder?.companyId;
    if (companyId) {
      const ACTA_LABEL: Record<string, string> = {
        inicio: 'Inicio', visita: 'Visita', capacitacion: 'Capacitación',
        parametrizacion: 'Parametrización', cierre: 'Cierre', entrega_soporte: 'Entrega/Soporte',
      };
      this.notifications.broadcastToAgents(
        companyId,
        {
          type: 'acta',
          title: `✍️ Firma recibida en Acta de ${ACTA_LABEL[firmante.acta!.type] ?? firmante.acta!.type}`,
          message: `${firmante.nombre} firmó${firmante.acta?.numero ? ` · N° ${firmante.acta.numero}` : ''}`,
          entityType: 'acta',
          entityId: firmante.actaId,
        },
        this.gateway,
      );
      this.gateway.dashboardUpdate(companyId, { type: 'acta_signed', payload: { actaId: firmante.actaId } });
    }

    // Auto-finalize and mark linked activities when all firmantes have signed
    const all = await this.prisma.actaFirmante.findMany({
      where: { actaId: firmante.actaId },
      select: { signedAt: true },
    });
    if (all.length > 0 && all.every(f => f.signedAt)) {
      await this.prisma.acta.update({
        where: { id: firmante.actaId },
        data: { status: 'finalizado' },
      });
      // Update linked plan-de-trabajo activities with their assigned status
      const [linkedActivities, acta] = await Promise.all([
        this.prisma.actaActividad.findMany({
          where: { actaId: firmante.actaId },
          select: { activityId: true, status: true },
        }),
        this.prisma.acta.findUnique({
          where: { id: firmante.actaId },
          select: { createdById: true, numero: true, fecha: true, type: true },
        }),
      ]);
      if (linkedActivities.length) {
        const updatesMap = new Map<string, { status: string; progressPercent: number }>(
          linkedActivities.map(aa => {
            const status = aa.status ?? 'completado';
            return [aa.activityId, { status, progressPercent: this.statusToProgress(status) }] as [string, { status: string; progressPercent: number }];
          }),
        );
        // Pre-fetch activities with phase siblings for avg computation
        const activities = await this.prisma.activity.findMany({
          where: { id: { in: [...updatesMap.keys()] } },
          select: {
            id: true,
            phaseId: true,
            phase: { select: { activities: { select: { id: true, progressPercent: true, status: true } } } },
          },
        });
        const phaseUpdates = new Map<string, { progressPercent: number; status: string }>();
        for (const act of activities) {
          if (phaseUpdates.has(act.phaseId)) continue;
          const sibActs = act.phase.activities.map(a => {
            const upd = updatesMap.get(a.id);
            return upd ? upd : { status: a.status, progressPercent: Number(a.progressPercent) };
          });
          const avg = Math.round(sibActs.reduce((s, a) => s + a.progressPercent, 0) / sibActs.length);
          let phStatus = 'pendiente';
          if (sibActs.every(a => a.status === 'completado')) phStatus = 'completado';
          else if (sibActs.some(a => a.status === 'en_progreso' || a.status === 'completado')) phStatus = 'en_progreso';
          phaseUpdates.set(act.phaseId, { progressPercent: avg, status: phStatus });
        }
        const executionDate = acta?.fecha ?? new Date();
        // All writes in parallel
        await Promise.all([
          ...activities.map(act => {
            const upd = updatesMap.get(act.id)!;
            return this.prisma.activity.update({
              where: { id: act.id },
              data: {
                status: upd.status,
                progressPercent: upd.progressPercent,
                executionDate,
              },
            });
          }),
          ...(acta?.createdById
            ? activities.map(act => {
                const upd = updatesMap.get(act.id)!;
                return this.prisma.activityThread.create({
                  data: {
                    activityId: act.id,
                    authorId: acta!.createdById!,
                    authorType: 'agent',
                    newStatus: upd.status,
                    content: `Estado actualizado a "${upd.status}" mediante ${this.actaTypeLabel(acta?.type)} No. ${acta?.numero ?? ''} (firmada por todos los participantes).`,
                  },
                });
              })
            : []),
          ...[...phaseUpdates.entries()].map(([phaseId, data]) =>
            this.prisma.phase.update({ where: { id: phaseId }, data }),
          ),
        ]);
      }
    }

    return { ok: true };
  }

  async updateCompromiso(companyId: string, compromisoId: string, data: { estado: string }) {
    const compromiso = await this.prisma.actaCompromiso.findFirst({
      where: {
        id: compromisoId,
        acta: { project: { serviceOrder: { companyId } } },
      },
      select: { id: true, activityId: true },
    });
    if (!compromiso) throw new NotFoundException('Compromiso no encontrado');

    const updated = await this.prisma.actaCompromiso.update({
      where: { id: compromisoId },
      data: { estado: data.estado },
      select: { id: true, estado: true },
    });

    // Sync linked activity status
    if (compromiso.activityId) {
      const actStatus = this.compromisoEstadoToActivityStatus(data.estado);
      const activity = await this.prisma.activity.update({
        where: { id: compromiso.activityId },
        data: {
          status: actStatus,
          progressPercent: this.statusToProgress(actStatus),
          ...(actStatus === 'completado' ? { actualEndDate: new Date() } : {}),
        },
        select: { phaseId: true },
      });
      await this.checkAndCompletePhase(activity.phaseId);
    }

    return updated;
  }

  async toggleAsistencia(companyId: string, participanteId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; asistio: boolean }>>`
      SELECT ap.id, ap.asistio
      FROM ActaParticipantes ap
      INNER JOIN Actas a ON a.id = ap.actaId
      INNER JOIN Proyectos p ON p.id = a.projectId
      INNER JOIN OrdenesServicio os ON os.id = p.serviceOrderId
      WHERE ap.id = ${participanteId} AND os.companyId = ${companyId}
    `;
    if (!rows.length) throw new NotFoundException('Participante no encontrado');
    const nuevoValor = rows[0].asistio === false ? 1 : 0;
    await this.prisma.$executeRaw`
      UPDATE ActaParticipantes SET asistio = ${nuevoValor} WHERE id = ${participanteId}
    `;
    return { id: participanteId, asistio: nuevoValor === 1 };
  }

  async finalizeActa(companyId: string, id: string) {
    const acta = await this.prisma.acta.findUnique({ where: { id } });
    if (!acta) throw new NotFoundException('Acta no encontrada');
    await this.assertProjectAccess(companyId, acta.projectId);
    return this.prisma.acta.update({ where: { id }, data: { status: 'finalizado' } });
  }

  async searchPendingByDocumento(documento: string) {
    return this.prisma.actaFirmante.findMany({
      where: { documento, signedAt: null },
      include: {
        acta: {
          select: {
            id: true, type: true, numero: true, fecha: true, asunto: true,
            status: true,
            project: {
              select: {
                name: true,
                serviceOrder: {
                  select: { client: { select: { businessName: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { acta: { fecha: 'asc' } },
    });
  }

  async getPublicActaFull(firmanteId: string) {
    const f = await this.prisma.actaFirmante.findUnique({
      where: { id: firmanteId },
      select: { actaId: true },
    });
    if (!f) throw new NotFoundException('Firmante no encontrado');
    return this.prisma.acta.findUnique({
      where: { id: f.actaId },
      include: {
        ...INCLUDE,
        project: {
          select: {
            name: true,
            serviceOrder: {
              select: {
                client: { select: { businessName: true, city: true } },
                company: {
                  select: {
                    name: true, commercialName: true,
                    primaryColor: true, secondaryColor: true,
                    logoData: true, address: true, phone: true,
                    email: true, website: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getPublicFirmante(firmanteId: string) {
    const f = await this.prisma.actaFirmante.findUnique({
      where: { id: firmanteId },
      include: {
        acta: {
          select: {
            id: true, type: true, fecha: true, numero: true,
            project: {
              select: {
                name: true,
                serviceOrder: { select: { client: { select: { businessName: true, city: true } } } },
              },
            },
          },
        },
      },
    });
    if (!f) throw new NotFoundException('Firmante no encontrado');
    return f;
  }

  private async syncCompromisoPhases(actaId: string) {
    const compromisos = await this.prisma.actaCompromiso.findMany({
      where: { actaId, phaseId: { not: null } },
      select: { phaseId: true },
    });
    const phaseIds: string[] = [...new Set(compromisos.map(c => c.phaseId!))];
    if (!phaseIds.length) return;

    // One query for all phases' activities
    const activities = await this.prisma.activity.findMany({
      where: { phaseId: { in: phaseIds } },
      select: { phaseId: true, status: true, progressPercent: true },
    });

    const byPhase = new Map<string, typeof activities>();
    for (const act of activities) {
      if (!byPhase.has(act.phaseId)) byPhase.set(act.phaseId, []);
      byPhase.get(act.phaseId)!.push(act);
    }

    // All phase updates in parallel
    await Promise.all(
      phaseIds.map(phaseId => {
        const acts = byPhase.get(phaseId) ?? [];
        if (!acts.length) return Promise.resolve();
        const avg = Math.round(acts.reduce((s, a) => s + Number(a.progressPercent), 0) / acts.length);
        let status = 'pendiente';
        if (acts.every(a => a.status === 'completado')) status = 'completado';
        else if (acts.some(a => a.status === 'en_progreso' || a.status === 'completado')) status = 'en_progreso';
        return this.prisma.phase.update({ where: { id: phaseId }, data: { progressPercent: avg, status } });
      }),
    );
  }

  private compromisoEstadoToActivityStatus(estado: string): string {
    switch (estado) {
      case 'completado': return 'completado';
      case 'en_proceso': return 'en_progreso';
      default:           return 'pendiente';
    }
  }

  private async syncActivitiesFromActa(actaId: string) {
    const acta = await this.prisma.acta.findUnique({
      where: { id: actaId },
      select: {
        fecha: true,
        actaActividades: { select: { activityId: true, status: true } },
      },
    });
    if (!acta || !acta.actaActividades.length) return;

    const updatesMap = new Map<string, { status: string; progressPercent: number }>(
      acta.actaActividades.map(aa => {
        const status = aa.status ?? 'completado';
        return [aa.activityId, { status, progressPercent: this.statusToProgress(status) }] as [string, { status: string; progressPercent: number }];
      }),
    );

    // Query activities with full cascade info: phase siblings + module phases + project modules
    const activities = await this.prisma.activity.findMany({
      where: { id: { in: [...updatesMap.keys()] } },
      select: {
        id: true,
        phaseId: true,
        phase: {
          select: {
            projectModuleId: true,
            activities: { select: { id: true, progressPercent: true, status: true } },
            projectModule: {
              select: {
                projectId: true,
                phases: { select: { id: true, progressPercent: true } },
                project: { select: { modules: { select: { id: true, progressPercent: true } } } },
              },
            },
          },
        },
      },
    });

    if (!activities.length) return;

    // Phase averages (substitution pattern — no extra DB reads)
    const phaseUpdates = new Map<string, { progressPercent: number; status: string }>();
    for (const act of activities) {
      if (phaseUpdates.has(act.phaseId)) continue;
      const sibActs = act.phase.activities.map(a => {
        const upd = updatesMap.get(a.id);
        return upd ? upd : { status: a.status, progressPercent: Number(a.progressPercent) };
      });
      const avg = Math.round(sibActs.reduce((s, a) => s + a.progressPercent, 0) / sibActs.length);
      let phStatus = 'pendiente';
      if (sibActs.every(a => a.status === 'completado')) phStatus = 'completado';
      else if (sibActs.some(a => a.status === 'en_progreso' || a.status === 'completado')) phStatus = 'en_progreso';
      phaseUpdates.set(act.phaseId, { progressPercent: avg, status: phStatus });
    }

    // Module averages — substituting updated phase values in memory
    const moduleUpdates = new Map<string, { progressPercent: number; projectId: string }>();
    for (const act of activities) {
      const moduleId = act.phase.projectModuleId;
      if (moduleUpdates.has(moduleId)) continue;
      const mod = act.phase.projectModule;
      const modAvg = mod.phases.length
        ? Math.round(
            mod.phases.reduce((s, p) => {
              const upd = phaseUpdates.get(p.id);
              return s + (upd ? upd.progressPercent : Number(p.progressPercent));
            }, 0) / mod.phases.length,
          )
        : 0;
      moduleUpdates.set(moduleId, { progressPercent: modAvg, projectId: mod.projectId });
    }

    // Project average — substituting updated module values in memory
    const projectUpdates = new Map<string, number>();
    for (const act of activities) {
      const { projectId, project } = act.phase.projectModule;
      if (projectUpdates.has(projectId)) continue;
      const projAvg = project.modules.length
        ? Math.round(
            project.modules.reduce((s, m) => {
              const upd = moduleUpdates.get(m.id);
              return s + (upd ? upd.progressPercent : Number(m.progressPercent));
            }, 0) / project.modules.length,
          )
        : 0;
      projectUpdates.set(projectId, projAvg);
    }

    const executionDate = acta.fecha ?? new Date();

    // All writes in one parallel batch: activities → phases → modules → project
    await Promise.all([
      ...activities.map(act => {
        const upd = updatesMap.get(act.id)!;
        return this.prisma.activity.update({
          where: { id: act.id },
          data: {
            status: upd.status,
            progressPercent: upd.progressPercent,
            executionDate,
          },
        });
      }),
      ...[...phaseUpdates.entries()].map(([phaseId, data]) =>
        this.prisma.phase.update({ where: { id: phaseId }, data }),
      ),
      ...[...moduleUpdates.entries()].map(([moduleId, { progressPercent }]) =>
        this.prisma.projectModule.update({ where: { id: moduleId }, data: { progressPercent } }),
      ),
      ...[...projectUpdates.entries()].map(([projectId, progressPercent]) =>
        this.prisma.project.update({ where: { id: projectId }, data: { progressPercent } }),
      ),
    ]);
  }

  private actaTypeLabel(type?: string | null): string {
    const labels: Record<string, string> = {
      inicio: 'Acta de Inicio', visita: 'Acta de Visita', cierre: 'Acta de Cierre',
      capacitacion: 'Acta de Capacitación', entrega_soporte: 'Acta de Entrega a Soporte',
    };
    return labels[type ?? ''] ?? 'Acta';
  }

  private statusToProgress(status: string): number {
    switch (status) {
      case 'completado':  return 100;
      case 'en_progreso': return 50;
      default:            return 0;
    }
  }

  private async checkAndCompletePhase(phaseId: string) {
    const activities = await this.prisma.activity.findMany({
      where: { phaseId },
      select: { status: true, progressPercent: true },
    });
    if (activities.length === 0) return;
    if (activities.every(a => a.status === 'completado')) {
      await this.prisma.phase.update({
        where: { id: phaseId },
        data: { status: 'completado', progressPercent: 100 },
      });
    } else {
      const avg = activities.reduce((s, a) => s + Number(a.progressPercent), 0) / activities.length;
      const phaseStatus = activities.some(a => a.status === 'en_progreso' || a.status === 'completado')
        ? 'en_progreso' : 'pendiente';
      await this.prisma.phase.update({
        where: { id: phaseId },
        data: { progressPercent: Math.round(avg), status: phaseStatus },
      });
    }
  }

  private async generateNumeroTx(tx: any, fecha: string): Promise<string> {
    const d = new Date(fecha);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const startOfDay = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    const endOfDay   = new Date(startOfDay.getTime() + 86_400_000);
    const count = await tx.acta.count({
      where: { fecha: { gte: startOfDay, lt: endOfDay } },
    });
    return `${yyyy}${mm}${dd}${String(count + 1).padStart(2, '0')}`;
  }

  // Retries the given operation up to 3 times on SQL Server deadlock (P2034)
  private async withDeadlockRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const isDeadlock = err?.code === 'P2034' || err?.message?.includes('deadlock') || err?.message?.includes('write conflict');
        if (!isDeadlock || attempt === maxRetries) throw err;
        this.logger.warn(`Deadlock en intento ${attempt}/${maxRetries}, reintentando…`);
        lastError = err;
        await new Promise(r => setTimeout(r, 100 * attempt));
      }
    }
    throw lastError;
  }

  private async assertProjectAccess(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new ForbiddenException('Proyecto no encontrado o sin acceso');
  }

  // Notifica al implementador (createdBy del acta) que un firmante acaba de firmar.
  private async notifyImplementadorFirma(firmante: any, signerType: string): Promise<void> {
    try {
      const impl      = firmante.acta?.createdBy;
      const companyId = firmante.acta?.project?.serviceOrder?.companyId;
      if (!impl?.email || !companyId) return;

      const TYPE_LABELS: Record<string, string> = {
        inicio: 'Acta de Inicio', visita: 'Acta de Visita', cierre: 'Acta de Cierre',
        capacitacion: 'Acta de Capacitación', entrega_soporte: 'Entrega a Soporte',
      };
      const typeLabel  = TYPE_LABELS[firmante.acta?.type] ?? 'Documento';
      const numero     = firmante.acta?.numero ? ` No. ${firmante.acta.numero}` : '';
      const cliente    = firmante.acta?.project?.serviceOrder?.client?.businessName ?? '';
      const tipoFirma  = signerType === 'client' ? 'cliente' : 'agente';
      const fechaHora  = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' });
      const implNombre = `${impl.firstName} ${impl.lastName}`;

      const subject = `✅ ${firmante.nombre} firmó el ${typeLabel}${numero}`;

      const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#334155;line-height:1.7;font-size:14px;">
  <div style="background:#1E3A5F;padding:20px 28px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">Firma registrada exitosamente</p>
  </div>
  <div style="background:#f8fafc;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p>Hola <strong>${implNombre}</strong>,</p>
    <p>Le informamos que <strong>${firmante.nombre}</strong> ha firmado el siguiente documento:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;" cellpadding="0" cellspacing="0">
      <tr style="background:#e8eef5;">
        <td style="padding:8px 12px;font-weight:600;width:120px;border-radius:4px 0 0 0;">Documento</td>
        <td style="padding:8px 12px;border-radius:0 4px 0 0;">${typeLabel}${numero}</td>
      </tr>
      ${cliente ? `<tr><td style="padding:8px 12px;font-weight:600;background:#f1f5f9;">Cliente</td><td style="padding:8px 12px;background:#f1f5f9;">${cliente}</td></tr>` : ''}
      <tr>
        <td style="padding:8px 12px;font-weight:600;background:#e8eef5;">Firmante</td>
        <td style="padding:8px 12px;background:#e8eef5;">${firmante.nombre}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;background:#f1f5f9;">Tipo firma</td>
        <td style="padding:8px 12px;background:#f1f5f9;text-transform:capitalize;">${tipoFirma}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;background:#e8eef5;">Fecha y hora</td>
        <td style="padding:8px 12px;background:#e8eef5;">${fechaHora}</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#64748b;">Puede ingresar al sistema para verificar el estado de firmas del documento.</p>
  </div>
</div>`;

      await this.mail.sendFromCompany(companyId, [impl.email], subject, html)
        .then(() => console.log(`[ACTAS] Notificación de firma enviada a implementador ${impl.email}`))
        .catch(err => console.error(`[ACTAS] Error notificando implementador ${impl.email}:`, err?.message ?? err));
    } catch (err: any) { console.error('[ACTAS] notifyImplementadorFirma error:', err?.message ?? err); }
  }

  // Envía notificación de firma a firmantes con email.
  // onlyEmails: si se pasa, solo notifica a esas direcciones (updates con firmantes nuevos).
  // Es fire-and-forget: los errores de correo no interrumpen el guardado del acta.
  async resendFirmanteEmail(companyId: string, actaId: string, firmanteId?: string) {
    const acta = await this.prisma.acta.findFirst({
      where: { id: actaId, project: { serviceOrder: { companyId } } },
      select: { id: true },
    });
    if (!acta) throw new NotFoundException('Acta no encontrada');

    let onlyEmails: string[] | undefined;
    if (firmanteId) {
      const f = await this.prisma.actaFirmante.findFirst({
        where: { id: firmanteId, actaId },
        select: { email: true, signedAt: true },
      });
      if (!f) throw new NotFoundException('Firmante no encontrado');
      if (f.signedAt) throw new BadRequestException('El firmante ya firmó el documento');
      if (!f.email)   throw new BadRequestException('El firmante no tiene correo registrado');
      onlyEmails = [f.email];
    }

    await this.sendFirmanteNotifications(actaId, companyId, onlyEmails);
    return { message: 'Correo enviado correctamente' };
  }

  private async sendFirmanteNotifications(actaId: string, companyId: string, onlyEmails?: string[]): Promise<void> {
    const TYPE_LABELS: Record<string, string> = {
      inicio:          'Acta de Inicio',
      visita:          'Acta de Visita',
      cierre:          'Acta de Cierre',
      capacitacion:    'Acta de Capacitación',
      entrega_soporte: 'Entrega a Soporte',
    };

    try {
      const [acta, company] = await Promise.all([
        this.prisma.acta.findUnique({
          where: { id: actaId },
          select: {
            type: true, numero: true,
            createdBy: {
              select: { firstName: true, lastName: true, jobTitle: true, email: true, phone: true },
            },
            firmantes: {
              where: {
                signedAt: null,
                ...(onlyEmails?.length ? { email: { in: onlyEmails } } : {}),
              },
              select: { id: true, nombre: true, email: true, telefono: true },
            },
          },
        }),
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { name: true },
        }),
      ]);

      if (!acta) return;

      const typeLabel   = TYPE_LABELS[acta.type] ?? 'Documento';
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      const companyName = company?.name ?? '';

      // Datos del implementador
      const impl = acta.createdBy;
      const implNombre = impl ? `${impl.firstName} ${impl.lastName}` : '';
      const implCargo  = impl?.jobTitle ?? '';
      const implEmail  = impl?.email    ?? '';
      const implPhone  = impl?.phone    ?? '';

      const implBlock = implNombre ? `
  <table style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;width:100%;font-size:13px;color:#64748b;" cellpadding="0" cellspacing="0">
    <tr><td colspan="2" style="padding-bottom:8px;font-weight:600;color:#334155;">Datos del implementador responsable:</td></tr>
    <tr><td style="padding:2px 0;width:90px;">Nombre</td><td style="padding:2px 0;color:#0f172a;">${implNombre}</td></tr>
    ${implCargo  ? `<tr><td style="padding:2px 0;">Cargo</td><td style="padding:2px 0;color:#0f172a;">${implCargo}</td></tr>` : ''}
    ${implEmail  ? `<tr><td style="padding:2px 0;">Correo</td><td style="padding:2px 0;color:#0f172a;">${implEmail}</td></tr>` : ''}
    ${implPhone  ? `<tr><td style="padding:2px 0;">Teléfono</td><td style="padding:2px 0;color:#0f172a;">${implPhone}</td></tr>` : ''}
  </table>` : '';

      for (const firmante of acta.firmantes) {
        if (!firmante.email) continue;

        const signingUrl = `${frontendUrl}/firmar/${firmante.id}`;
        const subject    = `Documento pendiente de firma — ${typeLabel}${acta.numero ? ` No. ${acta.numero}` : ''}`;

        const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#334155;line-height:1.7;font-size:14px;">
  <p>Estimado(a) <strong>${firmante.nombre}</strong>,</p>
  <p>Reciba un cordial saludo.</p>
  <p>Por medio de la presente, le informamos que tiene un documento/acta pendiente de revisión y firma dentro de la plataforma. Agradecemos realizar la gestión correspondiente a la mayor brevedad posible para dar continuidad al proceso y mantener la trazabilidad de la información.</p>
  <p>Le solicitamos ingresar al sistema y completar la firma del documento pendiente. En caso de haber realizado la firma recientemente, por favor omita este mensaje.</p>
  <p>Si presenta inconvenientes para acceder o firmar el documento, comuníquese con el área de soporte o con el responsable del proceso para recibir asistencia.</p>
  <p>Agradecemos su atención y pronta gestión.</p>
  <div style="margin:28px 0;">
    <a href="${signingUrl}"
       style="display:inline-block;padding:12px 28px;background:#1E3A5F;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
      Ir a firmar documento
    </a>
  </div>
  <p style="margin-bottom:4px;"><strong>Cordialmente,</strong></p>
  <p style="margin-top:0;">${companyName}</p>
  ${implBlock}
</div>`;

        await this.mail.sendFromCompany(companyId, [firmante.email], subject, html)
          .then(() => console.log(`[ACTAS] Correo enviado a ${firmante.email}`))
          .catch(err => console.error(`[ACTAS] Error enviando correo a ${firmante.email}:`, err?.message ?? err));

        if (firmante.telefono) {
          const waText =
            `📋 *${typeLabel}${acta.numero ? ` No. ${acta.numero}` : ''}*\n\n` +
            `Hola ${firmante.nombre}, tienes un documento pendiente de firma en *${companyName}*.\n\n` +
            `Ingresa al siguiente enlace para firmar:\n\n` +
            `${signingUrl}`;
          this.wa.sendMessage(firmante.telefono, waText)
            .then(sent => sent && console.log(`[ACTAS] WhatsApp enviado a ${firmante.telefono}`))
            .catch(() => {});
        }
      }
    } catch (err: any) { console.error('[ACTAS] sendFirmanteNotifications error:', err?.message ?? err); }
  }

  // ── IA: generar borrador ───────────────────────────────────────────────────

  async generateAiDraft(dto: { type: string; clientName?: string; modules?: string[] }) {
    const { type, clientName = 'el cliente', modules = [] } = dto;

    const moduleList = modules.length
      ? modules.map((m, i) => `${i + 1}. ${m}`).join('\n')
      : 'No se especificaron módulos.';

    let systemMsg = 'Eres un redactor experto en actas de implementación de software médico (IPS, clínicas, hospitales). Redactas en español formal, conciso y profesional.';

    let userMsg: string;

    if (type === 'inicio') {
      userMsg = `Genera el contenido para un Acta de Inicio de implementación de software para "${clientName}".\n\nMódulos a implementar:\n${moduleList}\n\nResponde SOLO con JSON válido con estas claves:\n{\n  "asunto": "una línea resumiendo el inicio del proyecto",\n  "objetivoGeneral": "2-3 oraciones con el objetivo general",\n  "alcance": "párrafo describiendo los módulos incluidos y su propósito"\n}`;
    } else {
      return { message: 'Tipo de acta no soportado para IA' };
    }

    const raw = await this.callGroq([
      { role: 'system', content: systemMsg },
      { role: 'user',   content: userMsg },
    ], 600);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { raw };
    }
  }

  private async callGroq(messages: { role: string; content: string }[], maxTokens = 500): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new BadRequestException('GROQ_API_KEY no configurado');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.5 }),
      });
      if (!res.ok) {
        const txt = await res.text();
        this.logger.error(`Groq error ${res.status}: ${txt}`);
        throw new BadRequestException('Error al consultar la IA');
      }
      const data: any = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
