import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginationDto, paginate, buildMeta } from '../common/dto/pagination.dto';
import {
  CreateClientDto, UpdateClientDto, CreateStaffDto, UpdateStaffDto, BulkCreateStaffDto,
} from './dto/client.dto';

const CLIENT_SELECT = {
  id: true, nit: true, businessName: true, commercialName: true,
  address: true, city: true, department: true,
  email: true, phone: true, economicActivity: true,
  isActive: true, createdAt: true, updatedAt: true,
  _count: { select: { staff: true, users: true, serviceOrders: true } },
};

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, dto: PaginationDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: Prisma.ClientWhereInput = { companyId };
    if (dto.search) {
      where.OR = [
        { businessName:   { contains: dto.search } },
        { commercialName: { contains: dto.search } },
        { nit:            { contains: dto.search } },
        { city:           { contains: dto.search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({ where, select: CLIENT_SELECT, skip, take, orderBy: { businessName: 'asc' } }),
      this.prisma.client.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        staff: { orderBy: { firstName: 'asc' } },
        _count: { select: { users: true, serviceOrders: true } },
      },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(companyId: string, createdById: string, dto: CreateClientDto) {
    const exists = await this.prisma.client.findFirst({
      where: { companyId, nit: dto.nit.trim() },
    });
    if (exists) throw new ConflictException(`Ya existe un cliente con el NIT ${dto.nit}`);

    return this.prisma.client.create({
      data: { ...dto, nit: dto.nit.trim(), companyId, createdById },
      select: CLIENT_SELECT,
    });
  }

  async update(companyId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.update({
      where: { id },
      data: dto,
      select: CLIENT_SELECT,
    });
  }

  async toggleStatus(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({ where: { id, companyId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return this.prisma.client.update({
      where: { id },
      data: { isActive: !client.isActive },
      select: CLIENT_SELECT,
    });
  }

  // â”€â”€ USUARIOS DEL CLIENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async findUsers(companyId: string, clientId: string) {
    await this.findOne(companyId, clientId);
    return this.prisma.user.findMany({
      where: { companyId, clientId },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        document: true, jobTitle: true, phone: true,
        isActive: true, lastLoginAt: true,
        role: { select: { name: true, slug: true } },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  // â”€â”€ PERSONAL DEL CLIENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async findStaff(companyId: string, clientId: string) {
    await this.findOne(companyId, clientId);
    return this.prisma.clientStaff.findMany({
      where: { clientId },
      orderBy: { firstName: 'asc' },
    });
  }

  async createStaff(companyId: string, clientId: string, dto: CreateStaffDto) {
    await this.findOne(companyId, clientId);
    return this.prisma.clientStaff.create({
      data: { ...dto, clientId },
    });
  }

  async updateStaff(companyId: string, clientId: string, staffId: string, dto: UpdateStaffDto) {
    await this.findOne(companyId, clientId);
    const staff = await this.prisma.clientStaff.findFirst({ where: { id: staffId, clientId } });
    if (!staff) throw new NotFoundException('Funcionario no encontrado');
    return this.prisma.clientStaff.update({ where: { id: staffId }, data: dto });
  }

  async deleteStaff(companyId: string, clientId: string, staffId: string) {
    await this.findOne(companyId, clientId);
    const staff = await this.prisma.clientStaff.findFirst({ where: { id: staffId, clientId } });
    if (!staff) throw new NotFoundException('Funcionario no encontrado');
    await this.prisma.clientStaff.delete({ where: { id: staffId } });
    return { message: 'Funcionario eliminado' };
  }

  async bulkCreateStaff(companyId: string, clientId: string, dto: BulkCreateStaffDto) {
    await this.findOne(companyId, clientId);
    const created = await this.prisma.clientStaff.createMany({
      data: dto.items.map(item => ({
        clientId,
        document: item.document,
        firstName: item.firstName,
        lastName: item.lastName,
        jobTitle: item.jobTitle,
        email: item.email,
        phone: item.phone,
        area: item.area,
        isProjectLeader: item.isProjectLeader ?? false,
      })),
    });
    return { count: created.count, message: `${created.count} funcionario(s) importado(s)` };
  }
}

