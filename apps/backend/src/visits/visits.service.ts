import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto, UpdateVisitDto, FilterVisitDto } from './dto/visit.dto';

const INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  project: {
    select: {
      id: true, name: true,
      serviceOrder: { select: { id: true, osNumber: true, client: { select: { id: true, businessName: true } } } },
    },
  },
  visitActivities: {
    include: {
      activity: {
        select: {
          id: true, code: true, name: true, status: true,
          phase: {
            select: {
              id: true, name: true,
              projectModule: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, dto: FilterVisitDto) {
    const where: any = {
      project: { serviceOrder: { companyId } },
    };

    if (dto.projectId) {
      await this.assertProjectAccess(companyId, dto.projectId);
      where.projectId = dto.projectId;
    }

    if (dto.status) where.status = dto.status;

    if (dto.from || dto.to) {
      where.visitDate = {};
      if (dto.from) where.visitDate.gte = new Date(dto.from);
      if (dto.to)   where.visitDate.lte = new Date(dto.to);
    }

    return this.prisma.visit.findMany({
      where,
      include: INCLUDE,
      orderBy: { visitDate: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id }, include: INCLUDE });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    await this.assertProjectAccess(companyId, visit.projectId);
    return visit;
  }

  async create(companyId: string, userId: string, dto: CreateVisitDto) {
    await this.assertProjectAccess(companyId, dto.projectId);

    const { activityIds, visitDate, startTime, endTime, ...rest } = dto;

    return this.prisma.visit.create({
      data: {
        ...rest,
        visitDate: new Date(visitDate),
        startTime: startTime ? new Date(`1970-01-01T${startTime}:00`) : undefined,
        endTime:   endTime   ? new Date(`1970-01-01T${endTime}:00`)   : undefined,
        createdById: userId,
        visitActivities: activityIds?.length
          ? { create: activityIds.map((activityId) => ({ activityId })) }
          : undefined,
      },
      include: INCLUDE,
    });
  }

  async update(companyId: string, id: string, dto: UpdateVisitDto) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    await this.assertProjectAccess(companyId, visit.projectId);

    const { activityIds, visitDate, startTime, endTime, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (activityIds !== undefined) {
        await tx.visitActivity.deleteMany({ where: { visitId: id } });
        if (activityIds.length) {
          await tx.visitActivity.createMany({
            data: activityIds.map((activityId) => ({ visitId: id, activityId })),
          });
        }
      }

      return tx.visit.update({
        where: { id },
        data: {
          ...rest,
          ...(visitDate ? { visitDate: new Date(visitDate) } : {}),
          ...(startTime !== undefined ? { startTime: startTime ? new Date(`1970-01-01T${startTime}:00`) : null } : {}),
          ...(endTime   !== undefined ? { endTime:   endTime   ? new Date(`1970-01-01T${endTime}:00`)   : null } : {}),
        },
        include: INCLUDE,
      });
    });
  }

  async remove(companyId: string, id: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    await this.assertProjectAccess(companyId, visit.projectId);
    await this.prisma.visit.delete({ where: { id } });
    return { message: 'Visita eliminada' };
  }

  private async assertProjectAccess(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, serviceOrder: { companyId } },
    });
    if (!project) throw new ForbiddenException('Proyecto no encontrado o sin acceso');
  }
}
