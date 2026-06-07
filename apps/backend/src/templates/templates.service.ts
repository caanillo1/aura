import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate, buildMeta } from '../common/dto/pagination.dto';
import {
  CreateTemplateFlowDto, UpdateTemplateFlowDto,
  CreateTemplateModuleDto, UpdateTemplateModuleDto, ReorderDto,
  CreateTemplatePhaseDto, UpdateTemplatePhaseDto,
  CreateTemplateActivityDto, UpdateTemplateActivityDto, CreateActivityThreadDto,
  CreateStandaloneModuleDto,
} from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  // ── Flows ─────────────────────────────────────────────────────────────────

  async findAll(companyId: string, dto: PaginationDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { companyId };
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search } },
        { category: { contains: dto.search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.templateFlow.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, description: true, category: true,
          version: true, isActive: true, isDefault: true, createdAt: true,
          _count: { select: { modules: true } },
        },
      }),
      this.prisma.templateFlow.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async findOne(companyId: string, id: string) {
    const flow = await this.prisma.templateFlow.findFirst({
      where: { id, companyId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            phases: {
              orderBy: { order: 'asc' },
              include: {
                activities: {
                  orderBy: { order: 'asc' },
                  include: { subActivities: { orderBy: { order: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });
    if (!flow) throw new NotFoundException('Plantilla no encontrada');
    return flow;
  }

  async create(companyId: string, createdById: string, dto: CreateTemplateFlowDto) {
    return this.prisma.templateFlow.create({
      data: { ...dto, companyId, createdById, version: dto.version ?? '1.0' },
    });
  }

  async update(companyId: string, id: string, dto: UpdateTemplateFlowDto) {
    await this.findOne(companyId, id);
    return this.prisma.templateFlow.update({ where: { id }, data: dto });
  }

  async deleteTemplate(companyId: string, id: string) {
    await this.findOne(companyId, id);

    // Manual cascade: sub-activities → activities → phases → unlink modules → flow
    const mods = await this.prisma.templateModule.findMany({
      where: { templateFlowId: id },
      select: { id: true },
    });
    const modIds = mods.map((m) => m.id);

    if (modIds.length > 0) {
      const phases = await this.prisma.templatePhase.findMany({
        where: { templateModuleId: { in: modIds } },
        select: { id: true },
      });
      const phaseIds = phases.map((p) => p.id);

      if (phaseIds.length > 0) {
        const acts = await this.prisma.templateActivity.findMany({
          where: { templatePhaseId: { in: phaseIds } },
          select: { id: true },
        });
        const actIds = acts.map((a) => a.id);
        if (actIds.length > 0) {
          await this.prisma.templateSubActivity.deleteMany({ where: { templateActivityId: { in: actIds } } });
          await this.prisma.templateActivity.deleteMany({ where: { id: { in: actIds } } });
        }
        await this.prisma.templatePhase.deleteMany({ where: { id: { in: phaseIds } } });
      }
      // Unlink modules from template (don't delete from library)
      await this.prisma.templateModule.updateMany({
        where: { id: { in: modIds } },
        data: { templateFlowId: null },
      });
    }

    await this.prisma.project.updateMany({ where: { templateFlowId: id }, data: { templateFlowId: null } });
    await this.prisma.templateFlow.delete({ where: { id } });
    return { message: 'Plantilla eliminada' };
  }

  async toggleTemplateStatus(companyId: string, id: string) {
    const flow = await this.findOne(companyId, id);
    return this.prisma.templateFlow.update({ where: { id }, data: { isActive: !flow.isActive } });
  }

  async assignModuleToTemplate(companyId: string, templateId: string, moduleId: string) {
    await this.findOne(companyId, templateId);
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, companyId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    const count = await this.prisma.templateModule.count({ where: { templateFlowId: templateId } });
    return this.prisma.templateModule.update({
      where: { id: moduleId },
      data: { templateFlowId: templateId, order: count },
      include: {
        templateFlow: { select: { id: true, name: true, version: true } },
        _count: { select: { phases: true } },
      },
    });
  }

  // ── Modules ───────────────────────────────────────────────────────────────

  private async nextModuleCode(companyId: string): Promise<string> {
    const mods = await this.prisma.templateModule.findMany({
      where: { companyId },
      select: { code: true },
    });
    const maxNum = mods.reduce((max, m) => {
      const n = parseInt(m.code.replace('MOD-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `MOD-${String(maxNum + 1).padStart(3, '0')}`;
  }

  private async nextActivityCode(moduleId: string): Promise<string> {
    const phases = await this.prisma.templatePhase.findMany({
      where: { templateModuleId: moduleId },
      select: { id: true },
    });
    const phaseIds = phases.map((p) => p.id);
    const acts = phaseIds.length
      ? await this.prisma.templateActivity.findMany({
          where: { templatePhaseId: { in: phaseIds } },
          select: { code: true },
        })
      : [];
    const maxNum = acts.reduce((max, a) => {
      const n = parseInt(a.code.replace('ACT-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `ACT-${String(maxNum + 1).padStart(2, '0')}`;
  }

  async createStandaloneModule(companyId: string, dto: CreateStandaloneModuleDto) {
    const code  = await this.nextModuleCode(companyId);
    const count = await this.prisma.templateModule.count({ where: { companyId } });
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.templateModule.create({
      data: {
        ...rest,
        companyId,
        code,
        order: count,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate:   endDate   ? new Date(endDate)   : undefined,
      },
      include: {
        templateFlow: { select: { id: true, name: true, version: true } },
        _count: { select: { phases: true } },
      },
    });
  }

  async findAllModules(companyId: string, dto: PaginationDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { companyId };
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search } },
        { description: { contains: dto.search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.templateModule.findMany({
        where, skip, take, orderBy: { order: 'asc' },
        include: {
          templateFlow: { select: { id: true, name: true, version: true } },
          _count: { select: { phases: true } },
        },
      }),
      this.prisma.templateModule.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async updateModuleById(companyId: string, moduleId: string, dto: UpdateTemplateModuleDto) {
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, companyId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    const { startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templateModule.update({
      where: { id: moduleId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
      include: {
        templateFlow: { select: { id: true, name: true, version: true } },
        _count: { select: { phases: true } },
      },
    });
  }

  async deleteModuleById(companyId: string, moduleId: string) {
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, companyId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    await this.prisma.templateModule.delete({ where: { id: moduleId } });
    return { message: 'Módulo eliminado' };
  }

  async toggleModuleStatus(companyId: string, moduleId: string) {
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, companyId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    return this.prisma.templateModule.update({
      where: { id: moduleId },
      data: { isActive: !mod.isActive },
      include: {
        templateFlow: { select: { id: true, name: true, version: true } },
        _count: { select: { phases: true } },
      },
    });
  }

  async addModule(companyId: string, flowId: string, dto: CreateTemplateModuleDto) {
    await this.findOne(companyId, flowId);
    const count = await this.prisma.templateModule.count({ where: { templateFlowId: flowId } });
    const code = await this.nextModuleCode(companyId);
    const { startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templateModule.create({
      data: {
        ...rest,
        companyId,
        code,
        templateFlowId: flowId,
        order: count,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async updateModule(companyId: string, flowId: string, moduleId: string, dto: UpdateTemplateModuleDto) {
    await this.findOne(companyId, flowId);
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, templateFlowId: flowId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    const { startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templateModule.update({
      where: { id: moduleId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async deleteModule(companyId: string, flowId: string, moduleId: string) {
    await this.findOne(companyId, flowId);
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, templateFlowId: flowId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    await this.prisma.templateModule.update({ where: { id: moduleId }, data: { templateFlowId: null } });
    return { message: 'Módulo desvinculado de la plantilla' };
  }

  async reorderModules(companyId: string, flowId: string, dto: ReorderDto) {
    await this.findOne(companyId, flowId);
    await Promise.all(dto.items.map(({ id, order }) =>
      this.prisma.templateModule.update({ where: { id }, data: { order } }),
    ));
    return { message: 'Módulos reordenados' };
  }

  // ── Module-scoped phase/activity CRUD ─────────────────────────────────────

  async getModuleDetail(companyId: string, moduleId: string) {
    const mod = await this.prisma.templateModule.findFirst({
      where: { id: moduleId, companyId },
      include: {
        templateFlow: { select: { id: true, name: true, version: true } },
        phases: {
          orderBy: { order: 'asc' },
          include: { activities: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    return mod;
  }

  private async verifyModOwnership(companyId: string, moduleId: string) {
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, companyId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    return mod;
  }

  async addPhaseToModule(companyId: string, moduleId: string, dto: CreateTemplatePhaseDto) {
    await this.verifyModOwnership(companyId, moduleId);
    const count = await this.prisma.templatePhase.count({ where: { templateModuleId: moduleId } });
    const slug = dto.slug?.trim() || dto.name.toLowerCase().replace(/\s+/g, '_');
    const { startDate, endDate, executionDate, slug: _s, ...rest } = dto;
    return this.prisma.templatePhase.create({
      data: {
        ...rest,
        slug,
        templateModuleId: moduleId,
        order: count,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async updatePhaseInModule(companyId: string, moduleId: string, phaseId: string, dto: UpdateTemplatePhaseDto) {
    await this.verifyModOwnership(companyId, moduleId);
    const phase = await this.prisma.templatePhase.findFirst({ where: { id: phaseId, templateModuleId: moduleId } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    const { startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templatePhase.update({
      where: { id: phaseId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async deletePhaseFromModule(companyId: string, moduleId: string, phaseId: string) {
    await this.verifyModOwnership(companyId, moduleId);
    const phase = await this.prisma.templatePhase.findFirst({ where: { id: phaseId, templateModuleId: moduleId } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    const acts = await this.prisma.templateActivity.findMany({ where: { templatePhaseId: phaseId }, select: { id: true } });
    if (acts.length) {
      await this.prisma.templateSubActivity.deleteMany({ where: { templateActivityId: { in: acts.map(a => a.id) } } });
      await this.prisma.templateActivity.deleteMany({ where: { templatePhaseId: phaseId } });
    }
    await this.prisma.templatePhase.delete({ where: { id: phaseId } });
    return { message: 'Fase eliminada' };
  }

  async reorderPhasesInModule(companyId: string, moduleId: string, dto: ReorderDto) {
    await this.verifyModOwnership(companyId, moduleId);
    await Promise.all(dto.items.map(({ id, order }) =>
      this.prisma.templatePhase.update({ where: { id }, data: { order } }),
    ));
    return { message: 'Fases reordenadas' };
  }

  async addActivityToModulePhase(companyId: string, moduleId: string, phaseId: string, dto: CreateTemplateActivityDto) {
    await this.verifyModOwnership(companyId, moduleId);
    const phase = await this.prisma.templatePhase.findFirst({ where: { id: phaseId, templateModuleId: moduleId } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    const count = await this.prisma.templateActivity.count({ where: { templatePhaseId: phaseId } });
    const code = await this.nextActivityCode(moduleId);
    const { code: _c, startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templateActivity.create({
      data: {
        ...rest,
        code,
        templatePhaseId: phaseId,
        order: count,
        estimatedHours: dto.estimatedHours ?? 0,
        calculatedDays: dto.calculatedDays ?? 0,
        priority: dto.priority ?? 'media',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async updateActivityInModule(companyId: string, moduleId: string, activityId: string, dto: UpdateTemplateActivityDto) {
    await this.verifyModOwnership(companyId, moduleId);
    const activity = await this.prisma.templateActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    const { startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templateActivity.update({
      where: { id: activityId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async deleteActivityFromModule(companyId: string, moduleId: string, activityId: string) {
    await this.verifyModOwnership(companyId, moduleId);
    const activity = await this.prisma.templateActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.prisma.templateSubActivity.deleteMany({ where: { templateActivityId: activityId } });
    await this.prisma.templateActivity.delete({ where: { id: activityId } });
    return { message: 'Actividad eliminada' };
  }

  async reorderActivitiesInModule(companyId: string, moduleId: string, phaseId: string, dto: ReorderDto) {
    await this.verifyModOwnership(companyId, moduleId);
    await Promise.all(dto.items.map(({ id, order }) =>
      this.prisma.templateActivity.update({ where: { id }, data: { order } }),
    ));
    return { message: 'Actividades reordenadas' };
  }

  // ── Phases (template-scoped) ──────────────────────────────────────────────

  async addPhase(companyId: string, flowId: string, moduleId: string, dto: CreateTemplatePhaseDto) {
    await this.findOne(companyId, flowId);
    const mod = await this.prisma.templateModule.findFirst({ where: { id: moduleId, templateFlowId: flowId } });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    const count = await this.prisma.templatePhase.count({ where: { templateModuleId: moduleId } });
    const slug = dto.slug?.trim() || dto.name.toLowerCase().replace(/\s+/g, '_');
    const { startDate, endDate, executionDate, slug: _s, ...rest } = dto;
    return this.prisma.templatePhase.create({
      data: {
        ...rest,
        slug,
        templateModuleId: moduleId,
        order: count,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async updatePhase(companyId: string, flowId: string, phaseId: string, dto: UpdateTemplatePhaseDto) {
    await this.findOne(companyId, flowId);
    const phase = await this.prisma.templatePhase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    const { startDate, endDate, executionDate, ...rest } = dto;
    return this.prisma.templatePhase.update({
      where: { id: phaseId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async deletePhase(companyId: string, flowId: string, moduleId: string, phaseId: string) {
    await this.findOne(companyId, flowId);
    const phase = await this.prisma.templatePhase.findFirst({ where: { id: phaseId, templateModuleId: moduleId } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    await this.prisma.templatePhase.delete({ where: { id: phaseId } });
    return { message: 'Fase eliminada' };
  }

  async reorderPhases(companyId: string, flowId: string, moduleId: string, dto: ReorderDto) {
    await this.findOne(companyId, flowId);
    await Promise.all(dto.items.map(({ id, order }) =>
      this.prisma.templatePhase.update({ where: { id }, data: { order } }),
    ));
    return { message: 'Fases reordenadas' };
  }

  // ── Activities (template-scoped) ──────────────────────────────────────────

  async addActivity(companyId: string, flowId: string, phaseId: string, dto: CreateTemplateActivityDto) {
    await this.findOne(companyId, flowId);
    const phase = await this.prisma.templatePhase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    const count = await this.prisma.templateActivity.count({ where: { templatePhaseId: phaseId } });
    const { startDate, endDate, executionDate, code: _c, ...rest } = dto;
    const code = dto.code?.trim() || await this.nextActivityCode(phase.templateModuleId);
    return this.prisma.templateActivity.create({
      data: {
        ...rest,
        code,
        templatePhaseId: phaseId,
        order: count,
        estimatedHours: dto.estimatedHours ?? 0,
        calculatedDays: dto.calculatedDays ?? 0,
        priority: dto.priority ?? 'media',
        startDate: startDate ? new Date(startDate) : phase.startDate ?? undefined,
        endDate: endDate ? new Date(endDate) : phase.endDate ?? undefined,
        executionDate: executionDate ? new Date(executionDate) : undefined,
      },
    });
  }

  async deleteActivity(companyId: string, flowId: string, activityId: string) {
    await this.findOne(companyId, flowId);
    const activity = await this.prisma.templateActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    await this.prisma.templateActivity.delete({ where: { id: activityId } });
    return { message: 'Actividad eliminada' };
  }

  async reorderActivities(companyId: string, flowId: string, phaseId: string, dto: ReorderDto) {
    await this.findOne(companyId, flowId);
    await Promise.all(dto.items.map(({ id, order }) =>
      this.prisma.templateActivity.update({ where: { id }, data: { order } }),
    ));
    return { message: 'Actividades reordenadas' };
  }

  // ── Activity Threads ──────────────────────────────────────────────────────

  async getActivityThreads(activityId: string) {
    return this.prisma.activityThread.findMany({
      where: { activityId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      },
    });
  }

  async addActivityThread(activityId: string, authorId: string, authorType: string, dto: CreateActivityThreadDto) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return this.prisma.activityThread.create({
      data: { activityId, authorId, authorType, content: dto.content },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      },
    });
  }

  async deleteActivityThread(threadId: string, authorId: string) {
    const thread = await this.prisma.activityThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Hilo no encontrado');
    if (thread.authorId !== authorId) throw new NotFoundException('No autorizado');
    await this.prisma.activityThread.delete({ where: { id: threadId } });
    return { message: 'Hilo eliminado' };
  }
}
