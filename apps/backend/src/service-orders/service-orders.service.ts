import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import {
  CreateServiceOrderDto, UpdateServiceOrderDto,
  ChangeStatusDto, AddImplementerDto, ServiceOrderFilterDto,
} from './dto/service-order.dto';

const OS_SELECT = {
  id: true, osNumber: true, product: true, scope: true,
  durationDays: true, startDate: true, endDate: true,
  observations: true, status: true, createdAt: true, updatedAt: true,
  client: { select: { id: true, businessName: true, nit: true } },
  clinicalLeader:  { select: { id: true, firstName: true, lastName: true } },
  financialLeader: { select: { id: true, firstName: true, lastName: true } },
  clientLeader:    { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  implementers: {
    select: {
      role: true, assignedAt: true,
      user: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
    },
  },
  _count: { select: { history: true } },
};

@Injectable()
export class ServiceOrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, dto: ServiceOrderFilterDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: Prisma.ServiceOrderWhereInput = { companyId };
    if (dto.search) {
      where.OR = [
        { osNumber: { contains: dto.search } },
        { product: { contains: dto.search } },
        { client: { businessName: { contains: dto.search } } },
      ];
    }
    if (dto.status) where.status = dto.status;
    if (dto.clientId) where.clientId = dto.clientId;

    const [data, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where, select: OS_SELECT, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async findOne(companyId: string, id: string) {
    const os = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      include: {
        client: { select: { id: true, businessName: true, nit: true } },
        clinicalLeader:  { select: { id: true, firstName: true, lastName: true } },
        financialLeader: { select: { id: true, firstName: true, lastName: true } },
        clientLeader:    { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        implementers: {
          include: { user: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
        },
        history: { orderBy: { createdAt: 'desc' } },
        project: { select: { id: true, name: true, status: true, progressPercent: true } },
      },
    });
    if (!os) throw new NotFoundException('Orden de servicio no encontrada');
    return os;
  }

  async create(companyId: string, createdById: string, dto: CreateServiceOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.serviceOrder.count({ where: { companyId } });
      const year = new Date().getFullYear();
      const osNumber = `OS-${year}-${String(count + 1).padStart(3, '0')}`;

      const os = await tx.serviceOrder.create({
        data: {
          companyId, createdById, osNumber,
          clientId: dto.clientId,
          product: dto.product,
          scope: dto.scope,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          durationDays: dto.durationDays ?? 0,
          clinicalLeaderId: dto.clinicalLeaderId,
          financialLeaderId: dto.financialLeaderId,
          observations: dto.observations,
          status: 'pendiente',
        },
        select: OS_SELECT,
      });

      await tx.serviceOrderHistory.create({
        data: {
          serviceOrderId: os.id,
          changedById: createdById,
          fieldName: 'status',
          oldValue: null,
          newValue: 'pendiente',
          reason: 'Creación de la orden de servicio',
        },
      });

      return os;
    });
  }

  async update(companyId: string, id: string, dto: UpdateServiceOrderDto) {
    await this.findOne(companyId, id);
    const data: any = {
      ...(dto.product      !== undefined && { product:          dto.product.trim().toUpperCase() }),
      ...(dto.scope        !== undefined && { scope:            dto.scope?.trim().toUpperCase() || null }),
      ...(dto.observations !== undefined && { observations:     dto.observations?.trim().toUpperCase() || null }),
      ...(dto.durationDays !== undefined && { durationDays:     dto.durationDays }),
      ...(dto.startDate    !== undefined && { startDate:        new Date(dto.startDate) }),
      ...(dto.endDate      !== undefined && { endDate:          new Date(dto.endDate) }),
      ...(dto.clinicalLeaderId  !== undefined && { clinicalLeaderId:  dto.clinicalLeaderId  || null }),
      ...(dto.financialLeaderId !== undefined && { financialLeaderId: dto.financialLeaderId || null }),
      ...(dto.clientLeaderId    !== undefined && { clientLeaderId:    dto.clientLeaderId    || null }),
    };
    return this.prisma.serviceOrder.update({ where: { id }, data, select: OS_SELECT });
  }

  async changeStatus(companyId: string, id: string, changedById: string, dto: ChangeStatusDto) {
    const os = await this.findOne(companyId, id);
    const oldStatus = os.status;
    if (oldStatus === dto.status) {
      throw new BadRequestException('El estado es igual al actual');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.serviceOrder.update({
        where: { id },
        data: { status: dto.status },
        select: OS_SELECT,
      }),
      this.prisma.serviceOrderHistory.create({
        data: {
          serviceOrderId: id,
          changedById,
          fieldName: 'status',
          oldValue: oldStatus,
          newValue: dto.status,
          reason: dto.reason,
        },
      }),
    ]);
    return updated;
  }

  async addImplementer(companyId: string, id: string, dto: AddImplementerDto) {
    await this.findOne(companyId, id);
    const existing = await this.prisma.serviceOrderImplementer.findUnique({
      where: { serviceOrderId_userId: { serviceOrderId: id, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('El implementador ya está asignado');

    return this.prisma.serviceOrderImplementer.create({
      data: { serviceOrderId: id, userId: dto.userId, role: dto.role ?? 'apoyo' },
      include: { user: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
    });
  }

  async removeImplementer(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    const existing = await this.prisma.serviceOrderImplementer.findUnique({
      where: { serviceOrderId_userId: { serviceOrderId: id, userId } },
    });
    if (!existing) throw new NotFoundException('Implementador no encontrado en esta OS');
    await this.prisma.serviceOrderImplementer.delete({
      where: { serviceOrderId_userId: { serviceOrderId: id, userId } },
    });
    return { message: 'Implementador removido' };
  }
}
