import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import { GenerateProjectDto, LoadTemplateDto, ProjectFilterDto, UpdateProjectStatusDto, UpdatePhaseDto, UpdateActivityDto, CreateProjectActivityDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, dto: ProjectFilterDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { serviceOrder: { companyId } };
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search } },
        { serviceOrder: { osNumber: { contains: dto.search } } },
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

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, serviceOrder: { companyId } },
      include: {
        serviceOrder: {
          select: {
            id: true, osNumber: true, product: true,
            client: { select: { id: true, businessName: true } },
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
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: dto.status },
    });
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
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, phase: { projectModule: { project: { serviceOrder: { companyId } } } } },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    const data: any = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'completado' && dto.progressPercent === undefined) data.progressPercent = 100;
      if (dto.status === 'en_progreso' && Number(activity.progressPercent) === 0) data.progressPercent = 10;
      if (dto.status === 'pendiente') data.progressPercent = 0;
    }
    if (dto.progressPercent !== undefined) data.progressPercent = dto.progressPercent;
    if (dto.actualHours !== undefined) data.actualHours = dto.actualHours;
    if (dto.observations !== undefined) data.observations = dto.observations;
    if (dto.plannedStartDate !== undefined) data.plannedStartDate = dto.plannedStartDate ? new Date(dto.plannedStartDate) : null;
    if (dto.plannedEndDate !== undefined) data.plannedEndDate = dto.plannedEndDate ? new Date(dto.plannedEndDate) : null;
    if (dto.actualStartDate !== undefined) data.actualStartDate = dto.actualStartDate ? new Date(dto.actualStartDate) : null;
    if (dto.actualEndDate !== undefined) data.actualEndDate = dto.actualEndDate ? new Date(dto.actualEndDate) : null;
    if (dto.executionDate !== undefined) data.executionDate = dto.executionDate ? new Date(dto.executionDate) : null;
    if (dto.assignedToId !== undefined) data.assignedToId = dto.assignedToId || null;
    if (dto.clientStaffId !== undefined) data.clientStaffId = dto.clientStaffId || null;

    const updated = await this.prisma.activity.update({
      where: { id: activityId },
      data,
    });
    await this.recalcPhase(activity.phaseId);
    return updated;
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
        actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : null,
        actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : null,
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
    const phaseDateMap = new Map((dto.phaseDates ?? []).map((d) => [d.templatePhaseId, d]));

    await this.prisma.project.update({
      where: { id: projectId },
      data: { templateFlowId: dto.templateFlowId, progressPercent: 0 },
    });

    for (const tMod of template.modules) {
      const modPhaseDates = tMod.phases.map(p => phaseDateMap.get(p.id)).filter(Boolean);
      const modStart = modPhaseDates.find(d => d?.startDate)
        ? new Date(modPhaseDates.filter(d => d?.startDate).map(d => d!.startDate!).sort()[0])
        : undefined;
      const modEnd = modPhaseDates.find(d => d?.endDate)
        ? new Date(modPhaseDates.filter(d => d?.endDate).map(d => d!.endDate!).sort().reverse()[0])
        : undefined;

      const pMod = await this.prisma.projectModule.create({
        data: { projectId, name: tMod.name, order: tMod.order, startDate: modStart, endDate: modEnd },
      });

      for (const tPhase of tMod.phases) {
        const phDates = phaseDateMap.get(tPhase.id);
        const phStart = phDates?.startDate ? new Date(phDates.startDate) : undefined;
        const phEnd   = phDates?.endDate   ? new Date(phDates.endDate)   : undefined;

        const phase = await this.prisma.phase.create({
          data: {
            projectModuleId: pMod.id,
            name: tPhase.name, slug: tPhase.slug, order: tPhase.order,
            color: tPhase.color, icon: tPhase.icon, status: 'pendiente',
            startDate: phStart, endDate: phEnd,
          },
        });

        for (const tAct of tPhase.activities) {
          await this.prisma.activity.create({
            data: {
              phaseId: phase.id,
              code: tAct.code, name: tAct.name, description: tAct.description,
              order: tAct.order, plannedHours: tAct.estimatedHours,
              priority: tAct.priority, status: 'pendiente',
              actualStartDate: phStart,
              actualEndDate: phEnd,
            },
          });
        }
      }
    }

    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: { serviceOrder: { select: { osNumber: true, product: true } }, _count: { select: { modules: true } } },
    });
  }

  // ── Eliminar proyecto ──────────────────────────────────────────────────────

  async deleteProject(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    await this.wipeProjectData(this.prisma, projectId);
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  // ── Helper: eliminar toda la jerarquía de un proyecto ─────────────────────
  // SQL Server bloquea DELETE en cascada multi-nivel con onDelete: NoAction.
  // Hay que borrar en orden inverso de dependencias:
  //   VisitActivity / ActivityDependency → Activity → Phase → ProjectModule

  private async wipeProjectData(tx: any, projectId: string) {
    const phases = await tx.phase.findMany({
      where: { projectModule: { projectId } },
      select: { id: true },
    });
    const phaseIds = phases.map((p: any) => p.id);

    if (phaseIds.length) {
      const activities = await tx.activity.findMany({
        where: { phaseId: { in: phaseIds } },
        select: { id: true },
      });
      const activityIds = activities.map((a: any) => a.id);

      if (activityIds.length) {
        // Tablas que referencian Activity con onDelete: NoAction
        await tx.visitActivity.deleteMany({ where: { activityId: { in: activityIds } } });
        await tx.activityDependency.deleteMany({
          where: {
            OR: [
              { activityId: { in: activityIds } },
              { dependsOnActivityId: { in: activityIds } },
            ],
          },
        });
        // Activity (ActivityThread y SubActivity tienen onDelete: Cascade en DB)
        await tx.activity.deleteMany({ where: { id: { in: activityIds } } });
      }

      // Phase (ahora sin actividades que la bloqueen)
      await tx.phase.deleteMany({ where: { id: { in: phaseIds } } });
    }

    // ProjectModule (ahora sin fases)
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
    const os = await this.prisma.serviceOrder.findFirst({ where: { id: serviceOrderId, companyId } });
    if (!os) throw new NotFoundException('Orden de servicio no encontrada');

    const existing = await this.prisma.project.findUnique({ where: { serviceOrderId } });
    if (existing) throw new ConflictException('Esta OS ya tiene un proyecto generado');

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

    const project = await this.prisma.project.create({
      data: {
        serviceOrderId,
        templateFlowId: dto.templateFlowId,
        name: dto.name ?? `${os.product} — ${new Date().getFullYear()}`,
        description: dto.description,
        startDate: os.startDate,
        endDate: os.endDate,
        status: 'activo',
      },
    });

    const phaseDateMap = new Map((dto.phaseDates ?? []).map((d) => [d.templatePhaseId, d]));
    const excludedSet  = new Set(dto.excludedModuleIds ?? []);

    const filteredModules = template.modules.filter(m => !excludedSet.has(m.id));

    for (const tMod of filteredModules) {
      const modPhaseDates = tMod.phases.map(p => phaseDateMap.get(p.id)).filter(Boolean);
      const modStart = modPhaseDates.find(d => d?.startDate)
        ? new Date(modPhaseDates.filter(d => d?.startDate).map(d => d!.startDate!).sort()[0])
        : undefined;
      const modEnd = modPhaseDates.find(d => d?.endDate)
        ? new Date(modPhaseDates.filter(d => d?.endDate).map(d => d!.endDate!).sort().reverse()[0])
        : undefined;

      const pMod = await this.prisma.projectModule.create({
        data: { projectId: project.id, name: tMod.name, order: tMod.order, startDate: modStart, endDate: modEnd },
      });

      for (const tPhase of tMod.phases) {
        const phDates = phaseDateMap.get(tPhase.id);
        const phStart = phDates?.startDate ? new Date(phDates.startDate) : undefined;
        const phEnd   = phDates?.endDate   ? new Date(phDates.endDate)   : undefined;

        const phase = await this.prisma.phase.create({
          data: {
            projectModuleId: pMod.id,
            name: tPhase.name, slug: tPhase.slug, order: tPhase.order,
            color: tPhase.color, icon: tPhase.icon, status: 'pendiente',
            startDate: phStart, endDate: phEnd,
            responsibleId:  phDates?.agentLeaderId  || null,
            clientStaffId:  phDates?.clientLeaderId || null,
          },
        });

        for (const tAct of tPhase.activities) {
          await this.prisma.activity.create({
            data: {
              phaseId: phase.id,
              code: tAct.code, name: tAct.name, description: tAct.description,
              order: tAct.order, plannedHours: tAct.estimatedHours,
              priority: tAct.priority, status: 'pendiente',
              actualStartDate: phStart,
              actualEndDate: phEnd,
            },
          });
        }
      }
    }

    return this.prisma.project.findUnique({
      where: { id: project.id },
      include: { serviceOrder: { select: { osNumber: true, product: true } }, _count: { select: { modules: true } } },
    });
  }
}
