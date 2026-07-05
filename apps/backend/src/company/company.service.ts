import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);
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

    // Para proyectos/OS: filtrar por el rol del agente en la orden de servicio
    // (líder clínico, líder financiero, o implementador asignado)
    const osAgentFilter = agentId
      ? { OR: [
          { clinicalLeaderId: agentId },
          { financialLeaderId: agentId },
          { implementers: { some: { userId: agentId } } },
        ]}
      : {};
    const osScopeFiltered  = { ...osScope, ...osAgentFilter };
    const projScopeFiltered = { serviceOrder: osScopeFiltered };

    // actScope usa projScope base (no filtrado por líder) porque las actividades
    // ya filtran por assignedToId — así se ven actividades de Keiber en proyectos
    // donde él no es líder pero sí tiene tareas asignadas.
    const actScope  = { phase: { projectModule: { project: projScope } }, ...(agentId && { assignedToId: agentId }) };
    const reqScope  = { companyId, ...(clientId && { clientId }), ...(agentId && { agenteId: agentId }) };
    const actaScope = { project: projScopeFiltered };

    const reqWhere      = { ...reqScope,         ...(createdAtRange && { createdAt: createdAtRange }) };
    const projectWhere  = { ...projScopeFiltered, ...(createdAtRange && { createdAt: createdAtRange }) };
    const activityWhere = { ...actScope,          ...(createdAtRange && { createdAt: createdAtRange }) };
    const actaWhere     = { ...actaScope,         ...(createdAtRange && { createdAt: createdAtRange }) };
    const osHistWhere   = { serviceOrder: osScopeFiltered, ...(createdAtRange && { createdAt: createdAtRange }) };

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
        where: osScopeFiltered,
        select: { client: { select: { businessName: true } }, project: { select: { progressPercent: true } } },
        take: 6, orderBy: { createdAt: 'desc' },
      }),
      // ── Carga de trabajo por implementador ────────────────────────────────
      // Sin filtro de fecha → backlog completo de proyectos activos.
      // Con filtro de fecha → actividades cuya plannedEndDate cae en el rango.
      // assignedToId se construye una sola vez para evitar que { not: null }
      // sobreescriba el filtro por agente específico.
      this.prisma.activity.groupBy({
        by: ['assignedToId'],
        where: {
          phase: { projectModule: { project: { ...projScopeFiltered, status: 'activo' } } },
          status: { in: ['pendiente', 'en_proceso'] },
          assignedToId: agentId ? agentId : { not: null },
          ...(createdAtRange && { plannedEndDate: createdAtRange }),
        },
        _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 8,
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

  // ── AI Executive Insight ───────────────────────────────────────────────────
  async getAiInsight(companyId: string, filters: { clientId?: string; agentId?: string; dateFrom?: Date; dateTo?: Date } = {}) {
    const dash = await this.getDashboard(companyId, filters);

    const kpis = dash.kpis;
    const risks = dash.projectRisks;
    const actas = dash.pendingActasSignature;
    const upcoming = dash.upcomingActivities;
    const workload = dash.implementerWorkload;

    const prompt = `Eres el asistente ejecutivo de AURA ERP, una plataforma de gestión de implementaciones de software hospitalario para Sistemas Infotec.

Analiza el siguiente resumen operativo del día y genera un briefing ejecutivo conciso en español.

=== ESTADO OPERATIVO ===
- Clientes activos: ${kpis.activeClients.value} (${kpis.activeClients.delta > 0 ? '+' : ''}${kpis.activeClients.delta} vs período anterior)
- Proyectos activos: ${kpis.activeProjects.value} (${kpis.activeProjects.delta > 0 ? '+' : ''}${kpis.activeProjects.delta})
- Actividades pendientes: ${kpis.pendingActivities.value}
- Actividades VENCIDAS: ${kpis.overdueActivities.value} ← ALERTA
- Tickets abiertos: ${kpis.openTickets.value}
- Actas pendientes de firma: ${kpis.pendingActas.value}

=== PROYECTOS POR ESTADO ===
${dash.projectsByStatus.map(p => `  ${p.status}: ${p.count}`).join('\n') || '  Sin datos'}

=== ALERTAS DE RIESGO (${risks.length} total) ===
${risks.slice(0, 5).map(r => `  [${r.risk.toUpperCase()}] OS ${r.osNumber} — ${r.client}: ${r.reason}`).join('\n') || '  Sin alertas activas'}

=== ACTAS SIN FIRMAR MÁS URGENTES ===
${actas.slice(0, 4).map(a => `  ${a.client} — ${a.type} — ${a.daysPending} días pendiente (${a.signedFirmantes}/${a.totalFirmantes} firmas)`).join('\n') || '  Ninguna'}

=== CARGA DE IMPLEMENTADORES ===
${workload.slice(0, 5).map(w => `  ${w.name}: ${w.count} proyectos`).join('\n') || '  Sin datos'}

=== PRÓXIMAS ACTIVIDADES (${upcoming.length}) ===
${upcoming.slice(0, 4).map(a => `  ${a.name} — ${a.client} — ${a.date ? new Date(a.date).toLocaleDateString('es-CO') : 'sin fecha'}`).join('\n') || '  Ninguna'}

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "resumen": "2-3 oraciones concisas describiendo el estado general de las operaciones hoy",
  "alertas": ["alerta corta 1", "alerta corta 2", "alerta corta 3"],
  "recomendacion": "Una recomendación ejecutiva concreta y accionable para hoy",
  "estado": "verde" | "amarillo" | "rojo"
}

El campo "estado" debe ser "rojo" si hay riesgos críticos o muchas actividades vencidas, "amarillo" si hay alertas moderadas, "verde" si todo está bajo control.`;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('GROQ_API_KEY no configurada');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Groq API error ${response.status}: ${err}`);
        throw new InternalServerErrorException('Error al consultar la IA');
      }

      const data: any = await response.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';

      // Extraer JSON de la respuesta (puede venir con texto alrededor)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new InternalServerErrorException('Respuesta IA inválida');

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        resumen:        parsed.resumen        ?? '',
        alertas:        Array.isArray(parsed.alertas) ? parsed.alertas.slice(0, 4) : [],
        recomendacion:  parsed.recomendacion  ?? '',
        estado:         ['verde', 'amarillo', 'rojo'].includes(parsed.estado) ? parsed.estado : 'amarillo',
        generadoEn:     new Date().toISOString(),
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new InternalServerErrorException('Timeout al consultar la IA');
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error('getAiInsight error:', err);
      throw new InternalServerErrorException('Error al generar el análisis IA');
    } finally {
      clearTimeout(timeout);
    }
  }
}
