import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import { GenerateProjectDto, LoadTemplateDto, AddModulesDto, ProjectFilterDto, UpdateProjectStatusDto, UpdatePhaseDto, UpdateActivityDto, CreateProjectActivityDto, GlobalActivitiesFilterDto, SendActivityReportDto } from './dto/project.dto';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
    private notifications: NotificationsService,
    private mailService: MailService,
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

    // Skip tables/columns that may not exist in this environment (pending db push)
    const safeDelete = async (fn: () => Promise<unknown>) => {
      try { await fn(); } catch (e: any) {
        const msg: string = e?.message ?? '';
        const isSchemaError = msg.includes('does not exist') || msg.includes('not available') || msg.includes('Invalid column name') || msg.includes('Invalid object name');
        if (isSchemaError) { this.logger.warn(`safeDelete skipped: ${msg.slice(0, 120)}`); return; }
        throw e;
      }
    };

    try {
      await Promise.all([
        safeDelete(() => this.prisma.subActivity.deleteMany({ where: { activityId } })),
        safeDelete(() => this.prisma.activityThread.deleteMany({ where: { activityId } })),
        safeDelete(() => this.prisma.activityBlockLog.deleteMany({ where: { activityId } })),
        this.prisma.visitActivity.deleteMany({ where: { activityId } }),
        this.prisma.actaActividad.deleteMany({ where: { activityId } }),
        this.prisma.activityDependency.deleteMany({
          where: { OR: [{ activityId }, { dependsOnActivityId: activityId }] },
        }),
      ]);
      await this.prisma.activity.delete({ where: { id: activityId } });
    } catch (e: any) {
      this.logger.error(`deleteActivity(${activityId}) failed: ${e?.message}`, e?.stack);
      throw new InternalServerErrorException(e?.message ?? 'Error al eliminar la actividad');
    }
    await this.recalcPhase(activity.phaseId);
    return { message: 'Actividad eliminada' };
  }

  async bulkUpdateActivities(
    companyId: string,
    userId: string,
    items: Array<{ activityId: string; status: string; nota?: string; blockedBy?: string }>,
  ) {
    for (const item of items) {
      if (item.status === 'bloqueado') {
        if (!item.blockedBy) throw new BadRequestException(`Actividad ${item.activityId}: debe indicar quién bloquea`);
        if (!item.nota?.trim()) throw new BadRequestException(`Actividad ${item.activityId}: la nota de bloqueo es obligatoria`);
      }
    }
    for (const { activityId, status, nota, blockedBy } of items) {
      await this.updateActivity(companyId, activityId, {
        status,
        ...(status === 'bloqueado' ? { blockedBy, blockedNote: nota } : {}),
      });
      await this.prisma.activityThread.create({
        data: {
          activityId,
          authorId:   userId,
          authorType: 'agent',
          content:    nota?.trim() || `Estado cambiado a "${status}"`,
          newStatus:  status,
        },
      });
    }
    return { updated: items.length };
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

  async getActivityClients(companyId: string, dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? (() => { const d = new Date(dateTo); d.setUTCHours(23, 59, 59, 999); return d; })() : null;

    /*
      SELECT DISTINCT c.id, c.businessName
      FROM Clientes c
      INNER JOIN OrdenesServicio os ON os.clientId   = c.id
      INNER JOIN Proyectos       p  ON p.serviceOrderId = os.id
      INNER JOIN ModulosProyecto m  ON m.projectId   = p.id
      INNER JOIN Fases           f  ON f.projectModuleId = m.id
      INNER JOIN Actividades     a  ON a.phaseId     = f.id
      WHERE os.companyId = @companyId
        AND a.status    != 'pendiente'
        [AND (
          (a.executionDate >= @from AND a.executionDate <= @to)
          OR EXISTS (
            SELECT 1 FROM HilosActividad h
            WHERE h.activityId = a.id
              AND h.createdAt >= @from AND h.createdAt <= @to
          )
        )]
      ORDER BY c.businessName
    */
    const dateFilter = (from && to)
      ? Prisma.sql`AND (
          (a.executionDate >= ${from} AND a.executionDate <= ${to})
          OR EXISTS (
            SELECT 1 FROM HilosActividad h
            WHERE h.activityId = a.id
              AND h.createdAt >= ${from} AND h.createdAt <= ${to}
          )
        )`
      : Prisma.empty;

    return this.prisma.$queryRaw<{ id: string; businessName: string }[]>`
      SELECT DISTINCT c.id, c.businessName
      FROM           Clientes        c
      INNER JOIN     OrdenesServicio os ON os.clientId      = c.id
      INNER JOIN     Proyectos       p  ON p.serviceOrderId = os.id
      INNER JOIN     ModulosProyecto m  ON m.projectId      = p.id
      INNER JOIN     Fases           f  ON f.projectModuleId = m.id
      INNER JOIN     Actividades     a  ON a.phaseId        = f.id
      WHERE  os.companyId = ${companyId}
        AND  a.status    != 'pendiente'
        ${dateFilter}
      ORDER BY c.businessName
    `;
  }

  async getGlobalActivities(companyId: string, dto: GlobalActivitiesFilterDto) {
    const { take, skip } = paginate(dto.page, dto.limit ?? 100);

    const dateWhere: any = {};
    if (dto.dateFrom) dateWhere.gte = new Date(dto.dateFrom);
    if (dto.dateTo) {
      const to = new Date(dto.dateTo);
      to.setUTCHours(23, 59, 59, 999);
      dateWhere.lte = to;
    }

    const where: any = {
      NOT: { status: 'pendiente' },
      phase: {
        projectModule: {
          project: {
            serviceOrder: {
              companyId,
              ...(dto.clientId ? { clientId: dto.clientId } : {}),
            },
          },
        },
      },
    };

    if (dto.status?.length) where.status = { in: dto.status };
    if (Object.keys(dateWhere).length) {
      where.OR = [
        { threads: { some: { createdAt: dateWhere } } },
        { executionDate: dateWhere },
      ];
    }

    const SELECT = {
      id: true, code: true, name: true, status: true, priority: true,
      progressPercent: true, actualHours: true, updatedAt: true, executionDate: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      clientStaff: { select: { id: true, firstName: true, lastName: true } },
      threads: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: { createdAt: true, author: { select: { id: true, firstName: true, lastName: true } } },
      },
      phase: {
        select: {
          id: true, name: true,
          projectModule: {
            select: {
              id: true, name: true,
              project: {
                select: {
                  id: true,
                  serviceOrder: {
                    select: {
                      id: true, osNumber: true, product: true,
                      client: { select: { id: true, businessName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({ where, take, skip, orderBy: { updatedAt: 'desc' }, select: SELECT }),
      this.prisma.activity.count({ where }),
    ]);

    return { data, total, page: dto.page ?? 1, limit: take };
  }

  async sendActivitiesReport(
    companyId: string,
    dto: Pick<SendActivityReportDto, 'emails' | 'subject' | 'message' | 'status' | 'clientId' | 'dateFrom' | 'dateTo'>,
  ): Promise<{ enviados: number; destinatarios: number }> {
    const dateWhere: any = {};
    if (dto.dateFrom) dateWhere.gte = new Date(dto.dateFrom);
    if (dto.dateTo) { const to = new Date(dto.dateTo); to.setUTCHours(23, 59, 59, 999); dateWhere.lte = to; }

    const where: any = {
      NOT: { status: 'pendiente' },
      phase: { projectModule: { project: { serviceOrder: { companyId, ...(dto.clientId ? { clientId: dto.clientId } : {}) } } } },
    };
    if (dto.status?.length) where.status = { in: dto.status };
    if (Object.keys(dateWhere).length) {
      where.OR = [
        { threads: { some: { createdAt: dateWhere } } },
        { executionDate: dateWhere },
      ];
    }

    const activities = await this.prisma.activity.findMany({
      where, orderBy: { updatedAt: 'desc' }, take: 1000,
      select: {
        name: true, status: true, progressPercent: true, updatedAt: true,
        assignedTo: { select: { firstName: true, lastName: true } },
        threads: { take: 1, orderBy: { createdAt: 'desc' as const }, select: { createdAt: true, author: { select: { firstName: true, lastName: true } } } },
        phase: { select: { name: true, projectModule: { select: { name: true, project: { select: { serviceOrder: { select: { osNumber: true, client: { select: { businessName: true } } } } } } } } } },
      },
    });

    const STATUS_LABELS: Record<string, string> = { completado: 'Completado', en_progreso: 'En progreso', bloqueado: 'Bloqueado', pendiente: 'Pendiente' };
    const STATUS_COLORS: Record<string, string> = { completado: '#34d399', en_progreso: '#60a5fa', bloqueado: '#f87171', pendiente: '#94a3b8' };

    const rows = activities.map(a => {
      const impl = a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
        : a.threads[0]?.author ? `${a.threads[0].author.firstName} ${a.threads[0].author.lastName}` : 'Sin asignar';
      const so = a.phase.projectModule.project.serviceOrder;
      const color = STATUS_COLORS[a.status] ?? '#94a3b8';
      const label = STATUS_LABELS[a.status] ?? a.status;
      const pct = Math.round(Number(a.progressPercent));
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;max-width:220px">${a.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${so.client.businessName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px">${so.osNumber}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${a.phase.projectModule.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${a.phase.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${impl}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
          <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600">${label}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${pct}%</td>
      </tr>`;
    }).join('');

    const period = dto.dateFrom === dto.dateTo
      ? (dto.dateFrom ?? 'Sin filtro')
      : `${dto.dateFrom ?? ''} — ${dto.dateTo ?? ''}`;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#1e293b">
  <div style="background:#0f1629;padding:24px 32px;border-radius:12px 12px 0 0">
    <h2 style="color:#fff;margin:0 0 4px">Reporte de Actividades Realizadas</h2>
    <p style="color:#94a3b8;margin:0;font-size:14px">Período: ${period} · Total: ${activities.length} actividades</p>
  </div>
  ${dto.message ? `<div style="background:#f8fafc;padding:16px 32px;border-left:4px solid #818cf8;font-size:14px">${dto.message}</div>` : ''}
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600;white-space:nowrap">Actividad</th>
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">Empresa</th>
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">OS</th>
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">Módulo</th>
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">Fase</th>
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">Implementador</th>
        <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">Estado</th>
        <th style="padding:10px 12px;text-align:right;color:#475569;font-weight:600">%</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#94a3b8;font-size:12px;padding:16px 32px">Generado automáticamente por AURA ERP</p>
</div>`;

    const subject = dto.subject || `Reporte Actividades – ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    await this.mailService.sendFromCompany(companyId, dto.emails, subject, html);
    return { enviados: activities.length, destinatarios: dto.emails.length };
  }
}
