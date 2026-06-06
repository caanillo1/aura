import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async findOne(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, name: true, commercialName: true, nit: true,
        logo: true, primaryColor: true, secondaryColor: true,
        address: true, city: true, department: true,
        email: true, phone: true, website: true,
        smtpHost: true, smtpPort: true, smtpUser: true,
        smtpFromName: true, smtpFromEmail: true,
        emailSignature: true, filesBasePath: true,
        isActive: true, createdAt: true,
        // No exponer rootPassword ni agentRegPassword
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    await this.findOne(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: dto,
      select: {
        id: true, name: true, commercialName: true, nit: true,
        primaryColor: true, secondaryColor: true,
        address: true, city: true, department: true,
        email: true, phone: true, website: true,
        smtpHost: true, smtpPort: true, smtpUser: true,
        smtpFromName: true, smtpFromEmail: true,
        emailSignature: true, filesBasePath: true,
        updatedAt: true,
      },
    });
  }

  async getConfigs(companyId: string) {
    return this.prisma.systemConfig.findMany({
      where: { companyId },
      select: { configKey: true, configValue: true, description: true, updatedAt: true },
      orderBy: { configKey: 'asc' },
    });
  }

  async upsertConfig(companyId: string, key: string, value: string) {
    return this.prisma.systemConfig.upsert({
      where: { companyId_configKey: { companyId, configKey: key } },
      update: { configValue: value },
      create: { companyId, configKey: key, configValue: value },
    });
  }

  async getRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      select: { id: true, name: true, slug: true, description: true, permissions: true, isSystem: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateRolePermissions(companyId: string, roleId: string, permissions: string[]) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new Error('Rol no encontrado');
    return this.prisma.role.update({
      where: { id: roleId },
      data: { permissions: JSON.stringify(permissions) },
      select: { id: true, name: true, slug: true, permissions: true },
    });
  }

  async getStats(companyId: string) {
    const [users, clients, serviceOrders, activeProjects] = await Promise.all([
      this.prisma.user.count({ where: { companyId, isActive: true } }),
      this.prisma.client.count({ where: { companyId, isActive: true } }),
      this.prisma.serviceOrder.count({ where: { companyId } }),
      this.prisma.project.count({
        where: { serviceOrder: { companyId }, status: 'activo' },
      }),
    ]);
    return { users, clients, serviceOrders, activeProjects };
  }
}
