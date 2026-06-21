import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import { GenerateProjectDto, LoadTemplateDto, AddModulesDto, ProjectFilterDto, UpdateProjectStatusDto, UpdatePhaseDto, UpdateActivityDto, CreateProjectActivityDto } from './dto/project.dto';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
    private notifications: NotificationsService,
  ) {}

  async findAll(companyId: string, dto: ProjectFilterDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { serviceOrder: { companyId } };
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search } },
        { serviceOrder: { osNumber: { contains: dto.search } } },
        { serviceOrder: { client: { businessName: { contains: dto.search } } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, status: true, progressPercent: true,
          startDate: true, endDate: true, createdAt: true,
          serviceOrder: {
            select: {
              id: true, osNumber: true, product: true,
              client: { select: { id: true, businessName: true } },
            },
          },
          _count: { select: { modules: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async modulesByServiceOrder(companyId: string, serviceOrderId: string) {
    const project = await this.prisma.project.findFirst({
      where: { serviceOrderId, serviceOrder: { companyId } },
      select: {
        id: true,
        name: true,
        modules: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            phases: {
              orderBy: { order: 'asc' },
              select: { id: true, name: true, color: true, slug: true },
            },
          },
        },
      },
    });
    return project ?? { id: null, name: null, modules: [] };
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, serviceOrder: { companyId } },
      include: {
        serviceOrder: {
          select: {
            id: true, osNumber: true, product: true,
            client: { select: { id: true, businessName: true, city: true, municipioId: true } },
          },
        },
        templateFlow: { select: { id: true, name: true } },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            phases: {
              orderBy: { order: 'asc' },
              include: {
                activities: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true, code: true, name: true, description: true,
                    status: true, priority: true, order: true,
                    plannedHours: true, actualHours: true, progressPercent: true,
                    observations: true, calculatedDays: true,
                    plannedStartDate: true, plannedEndDate: true,
                    actualStartDate: true, actualEndDate: true, executionDate: true,
                    assignedToId: true, clientStaffId: true,
                    assignedTo: { select: { id: true, firstName: true, lastName: true } },
                    clientStaff: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  // ── Status del proyecto ───────────────────────────────────────────────────

  async updateProjectStatus(companyId: string, projectId: string, dto: UpdateProjectStatusDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: dto.status },
    });

    const STATUS_LABEL: Record<string, string> = {
      activo: 'Activo', completado: 'Completado', pausado: 'Pausado',
      cancelado: 'Cancelado', pendiente: 'Pendiente',
    };
    this.notifications.broadcastToAgents(
      companyId,
      {
        type: 'proyecto',
        title: `Proyecto "${project.name}": estado → ${STATUS_LABEL[dto.status] ?? dto.status}`,
        entityType: 'project',
        entityId: projectId,
      },
      this.gateway,
    );
    this.gateway.dashboardUpdate(companyId, { type: 'project_status_changed', payload: { id: projectId } });

    return updated;
  }

  // ── Fases ─────────────────────────────────────────────────────────────────

  async updatePhase(companyId: string, phaseId: string, dto: UpdatePhaseDto) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectModule: { project: { serviceOrder: { companyId } } } },
    });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.executionDate) data.executionDate = new Date(dto.executionDate);
    const updated = await this.prisma.phase.update({ where: { id: phaseId }, data });
    await this.recalcModule(phase.projectModuleId);
    return updated;
  }

  // ── Actividades ───────────────────────────────────────────────────────────

  async updateActivity(companyId: string, activityId: string, dto: UpdateActivityDto) {
    // Single query: fetch everything needed for recalc (sibling activities, phases, modules)
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, phase: { projectModule: { project: { serviceOrder: { companyId } } } } },
      select: {
        phaseId: true, progressPercent: true, status: true, actualStartDate: true, actualEndDate: true,
        blockedBy: true, blockedNote: true, blockedSince: true, clientDelayDays: true,
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
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    const phaseId   = activity.phaseId;
    const moduleId  = activity.phase.projectModuleId;
    const projectId = activity.phase.projectModule.projectId;

    const data: any = {};
    let blockLogData: { activityId: string; blockedBy: string; blockedNote: string; blockedSince: Date; unlockedAt: Date; diasBloqueado: number; unlockNote: string | null } | null = null;

    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'completado' && dto.progressPercent === undefined) data.progressPercent = 100;
      if (dto.status === 'en_progreso' && Number(activity.progressPercent) === 0) data.progressPercent = 10;
      if (dto.status === 'pendiente') data.progressPercent = 0;

      if (dto.status === 'bloqueado') {
        if (!dto.blockedBy) throw new BadRequestException('Debe indicar quién bloquea la actividad (blockedBy)');
        if (!dto.blockedNote?.trim()) throw new BadRequestException('La nota de bloqueo es obligatoria');
        data.blockedBy = dto.blockedBy;
        data.blockedNote = dto.blockedNote;
        data.blockedSince = new Date();
      }

      if ((activity as any).status === 'bloqueado' && dto.status !== 'bloqueado') {
        const now = new Date();
        const since: Date = (activity as any).blockedSince ?? now;
        const dias = Math.max(0, Math.round((now.getTime() - since.getTime()) / 86400000));
        if ((activity as any).blockedBy === 'cliente') {
          data.clientDelayDays = ((activity as any).clientDelayDays ?? 0) + dias;
        }
        data.blockedBy = null;
        data.blockedNote = null;
        data.blockedSince = null;
        blockLogData = {
          activityId,
          blockedBy: (activity as any).blockedBy!,
          blockedNote: (activity as any).blockedNote!,
          blockedSince: since,
          unlockedAt: now,
          diasBloqueado: dias,
          unlockNote: dto.unlockNote ?? null,
        };
      }
    }
    if (dto.progressPercent !== undefined) data.progressPercent = dto.progressPercent;
    if (dto.actualHours !== undefined) data.actualHours = dto.actualHours;
    if (dto.observations !== undefined) data.observations = dto.observations;
    if (dto.plannedStartDate !== undefined) data.plannedStartDate = dto.plannedStartDate ? new Date(dto.plannedStartDate) : null;
    if (dto.plannedEndDate !== undefined) data.plannedEndDate = dto.plannedEndDate ? new Date(dto.plannedEndDate) : null;
    if (dto.actualStartDate !== undefined) data.actualStartDate = dto.actualStartDate ? new Date(dto.actualStartDate) : null;
    if (dto.actualEndDate !== undefined) data.actualEndDate = dto.actualEndDate ? new Date(dto.actualEndDate) : null;
    if (dto.executionDate !== undefined) data.executionDate = dto.executionDate ? new Date(dto.executionDate) : null;

    const start = data.actualStartDate !== undefined ? data.actualStartDate : activity.actualStartDate;
    const end   = data.actualEndDate   !== undefined ? data.actualEndDate   : activity.actualEndDate;
    data.calculatedDays = (start && end)
      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
      : 0;
    if (dto.assignedToId !== undefined) data.assignedToId = dto.assignedToId || null;
    if (dto.clientStaffId !== undefined) data.clientStaffId = dto.clientStaffId || null;

    // Compute new values for this activity, then derive cascade averages in memory
    const newPct    = data.progressPercent !== undefined ? data.progressPercent : Number(activity.progressPercent);
    const newStatus = data.status ?? activity.status;

    const sibActs = activity.phase.activities.map(a =>
      a.id === activityId ? { progressPercent: newPct, status: newStatus } : { progressPercent: Number(a.progressPercent), status: a.status }
    );
    const phaseAvg = sibActs.length ? sibActs.reduce((s, a) => s + a.progressPercent, 0) / sibActs.length : 0;
    let phaseStatus = 'pendiente';
    if (sibActs.length && sibActs.every(a => a.status === 'completado')) phaseStatus = 'completado';
    else if (sibActs.some(a => a.status === 'en_progreso' || a.status === 'completado')) phaseStatus = 'en_progreso';

    const moduleAvg = activity.phase.projectModule.phases.length
      ? activity.phase.projectModule.phases.reduce((s, p) => s + (p.id === phaseId ? phaseAvg : Number(p.progressPercent)), 0) / activity.phase.projectModule.phases.length
      : 0;
    const projectAvg = activity.phase.projectModule.project.modules.length
      ? activity.phase.projectModule.project.modules.reduce((s, m) => s + (m.id === moduleId ? moduleAvg : Number(m.progressPercent)), 0) / activity.phase.projectModule.project.modules.length
      : 0;

    // Single transaction — all 4 writes + optional block log in one DB round trip
    const txOps: any[] = [
      this.prisma.activity.update({ where: { id: activityId }, data }),
      this.prisma.phase.update({ where: { id: phaseId }, data: { progressPercent: phaseAvg, status: phaseStatus } }),
      this.prisma.projectModule.update({ where: { id: moduleId }, data: { progressPercent: moduleAvg } }),
      this.prisma.project.update({ where: { id: projectId }, data: { progressPercent: projectAvg } }),
    ];
    if (blockLogData) txOps.push(this.prisma.activityBlockLog.create({ data: blockLogData }));
    const [updated] = await this.prisma.$transaction(txOps);

    return updated;
  }

  async deleteActivity(companyId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, phase: { projectModule: { project: { serviceOrder: { companyId } } } } },
      select: { id: true, phaseId: true },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    await Promise.all([
      this.prisma.visitActivity.deleteMany({ where: { activityId } }),
      this.prisma.actaActividad.deleteMany({ where: { activityId } }),
      this.prisma.activityDependency.deleteMany({
        where: { OR: [{ activityId }, { dependsOnActivityId: activityId }] },
      }),
    ]);
    await this.prisma.activity.delete({ where: { id: activityId } });
    await this.recalcPhase(activity.phaseId);
    return { message: 'Actividad eliminada' };
  }

  async bulkUpdateStatus(companyId: string, userId: string, activityIds: string[], status: string, nota?: string) {
    if (status === 'bloqueado') throw new BadRequestException('El bloqueo requiere atribución individual');
    for (const activityId of activityIds) {
      await this.updateActivity(companyId, activityId, { status });
    }
    const threadContent = nota?.trim() || `Estado cambiado a "${status}" (actualización masiva)`;
    await this.prisma.activityThread.createMany({
      data: activityIds.map(activityId => ({
        activityId,
        authorId:   userId,
        authorType: 'agent',
        content:    threadContent,
        newStatus:  status,
      })),
    });
    return { updated: activityIds.length };
  }

  async addPhaseActivity(companyId: string, phaseId: string, dto: CreateProjectActivityDto) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectModule: { project: { serviceOrder: { companyId } } } },
      include: { activities: { orderBy: { order: 'asc' }, select: { id: true, order: true, code: true } } },
    });
    if (!phase) throw new NotFoundException('Fase no encontrada');

    const nextOrder = (phase.activities.at(-1)?.order ?? 0) + 1;
    const nextNum = String(nextOrder).padStart(2, '0');
    const phaseCode = (phase as any).slug?.toUpperCase() ?? 'ACT';
    const code = `${phaseCode}-${nextNum}`;

    const actStart = dto.actualStartDate ? new Date(dto.actualStartDate) : null;
    const actEnd   = dto.actualEndDate   ? new Date(dto.actualEndDate)   : null;
    const calcDays = actStart && actEnd
      ? Math.max(0, Math.round((actEnd.getTime() - actStart.getTime()) / 86400000))
      : 0;

    const activity = await this.prisma.activity.create({
      data: {
        phaseId,
        code,
        name: dto.name,
        description: dto.description,
        priority: dto.priority ?? 'media',
        status: 'pendiente',
        order: nextOrder,
        plannedHours: dto.plannedHours ?? 0,
        plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : null,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
        actualStartDate: actStart,
        actualEndDate: actEnd,
        calculatedDays: calcDays,
        assignedToId: dto.assignedToId || null,
        clientStaffId: dto.clientStaffId || null,
      },
      select: {
        id: true, code: true, name: true, description: true,
        status: true, priority: true, order: true,
        plannedHours: true, actualHours: true, progressPercent: true,
        observations: true, calculatedDays: true,
        plannedStartDate: true, plannedEndDate: true,
        actualStartDate: true, actualEndDate: true, executionDate: true,
        assignedToId: true, clientStaffId: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        clientStaff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return activity;
  }

  // ── Cargar plantilla en proyecto existente ────────────────────────────────

  async loadTemplate(companyId: string, projectId: string, dto: LoadTemplateDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const template = await this.prisma.templateFlow.findFirst({
      where: { id: dto.templateFlowId, companyId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { phases: { orderBy: { order: 'asc' }, include: { activities: { orderBy: { order: 'asc' } } } } },
        },
      },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');

    // Tx 1: limpiar datos existentes (FK multi-nivel en SQL Server)
    await this.wipeProjectData(this.prisma, projectId);

    // Tx 2: crear nueva estructura desde la plantilla
    const phaseDateMap  = new Map((dto.phaseDates ?? []).map((d) => [d.templatePhaseId, d]));
    const excludedSet   = new Set(dto.excludedModuleIds ?? []);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { templateFlowId: dto.templateFlowId, progressPercent: 0 },
    });

    const moduleRows:   any[] = [];
    const phaseRows:    any[] = [];
    const activityRows: any[] = [];

    for (const tMod of template.modules.filter(m => !excludedSet.has(m.id))) {
      const modId = randomUUID();
      const modPhaseDates = tMod.phases.map(p => phaseDateMap.get(p.id)).filter(Boolean);
      const modStart = modPhaseDates.find(d => d?.startDate)
        ? new Date(modPhaseDates.filter(d => d?.startDate).map(d => d!.startDate!).sort()[0])
        : null;
      const modEnd = modPhaseDates.find(d => d?.endDate)
        ? new Date(modPhaseDates.filter(d => d?.endDate).map(d => d!.endDate!).sort().reverse()[0])
        : null;

      moduleRows.push({ id: modId, projectId, name: tMod.name, order: tMod.order, startDate: modStart, endDate: modEnd });

      for (const tPhase of tMod.phases) {
        const phaseId = randomUUID();
        const phDates = phaseDateMap.get(tPhase.id);
        const phStart = phDates?.startDate ? new Date(phDates.startDate) : null;
        const phEnd   = phDates?.endDate   ? new Date(phDates.endDate)   : null;

        phaseRows.push({
          id: phaseId, projectModuleId: modId,
          name: tPhase.name, slug: tPhase.slug, order: tPhase.order,
          color: tPhase.color, icon: tPhase.icon, status: 'pendiente',
          startDate: phStart, endDate: phEnd,
        });

        for (const tAct of tPhase.activities) {
          activityRows.push({
            id: randomUUID(), phaseId,
            code: tAct.code, name: tAct.name, description: tAct.description,
            order: tAct.order, plannedHours: tAct.estimatedHours,
            priority: tAct.priority, status: 'pendiente',
            actualStartDate: phStart, actualEndDate: phEnd,
            assignedToId:  phDates?.agentLeaderId  || null,
            clientStaffId: phDates?.clientLeaderId || null,
          });
        }
      }
    }

    if (moduleRows.length) {
      await this.prisma.projectModule.createMany({ data: moduleRows });
      if (phaseRows.length)    await this.prisma.phase.createMany({ data: phaseRows });
      if (activityRows.length) await this.prisma.activity.createMany({ data: activityRows });
    }

    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: { serviceOrder: { select: { osNumber: true, product: true } }, _count: { select: { modules: true } } },
    });
  }

  // ── Agregar módulos desde plantilla (sin borrar los existentes) ──────────

  async addModules(companyId: string, projectId: string, dto: AddModulesDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const template = await this.prisma.templateFlow.findFirst({
      where: { id: dto.templateFlowId, companyId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { phases: { orderBy: { order: 'asc' }, include: { activities: { orderBy: { order: 'asc' } } } } },
        },
      },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');

    const selectedSet  = new Set(dto.selectedModuleIds);
    const phaseDateMap = new Map((dto.phaseDates ?? []).map((d) => [d.templatePhaseId, d]));

    const selectedModules = template.modules.filter(m => selectedSet.has(m.id));

    const lastMod = await this.prisma.projectModule.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    let nextOrder = (lastMod?.order ?? 0) + 1;

    const moduleRows:   any[] = [];
    const phaseRows:    any[] = [];
    const activityRows: any[] = [];

    for (const tMod of selectedModules) {
      const modId = randomUUID();
      const modPhaseDates = tMod.phases.map(p => phaseDateMap.get(p.id)).filter(Boolean);
      const modStart = modPhaseDates.find(d => d?.startDate)
        ? new Date(modPhaseDates.filter(d => d?.startDate).map(d => d!.startDate!).sort()[0])
        : null;
      const modEnd = modPhaseDates.find(d => d?.endDate)
        ? new Date(modPhaseDates.filter(d => d?.endDate).map(d => d!.endDate!).sort().reverse()[0])
        : null;

      moduleRows.push({ id: modId, projectId, name: tMod.name, order: nextOrder++, startDate: modStart, endDate: modEnd });

      for (const tPhase of tMod.phases) {
        const phaseId = randomUUID();
        const phDates = phaseDateMap.get(tPhase.id);
        const phStart = phDates?.startDate ? new Date(phDates.startDate) : null;
        const phEnd   = phDates?.endDate   ? new Date(phDates.endDate)   : null;

        phaseRows.push({
          id: phaseId, projectModuleId: modId,
          name: tPhase.name, slug: tPhase.slug, order: tPhase.order,
          color: tPhase.color, icon: tPhase.icon, status: 'pendiente',
          startDate: phStart, endDate: phEnd,
          responsibleId: phDates?.agentLeaderId  || null,
          clientStaffId: phDates?.clientLeaderId || null,
        });

        for (const tAct of tPhase.activities) {
          activityRows.push({
            id: randomUUID(), phaseId,
            code: tAct.code, name: tAct.name, description: tAct.description,
            order: tAct.order, plannedHours: tAct.estimatedHours,
            priority: tAct.priority, status: 'pendiente',
            actualStartDate: phStart, actualEndDate: phEnd,
            assignedToId:    phDates?.agentLeaderId  || null,
            clientStaffId:   phDates?.clientLeaderId || null,
          });
        }
      }
    }

    if (moduleRows.length) {
      await this.prisma.projectModule.createMany({ data: moduleRows });
      if (phaseRows.length)    await this.prisma.phase.createMany({ data: phaseRows });
      if (activityRows.length) await this.prisma.activity.createMany({ data: activityRows });
    }

    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: { serviceOrder: { select: { osNumber: true, product: true } }, _count: { select: { modules: true } } },
    });
  }

  // ── Eliminar módulo ──────────────────────────────────────────────────────

  async deleteModule(companyId: string, moduleId: string) {
    const mod = await this.prisma.projectModule.findFirst({
      where: { id: moduleId, project: { serviceOrder: { companyId } } },
      select: { id: true, projectId: true },
    });
    if (!mod) throw new NotFoundException('Módulo no encontrado');

    const activities = await this.prisma.activity.findMany({
      where: { phase: { projectModuleId: moduleId } },
      select: { id: true },
    });
    const activityIds = activities.map(a => a.id);

    if (activityIds.length) {
      await Promise.all([
        this.prisma.visitActivity.deleteMany({ where: { activityId: { in: activityIds } } }),
        this.prisma.activityDependency.deleteMany({
          where: { OR: [{ activityId: { in: activityIds } }, { dependsOnActivityId: { in: activityIds } }] },
        }),
      ]);
      await this.prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
    }

    await this.prisma.phase.deleteMany({ where: { projectModuleId: moduleId } });
    await this.prisma.projectModule.delete({ where: { id: moduleId } });
    await this.recalcProject(mod.projectId);
    return { message: 'Módulo eliminado' };
  }

  // ── Eliminar proyecto ──────────────────────────────────────────────────────

  async deleteProject(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const actaCount = await this.prisma.acta.count({ where: { projectId } });
    if (actaCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el proyecto porque tiene ${actaCount} acta${actaCount !== 1 ? 's' : ''} asociada${actaCount !== 1 ? 's' : ''}. Elimina las actas primero desde la sección de actas del proyecto.`,
      );
    }

    await this.wipeProjectData(this.prisma, projectId);
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  // ── Helper: eliminar toda la jerarquía de un proyecto ─────────────────────
  // SQL Server bloquea DELETE en cascada multi-nivel con onDelete: NoAction.
  // Hay que borrar en orden inverso de dependencias:
  //   VisitActivity / ActivityDependency → Activity → Phase → ProjectModule

  private async wipeProjectData(tx: any, projectId: string) {
    const activities = await tx.activity.findMany({
      where: { phase: { projectModule: { projectId } } },
      select: { id: true },
    });
    const activityIds = activities.map((a: any) => a.id);

    if (activityIds.length) {
      await Promise.all([
        tx.visitActivity.deleteMany({ where: { activityId: { in: activityIds } } }),
        tx.activityDependency.deleteMany({
          where: { OR: [{ activityId: { in: activityIds } }, { dependsOnActivityId: { in: activityIds } }] },
        }),
      ]);
      await tx.activity.deleteMany({ where: { id: { in: activityIds } } });
    }

    await tx.phase.deleteMany({ where: { projectModule: { projectId } } });
    await tx.projectModule.deleteMany({ where: { projectId } });
  }

  // ── Recálculo de progreso ─────────────────────────────────────────────────

  private async recalcPhase(phaseId: string) {
    const acts = await this.prisma.activity.findMany({ where: { phaseId } });
    const avg = acts.length
      ? acts.reduce((s, a) => s + Number(a.progressPercent), 0) / acts.length
      : 0;
    let status = 'pendiente';
    if (acts.length && acts.every(a => a.status === 'completado')) status = 'completado';
    else if (acts.some(a => a.status === 'en_progreso' || a.status === 'completado')) status = 'en_progreso';
    const phase = await this.prisma.phase.update({
      where: { id: phaseId },
      data: { progressPercent: avg, status },
    });
    await this.recalcModule(phase.projectModuleId);
  }

  private async recalcModule(moduleId: string) {
    const phases = await this.prisma.phase.findMany({ where: { projectModuleId: moduleId } });
    const avg = phases.length
      ? phases.reduce((s, p) => s + Number(p.progressPercent), 0) / phases.length
      : 0;
    const mod = await this.prisma.projectModule.update({
      where: { id: moduleId },
      data: { progressPercent: avg },
    });
    await this.recalcProject(mod.projectId);
  }

  private async recalcProject(projectId: string) {
    const mods = await this.prisma.projectModule.findMany({ where: { projectId } });
    const avg = mods.length
      ? mods.reduce((s, m) => s + Number(m.progressPercent), 0) / mods.length
      : 0;
    await this.prisma.project.update({ where: { id: projectId }, data: { progressPercent: avg } });
  }

  // ── Generar proyecto ──────────────────────────────────────────────────────

  async generateFromServiceOrder(companyId: string, serviceOrderId: string, dto: GenerateProjectDto) {
    // Validate in parallel to avoid sequential round trips
    const [os, existing, template] = await Promise.all([
      this.prisma.serviceOrder.findFirst({ where: { id: serviceOrderId, companyId } }),
      this.prisma.project.findUnique({ where: { serviceOrderId } }),
      this.prisma.templateFlow.findFirst({
        where: { id: dto.templateFlowId, companyId },
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: { phases: { orderBy: { order: 'asc' }, include: { activities: { orderBy: { order: 'asc' } } } } },
          },
        },
      }),
    ]);

    if (!os) throw new NotFoundException('Orden de servicio no encontrada');
    if (existing) throw new ConflictException('Esta OS ya tiene un proyecto generado');
    if (!template) throw new NotFoundException('Plantilla no encontrada');

    const phaseDateMap = new Map((dto.phaseDates ?? []).map((d) => [d.templatePhaseId, d]));
    const excludedSet  = new Set(dto.excludedModuleIds ?? []);
    const filteredModules = template.modules.filter(m => !excludedSet.has(m.id));

    // Pre-generate all IDs so we can build bulk-insert payloads without chained awaits
    const projectId = randomUUID();
    const modulesData: any[] = [];
    const phasesData:  any[] = [];
    const activitiesData: any[] = [];

    for (const tMod of filteredModules) {
      const modId = randomUUID();
      const modPhaseDates = tMod.phases.map(p => phaseDateMap.get(p.id)).filter(Boolean);
      const modStart = modPhaseDates.find(d => d?.startDate)
        ? new Date(modPhaseDates.filter(d => d?.startDate).map(d => d!.startDate!).sort()[0])
        : undefined;
      const modEnd = modPhaseDates.find(d => d?.endDate)
        ? new Date(modPhaseDates.filter(d => d?.endDate).map(d => d!.endDate!).sort().reverse()[0])
        : undefined;

      modulesData.push({ id: modId, projectId, name: tMod.name, order: tMod.order, startDate: modStart, endDate: modEnd });

      for (const tPhase of tMod.phases) {
        const phaseId = randomUUID();
        const phDates = phaseDateMap.get(tPhase.id);
        const phStart = phDates?.startDate ? new Date(phDates.startDate) : undefined;
        const phEnd   = phDates?.endDate   ? new Date(phDates.endDate)   : undefined;

        phasesData.push({
          id: phaseId,
          projectModuleId: modId,
          name: tPhase.name, slug: tPhase.slug, order: tPhase.order,
          color: tPhase.color, icon: tPhase.icon, status: 'pendiente',
          startDate: phStart, endDate: phEnd,
          responsibleId:  phDates?.agentLeaderId  || null,
          clientStaffId:  phDates?.clientLeaderId || null,
        });

        for (const tAct of tPhase.activities) {
          activitiesData.push({
            phaseId,
            code: tAct.code, name: tAct.name, description: tAct.description,
            order: tAct.order, plannedHours: tAct.estimatedHours,
            priority: tAct.priority, status: 'pendiente',
            actualStartDate: phStart,
            actualEndDate: phEnd,
            assignedToId:  phDates?.agentLeaderId  || null,
            clientStaffId: phDates?.clientLeaderId || null,
          });
        }
      }
    }

    // 4 bulk operations in one transaction instead of N×M×K sequential round trips
    await this.prisma.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: projectId,
          serviceOrderId,
          templateFlowId: dto.templateFlowId,
          name: dto.name ?? `${os.product} — ${new Date().getFullYear()}`,
          description: dto.description,
          startDate: os.startDate,
          endDate: os.endDate,
          status: 'activo',
        },
      });
      if (modulesData.length)    await tx.projectModule.createMany({ data: modulesData });
      if (phasesData.length)     await tx.phase.createMany({ data: phasesData });
      if (activitiesData.length) await tx.activity.createMany({ data: activitiesData });
    });

    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: { serviceOrder: { select: { osNumber: true, product: true } }, _count: { select: { modules: true } } },
    });
  }
}
