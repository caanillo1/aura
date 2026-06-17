import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async findOne(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, name: true, commercialName: true, nit: true,
        logo: true, logoData: true, primaryColor: true, secondaryColor: true,
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
    const { agentRegPassword, ...rest } = dto;
    const data: any = { ...rest };
    if (agentRegPassword) {
      data.agentRegPassword = await bcrypt.hash(agentRegPassword, 10);
    }
    return this.prisma.company.update({
      where: { id: companyId },
      data,
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

  async createRole(companyId: string, name: string, description?: string) {
    const slug = name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const exists = await this.prisma.role.findFirst({ where: { companyId, slug } });
    if (exists) throw new ConflictException(`Ya existe un rol con el slug "${slug}"`);

    return this.prisma.role.create({
      data: { companyId, name, slug, description, isSystem: false },
      select: { id: true, name: true, slug: true, description: true, permissions: true, isSystem: true, isActive: true },
    });
  }

  async deleteRole(companyId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.isSystem) throw new BadRequestException('No se puede eliminar un rol del sistema');

    const usersCount = await this.prisma.user.count({ where: { roleId } });
    if (usersCount > 0) throw new BadRequestException(`El rol tiene ${usersCount} usuario(s) asignado(s). Reasígnalos antes de eliminar.`);

    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: 'Rol eliminado correctamente' };
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

  async getDashboard(
    companyId: string,
    filters: { clientId?: string; agentId?: string; dateFrom?: Date; dateTo?: Date } = {},
  ) {
    const { clientId, agentId, dateFrom, dateTo } = filters;
    const now = new Date();
    const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfWeek    = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfPrevWeek = new Date(now); startOfPrevWeek.setDate(now.getDate() - 14);
    const endOfPrevWeek   = new Date(now); endOfPrevWeek.setDate(now.getDate() - 7);

    // ── Filter objects ────────────────────────────────────────────────────────
    const dateToCapped = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23,59,59,999); return d; })() : undefined;
    const createdAtRange = (dateFrom || dateToCapped)
      ? { ...(dateFrom && { gte: dateFrom }), ...(dateToCapped && { lte: dateToCapped }) }
      : undefined;

    const osScope   = { companyId, ...(clientId && { clientId }) };
    const projScope = { serviceOrder: osScope };
    const actScope  = { phase: { projectModule: { project: projScope } }, ...(agentId && { assignedToId: agentId }) };
    const reqScope  = { companyId, ...(clientId && { clientId }), ...(agentId && { agenteId: agentId }) };
    const actaScope = { project: projScope };

    const reqWhere      = { ...reqScope,  ...(createdAtRange && { createdAt: createdAtRange }) };
    const projectWhere  = { ...projScope, ...(createdAtRange && { createdAt: createdAtRange }) };
    const activityWhere = { ...actScope,  ...(createdAtRange && { createdAt: createdAtRange }) };
    const actaWhere     = { ...actaScope, ...(createdAtRange && { createdAt: createdAtRange }) };
    const osHistWhere   = { serviceOrder: osScope, ...(createdAtRange && { createdAt: createdAtRange }) };

    const [
      activeClients, activeProjects, pendingActivities, openTickets, pendingActas, overdueActivities,
      clientsPrevMonth, projectsPrevMonth, activitiesPrevWeek, ticketsPrevMonth, actasPrevWeek, overduePrevWeek,
      projectsByStatus, activitiesByStatus,
      serviceOrdersWithProgress, implementerWorkload,
      actasPendingSignature, upcomingActivities, ticketsByStatus,
      // Risks: notas con nivel critico/alto en órdenes de servicio
      riskNotes,
    ] = await Promise.all([
      // ── KPI actuales ──────────────────────────────────────────────────────
      this.prisma.client.count({ where: { companyId, isActive: true, ...(clientId && { id: clientId }) } }),
      this.prisma.project.count({ where: { ...projectWhere, status: 'activo' } }),
      this.prisma.activity.count({
        where: { ...activityWhere, status: 'pendiente' },
      }),
      this.prisma.requerimiento.count({
        where: { ...reqWhere, estadoActual: { in: ['Elaborado', 'En revisión', 'Aprobado'] } },
      }),
      // Actas: todas las que no sean borrador (incluye las publicadas/enviadas sin firma completa)
      this.prisma.acta.count({
        where: {
          ...actaWhere,
          status: { not: 'borrador' },
          OR: [
            { firmantes: { some: { signedAt: null } } },
            { firmantes: { none: {} } },
          ],
        },
      }),
      this.prisma.activity.count({
        where: {
          ...activityWhere,
          status: { notIn: ['completado', 'cancelado'] },
          plannedEndDate: { lt: now },
        },
      }),
      // ── KPI períodos anteriores ────────────────────────────────────────────
      this.prisma.client.count({ where: { companyId, isActive: true, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
      this.prisma.project.count({ where: { ...projScope, status: 'activo', createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
      this.prisma.activity.count({
        where: { ...actScope, status: 'pendiente', createdAt: { gte: startOfPrevWeek, lte: endOfPrevWeek } },
      }),
      this.prisma.requerimiento.count({
        where: { ...reqScope, estadoActual: { in: ['Elaborado', 'En revisión', 'Aprobado'] }, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      this.prisma.acta.count({
        where: { ...actaScope, status: { not: 'borrador' }, createdAt: { gte: startOfPrevWeek, lte: endOfPrevWeek } },
      }),
      this.prisma.activity.count({
        where: { ...actScope, status: { notIn: ['completado', 'cancelado'] }, plannedEndDate: { lt: startOfWeek } },
      }),
      // ── Gráficas ──────────────────────────────────────────────────────────
      this.prisma.project.groupBy({ by: ['status'], where: projectWhere, _count: { id: true } }),
      this.prisma.activity.groupBy({ by: ['status'], where: activityWhere, _count: { id: true } }),
      // ── Avance por cliente ────────────────────────────────────────────────
      this.prisma.serviceOrder.findMany({
        where: osScope,
        select: { client: { select: { businessName: true } }, project: { select: { progressPercent: true } } },
        take: 6, orderBy: { createdAt: 'desc' },
      }),
      // ── Carga de trabajo por implementador ────────────────────────────────
      this.prisma.activity.groupBy({
        by: ['assignedToId'],
        where: { ...activityWhere, status: { in: ['pendiente', 'en_proceso'] }, assignedToId: { not: null } },
        _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 5,
      }),
      // ── Actas pendientes de firma: todas las no borrador ──────────────────
      this.prisma.acta.findMany({
        where: {
          ...actaWhere,
          status: { not: 'borrador' },
        },
        select: {
          id: true, type: true, numero: true, fecha: true,
          project: { select: { serviceOrder: { select: { client: { select: { businessName: true } } } } } },
          firmantes: { select: { id: true, signedAt: true } },
        },
        orderBy: { fecha: 'desc' },
        take: 6,
      }),
      // ── Próximas actividades: pendientes ordenadas por fecha (nulos al final) ──
      this.prisma.activity.findMany({
        where: {
          ...activityWhere,
          status: { in: ['pendiente', 'en_proceso'] },
        },
        select: {
          id: true, name: true, plannedStartDate: true,
          phase: { select: { projectModule: { select: { project: { select: { serviceOrder: { select: { client: { select: { businessName: true } } } } } } } } } },
        },
        orderBy: [{ plannedStartDate: { sort: 'asc', nulls: 'last' } }],
        take: 5,
      }),
      // ── Tickets por estado ────────────────────────────────────────────────
      this.prisma.requerimiento.groupBy({ by: ['estadoActual'], where: reqWhere, _count: { id: true } }),
      // ── Riesgos: últimas notas críticas/de alerta en órdenes de servicio ──
      this.prisma.serviceOrderHistory.findMany({
        where: {
          ...osHistWhere,
          noteType: { not: null },
          noteLevel: { in: ['critica', 'alta'] },
        },
        select: {
          id: true, noteLevel: true, noteSubtype: true, reason: true, createdAt: true,
          serviceOrder: {
            select: {
              osNumber: true,
              client: { select: { businessName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    // ── Resolver nombres de implementadores ────────────────────────────────────
    const implementerIds = implementerWorkload.map(i => i.assignedToId!).filter(Boolean);
    const implementerUsers = implementerIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: implementerIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const implementerMap = Object.fromEntries(implementerUsers.map(u => [u.id, u]));

    // ── Deltas este mes ────────────────────────────────────────────────────────
    const clientsThisMonth = await this.prisma.client.count({ where: { companyId, isActive: true, createdAt: { gte: startOfMonth } } });
    const projectsThisMonth = await this.prisma.project.count({ where: { ...projScope, status: 'activo', createdAt: { gte: startOfMonth } } });
    const ticketsThisMonth = await this.prisma.requerimiento.count({ where: { ...reqScope, estadoActual: { in: ['Elaborado', 'En revisión', 'Aprobado'] }, createdAt: { gte: startOfMonth } } });

    return {
      kpis: {
        activeClients:      { value: activeClients,     delta: clientsThisMonth,                       deltaLabel: 'este mes'           },
        activeProjects:     { value: activeProjects,    delta: projectsThisMonth,                      deltaLabel: 'este mes'           },
        pendingActivities:  { value: pendingActivities, delta: pendingActivities - activitiesPrevWeek, deltaLabel: 'vs semana anterior' },
        openTickets:        { value: openTickets,       delta: ticketsThisMonth,                       deltaLabel: 'este mes'           },
        pendingActas:       { value: pendingActas,      delta: pendingActas - actasPrevWeek,           deltaLabel: 'vs semana anterior' },
        overdueActivities:  { value: overdueActivities, delta: overdueActivities - overduePrevWeek,    deltaLabel: 'vs semana anterior' },
      },
      projectsByStatus: projectsByStatus.map(r => ({ status: r.status, count: r._count.id })),
      activitiesByStatus: activitiesByStatus.map(r => ({ status: r.status, count: r._count.id })),
      clientProgress: serviceOrdersWithProgress
        .filter(so => so.project)
        .map(so => ({ client: so.client.businessName, progress: Number(so.project!.progressPercent) })),
      implementerWorkload: implementerWorkload.map(iw => ({
        name: implementerMap[iw.assignedToId!]
          ? `${implementerMap[iw.assignedToId!].firstName} ${implementerMap[iw.assignedToId!].lastName}`
          : 'Sin asignar',
        count: iw._count.id,
      })),
      pendingActasSignature: actasPendingSignature.map(a => ({
        id: a.id,
        client: a.project.serviceOrder.client.businessName,
        type: a.type,
        numero: a.numero,
        fecha: a.fecha,
        daysPending: Math.floor((now.getTime() - new Date(a.fecha).getTime()) / 86400000),
        totalFirmantes: a.firmantes.length,
        signedFirmantes: a.firmantes.filter(f => f.signedAt !== null).length,
      })),
      upcomingActivities: upcomingActivities.map(a => ({
        id: a.id,
        name: a.name,
        date: a.plannedStartDate,
        client: a.phase.projectModule.project.serviceOrder.client.businessName,
      })),
      ticketsByStatus: ticketsByStatus.map(r => ({ status: r.estadoActual, count: r._count.id })),
      projectRisks: riskNotes.map(n => ({
        osNumber: n.serviceOrder.osNumber,
        client: n.serviceOrder.client.businessName,
        risk: (n.noteLevel === 'critica' ? 'critico' : 'alto') as 'critico' | 'alto',
        reason: n.noteSubtype ?? n.reason ?? 'Nota registrada',
        createdAt: n.createdAt,
      })),
    };
  }
}
