import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import { CreateRequerimientoDto, AddGestionDto, RequerimientoFilterDto, EnviarCorreoRequerimientosDto, CreateBulkRequerimientosDto, BulkGestionDto, UpdateRequerimientoDto } from './dto/requerimiento.dto';
import { MailService } from '../mail/mail.service';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const REQ_INCLUDE = {
  client:         { select: { id: true, businessName: true, nit: true } },
  serviceOrder:   { select: { id: true, osNumber: true, product: true, status: true } },
  agente:         { select: { id: true, firstName: true, lastName: true } },
  createdBy:      { select: { id: true, firstName: true, lastName: true } },
  templateModule: { select: { id: true, code: true, name: true } },
  templatePhase:  { select: { id: true, name: true, color: true, order: true } },
  gestiones: {
    orderBy: { createdAt: 'asc' as const },
    include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
};

@Injectable()
export class RequerimientosService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private gateway: EventsGateway,
    private notifications: NotificationsService,
  ) {}

  async findAll(companyId: string, dto: RequerimientoFilterDto) {
    const { take, skip } = paginate(
      Number.isFinite(dto.page)  ? dto.page  : 1,
      Number.isFinite(dto.limit) ? dto.limit : 20,
    );
    const where: any = { companyId };

    if (dto.search) {
      where.OR = [
        { numero:   { contains: dto.search } },
        { titulo:   { contains: dto.search } },
        { ticketRubi: { contains: dto.search } },
      ];
    }
    if (dto.clientId)       where.clientId       = dto.clientId;
    if (dto.serviceOrderId) where.serviceOrderId = dto.serviceOrderId;
    if (dto.agenteId)       where.agenteId       = dto.agenteId;
    if (dto.area)           where.area           = dto.area;
    if (dto.prioridad)      where.prioridad      = dto.prioridad;
    if (dto.estadoActual)   where.estadoActual   = dto.estadoActual;

    const [data, total] = await Promise.all([
      this.prisma.requerimiento.findMany({
        where, include: REQ_INCLUDE, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.requerimiento.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async findOne(companyId: string, id: string) {
    const req = await this.prisma.requerimiento.findFirst({
      where: { id, companyId },
      include: REQ_INCLUDE,
    });
    if (!req) throw new NotFoundException('Requerimiento no encontrado');
    return req;
  }

  async create(companyId: string, userId: string, dto: CreateRequerimientoDto) {
    if (dto.ticketRubi) {
      const dup = await this.prisma.requerimiento.findFirst({
        where: { companyId, ticketRubi: dto.ticketRubi },
        select: { numero: true },
      });
      if (dup) {
        throw new BadRequestException(
          `El Ticket Rubi "${dto.ticketRubi}" ya está registrado en el requerimiento ${dup.numero}. Usa un ticket diferente.`,
        );
      }
    }

    const count = await this.prisma.requerimiento.count({ where: { companyId } });
    const year  = new Date().getFullYear();
    const numero = `REQ-${year}-${String(count + 1).padStart(3, '0')}`;

    const req = await this.prisma.$transaction(async (tx) => {
      const created = await tx.requerimiento.create({
        data: {
          companyId, numero,
          titulo:              dto.titulo,
          tipo:                dto.tipo ?? 'Funcional',
          prioridad:           dto.prioridad ?? 'Media',
          descripcion:         dto.descripcion,
          criteriosAceptacion: dto.criteriosAceptacion,
          templateModuleId:   dto.templateModuleId,
          templatePhaseId:    dto.templatePhaseId,
          area:                dto.area,
          ticketRubi:          dto.ticketRubi,
          estadoActual:        'Elaborado',
          clientId:            dto.clientId,
          serviceOrderId:      dto.serviceOrderId,
          agenteId:            dto.agenteId,
          createdById:         userId,
        },
        include: REQ_INCLUDE,
      });

      await tx.requerimientoGestion.create({
        data: {
          requerimientoId: created.id,
          fecha:           new Date(),
          estado:          'Elaborado',
          observacion:     'Requerimiento registrado',
          changedById:     userId,
        },
      });

      return created;
    });

    if (dto.templatePhaseId && dto.serviceOrderId) {
      await this.syncActivityForReq(
        req.id, dto.serviceOrderId, dto.templatePhaseId,
        req.titulo, req.numero, req.prioridad, (req as any).agenteId,
      ).catch(() => {});
    }

    // Notificar a todos los agentes de la empresa + al agente asignado en particular
    const agenteId = (req as any).agente?.id as string | undefined;
    this.notifications.broadcastToAgents(
      companyId,
      {
        type: 'ticket',
        title: `Nuevo ticket: ${req.numero}`,
        message: req.titulo,
        entityType: 'requerimiento',
        entityId: req.id,
      },
      this.gateway,
    );

    this.gateway.dashboardUpdate(companyId, { type: 'ticket_created', payload: { id: req.id, numero: req.numero } });

    return req;
  }

  async addGestion(companyId: string, id: string, userId: string, dto: AddGestionDto) {
    const req = await this.prisma.requerimiento.findFirst({
      where: { id, companyId },
      select: { id: true, numero: true },
    });
    if (!req) throw new NotFoundException('Requerimiento no encontrado');

    await this.prisma.$transaction([
      this.prisma.requerimientoGestion.create({
        data: {
          requerimientoId: req.id,
          fecha:       new Date(dto.fecha),
          estado:      dto.estado,
          observacion: dto.observacion,
          changedById: userId,
        },
      }),
      this.prisma.requerimiento.update({
        where: { id: req.id },
        data: {
          estadoActual: dto.estado,
          ...(dto.estado === 'Devuelto' && dto.devueltoPor
            ? { devueltoPor: dto.devueltoPor, devueltoNota: dto.devueltoNota ?? null }
            : {}),
        },
      }),
    ]);

    this.notifications.broadcastToAgents(
      companyId,
      { type: 'ticket', title: `Ticket ${req.numero} → ${dto.estado}`, entityType: 'requerimiento', entityId: req.id },
      this.gateway,
    );
    this.gateway.dashboardUpdate(companyId, { type: 'ticket_status', payload: { id: req.id } });

    return { id: req.id, numero: req.numero, estadoActual: dto.estado };
  }

  async updateRequerimiento(companyId: string, id: string, dto: UpdateRequerimientoDto) {
    const existing = await this.findOne(companyId, id) as any;

    // Determine effective values after update
    const newPhaseId    = dto.templatePhaseId  !== undefined ? (dto.templatePhaseId  || null) : existing.templatePhaseId;
    const newModuleId   = dto.templateModuleId !== undefined ? (dto.templateModuleId || null) : existing.templateModuleId;
    const newServiceOId = dto.serviceOrderId   !== undefined ? (dto.serviceOrderId   || null) : existing.serviceOrderId;

    const phaseChanged = dto.templatePhaseId !== undefined && dto.templatePhaseId !== existing.templatePhaseId;

    // ── Update core fields ──────────────────────────────────────────────────
    const updated = await this.prisma.requerimiento.update({
      where: { id },
      data: {
        ...(dto.titulo            !== undefined && { titulo:           dto.titulo }),
        ...(dto.descripcion       !== undefined && { descripcion:      dto.descripcion }),
        ...(dto.tipo              !== undefined && { tipo:             dto.tipo }),
        ...(dto.prioridad         !== undefined && { prioridad:        dto.prioridad }),
        ...(dto.area              !== undefined && { area:             dto.area }),
        ...(dto.ticketRubi        !== undefined && { ticketRubi:       dto.ticketRubi || null }),
        ...(dto.agenteId          !== undefined && { agenteId:         dto.agenteId }),
        ...(dto.serviceOrderId    !== undefined && { serviceOrderId:   newServiceOId }),
        ...(dto.templateModuleId  !== undefined && { templateModuleId: newModuleId }),
        ...(dto.templatePhaseId   !== undefined && { templatePhaseId:  newPhaseId }),
      },
    });

    // ── Sync activity in plan de trabajo ────────────────────────────────────
    // Delete old activity when phase changed and one existed
    if (phaseChanged && existing.activityId) {
      await this.prisma.activity.delete({ where: { id: existing.activityId } }).catch(() => {});
      await this.prisma.requerimiento.update({ where: { id }, data: { activityId: null } });
    }

    // Create activity when: phase is set + has service order + (phase changed OR no activity yet)
    const needsActivity = newPhaseId && newServiceOId && (phaseChanged || !existing.activityId);
    if (needsActivity) {
      await this.syncActivityForReq(
        id, newServiceOId, newPhaseId,
        existing.titulo, existing.numero, existing.prioridad, existing.agenteId,
      ).catch(() => {});
    }

    // Phase cleared → delete activity if one exists
    if (!newPhaseId && existing.activityId) {
      await this.prisma.activity.delete({ where: { id: existing.activityId } }).catch(() => {});
      await this.prisma.requerimiento.update({ where: { id }, data: { activityId: null } });
    }

    return this.findOne(companyId, id);
  }

  async deleteRequerimiento(companyId: string, id: string) {
    await this.findOne(companyId, id); // verifica que existe y pertenece a la compañía
    await this.prisma.requerimientoGestion.deleteMany({ where: { requerimientoId: id } });
    return this.prisma.requerimiento.delete({ where: { id } });
  }

  async bulkGestion(companyId: string, userId: string, dto: BulkGestionDto) {
    const found = await this.prisma.requerimiento.findMany({
      where: { id: { in: dto.ids }, companyId },
      select: { id: true },
    });
    const validIds  = new Set(found.map(r => r.id));
    const validList   = dto.ids.filter(id => validIds.has(id));
    const invalidList = dto.ids.filter(id => !validIds.has(id));

    if (validList.length > 0) {
      await this.prisma.$transaction([
        this.prisma.requerimientoGestion.createMany({
          data: validList.map(id => ({
            requerimientoId: id,
            fecha:       new Date(dto.fecha),
            estado:      dto.estado,
            observacion: dto.observacion,
            changedById: userId,
          })),
        }),
        this.prisma.requerimiento.updateMany({
          where: { id: { in: validList } },
          data:  { estadoActual: dto.estado },
        }),
      ]);
    }

    if (validList.length > 0) {
      this.notifications.broadcastToAgents(
        companyId,
        { type: 'ticket', title: `${validList.length} ticket(s) actualizados → ${dto.estado}` },
        this.gateway,
      );
      this.gateway.dashboardUpdate(companyId, { type: 'ticket_bulk_status', payload: { count: validList.length } });
    }

    const results = [
      ...validList.map(id => ({ id, success: true })),
      ...invalidList.map(id => ({ id, success: false, error: 'Requerimiento no encontrado' })),
    ];
    return {
      exitosos: validList.length,
      fallidos: invalidList.length,
      resultados: results,
    };
  }

  async bulkGestionIndividual(
    companyId: string,
    userId: string,
    rows: { id: string; fecha: string; estado: string; observacion: string }[],
  ) {
    const found = await this.prisma.requerimiento.findMany({
      where: { id: { in: rows.map(r => r.id) }, companyId },
      select: { id: true, numero: true },
    });
    const reqMap    = new Map<string, typeof found[0]>(found.map(r => [r.id, r]));
    const validRows   = rows.filter(r => reqMap.has(r.id));
    const invalidRows = rows.filter(r => !reqMap.has(r.id));

    if (validRows.length > 0) {
      // Group updates by estado to minimize updateMany calls
      const byEstado = new Map<string, string[]>();
      for (const row of validRows) {
        if (!byEstado.has(row.estado)) byEstado.set(row.estado, []);
        byEstado.get(row.estado)!.push(row.id);
      }

      await Promise.all([
        this.prisma.requerimientoGestion.createMany({
          data: validRows.map(row => ({
            requerimientoId: row.id,
            fecha:       new Date(row.fecha),
            estado:      row.estado,
            observacion: row.observacion,
            changedById: userId,
          })),
        }),
        ...[...byEstado.entries()].map(([estado, ids]) =>
          this.prisma.requerimiento.updateMany({ where: { id: { in: ids } }, data: { estadoActual: estado } }),
        ),
      ]);
    }

    if (validRows.length > 0) {
      this.notifications.broadcastToAgents(
        companyId,
        { type: 'ticket', title: `${validRows.length} ticket(s) priorizados individualmente` },
        this.gateway,
      );
      this.gateway.dashboardUpdate(companyId, { type: 'ticket_bulk_status', payload: { count: validRows.length } });
    }

    const results = [
      ...validRows.map(row => ({ id: row.id, numero: reqMap.get(row.id)!.numero, success: true })),
      ...invalidRows.map(row => ({ id: row.id, success: false, error: 'Requerimiento no encontrado' })),
    ];
    return {
      exitosos: validRows.length,
      fallidos: invalidRows.length,
      resultados: results,
    };
  }

  async createBulk(companyId: string, userId: string, dto: CreateBulkRequerimientosDto) {
    const items = dto.requerimientos;
    const year  = new Date().getFullYear();

    // 1 query para tickets duplicados + 1 query para el contador base — en paralelo
    const incomingTickets = items.map(i => i.ticketRubi).filter(Boolean) as string[];
    const [existingTickets, baseCount] = await Promise.all([
      incomingTickets.length > 0
        ? this.prisma.requerimiento.findMany({
            where: { companyId, ticketRubi: { in: incomingTickets } },
            select: { ticketRubi: true, numero: true },
          })
        : Promise.resolve([]),
      this.prisma.requerimiento.count({ where: { companyId } }),
    ]);

    const ticketConflicts = new Map(existingTickets.map(e => [e.ticketRubi!, e.numero] as [string, string]));
    const seenTickets     = new Set<string>();

    const toInsert: { id: string; numero: string; item: (typeof items)[0]; fila: number }[] = [];
    const results:  { fila: number; titulo: string; numero?: string; error?: string }[]      = [];
    let counter = baseCount;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.ticketRubi) {
        const conflict = ticketConflicts.get(item.ticketRubi);
        if (conflict) {
          results.push({ fila: i + 1, titulo: item.titulo, error: `Ticket Rubi "${item.ticketRubi}" ya existe en ${conflict}` });
          continue;
        }
        if (seenTickets.has(item.ticketRubi)) {
          results.push({ fila: i + 1, titulo: item.titulo, error: `Ticket Rubi "${item.ticketRubi}" duplicado en el archivo` });
          continue;
        }
        seenTickets.add(item.ticketRubi);
      }

      counter++;
      const numero = `REQ-${year}-${String(counter).padStart(3, '0')}`;
      const id     = randomUUID();
      toInsert.push({ id, numero, item, fila: i + 1 });
      results.push({ fila: i + 1, titulo: item.titulo, numero });
    }

    if (toInsert.length > 0) {
      // 1 createMany para todos los requerimientos
      await this.prisma.requerimiento.createMany({
        data: toInsert.map(({ id, numero, item }) => ({
          id, companyId, numero,
          titulo:              item.titulo,
          tipo:                item.tipo       ?? 'Funcional',
          prioridad:           item.prioridad  ?? 'Media',
          descripcion:         item.descripcion,
          criteriosAceptacion: item.criteriosAceptacion,
          templateModuleId:    item.templateModuleId,
          templatePhaseId:     item.templatePhaseId,
          area:                item.area,
          ticketRubi:          item.ticketRubi,
          estadoActual:        'Elaborado',
          clientId:            item.clientId,
          serviceOrderId:      item.serviceOrderId,
          agenteId:            item.agenteId,
          createdById:         userId,
        })),
      });

      // 1 createMany para todas las gestiones iniciales
      await this.prisma.requerimientoGestion.createMany({
        data: toInsert.map(({ id }) => ({
          requerimientoId: id,
          fecha:           new Date(),
          estado:          'Elaborado',
          observacion:     'Requerimiento registrado',
          changedById:     userId,
        })),
      });
    }

    return {
      exitosos:   toInsert.length,
      fallidos:   results.filter(r => r.error).length,
      resultados: results,
    };
  }

  private nextWeekRange(): string {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const today = new Date();
    const dow = today.getDay(); // 0=Dom
    const daysToMonday = dow === 0 ? 1 : 8 - dow;
    const lunes = new Date(today);
    lunes.setDate(today.getDate() + daysToMonday);
    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    const startDay = lunes.getDate();
    const endDay   = sabado.getDate();
    const startMes = MESES[lunes.getMonth()];
    const endMes   = MESES[sabado.getMonth()];
    const year     = sabado.getFullYear();
    const rango = startMes === endMes
      ? `${startDay}-${endDay} ${startMes} ${year}`
      : `${startDay} ${startMes} - ${endDay} ${endMes} ${year}`;
    return `Tickets a priorizar semana ${rango}`;
  }

  async enviarCorreo(companyId: string, dto: EnviarCorreoRequerimientosDto) {
    const where: any = { companyId };
    if (dto.clientId)                              where.clientId     = dto.clientId;
    if (dto.agenteId)                              where.agenteId     = dto.agenteId;
    if (dto.area)                                  where.area         = dto.area;
    if (dto.prioridad)                             where.prioridad    = dto.prioridad;
    if (dto.estadosActual?.length)                 where.estadoActual = { in: dto.estadosActual };

    const reqs = await this.prisma.requerimiento.findMany({
      where,
      include: {
        client:         { select: { businessName: true } },
        agente:         { select: { firstName: true, lastName: true } },
        templateModule: { select: { name: true } },
        gestiones:      { select: { observacion: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    });

    const PRIO_COLOR: Record<string, string> = {
      Crítico: '#dc2626', Alta: '#f97316', Media: '#eab308', Baja: '#22c55e',
    };
    const EST_COLOR: Record<string, string> = {
      Elaborado: '#60a5fa', Priorizado: '#a78bfa', Devuelto: '#fb923c',
      Negado: '#f87171', Repriorizado: '#fbbf24', Entregado: '#34d399',
    };

    const rows = reqs.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td style="padding:10px 12px;font-family:monospace;font-size:12px;font-weight:700;color:#dc2626;white-space:nowrap">${r.ticketRubi || '—'}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1e293b;max-width:220px">${r.titulo}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569;max-width:200px">${r.gestiones[0]?.observacion ?? '—'}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${r.client?.businessName ?? '—'}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${r.templateModule ? r.templateModule.name : '—'}</td>
        <td style="padding:10px 12px;font-size:12px;color:#475569">${r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : '—'}</td>
        <td style="padding:10px 12px">
          <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${PRIO_COLOR[r.prioridad] ?? '#94a3b8'}20;color:${PRIO_COLOR[r.prioridad] ?? '#94a3b8'}">
            ${r.prioridad}
          </span>
        </td>
        <td style="padding:10px 12px">
          <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${EST_COLOR[r.estadoActual] ?? '#94a3b8'}20;color:${EST_COLOR[r.estadoActual] ?? '#94a3b8'}">
            ${r.estadoActual}
          </span>
        </td>
      </tr>`).join('');

    const filtersApplied = [
      dto.prioridad && `Prioridad: <strong>${dto.prioridad}</strong>`,
      dto.estadosActual?.length && `Estado: <strong>${dto.estadosActual.join(', ')}</strong>`,
      dto.area && `Área: <strong>${dto.area}</strong>`,
    ].filter(Boolean).join(' · ');

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b;margin:0 0 4px">Requerimientos — Priorización</h2>
      <p style="color:#64748b;margin:0 0 20px;font-size:14px">
        ${reqs.length} requerimiento${reqs.length !== 1 ? 's' : ''} exportados
        ${filtersApplied ? ` · ${filtersApplied}` : ''}
      </p>
      ${dto.mensaje ? `<div style="background:#f1f5f9;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin-bottom:20px;font-size:14px;color:#334155">${dto.mensaje}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1e293b">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Ticket Rubi</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Requerimiento</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Observación</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Cliente</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Módulo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Agente</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Prioridad</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#94a3b8">Generado el ${new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })} · AURA</p>
    </div>`;

    const asunto = dto.asunto || this.nextWeekRange();
    await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html);
    return { enviados: reqs.length, destinatarios: dto.destinatarios.length };
  }

  async getAnalytics(companyId: string, filters: { clientId?: string; agenteId?: string; area?: string; tipo?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { companyId };
    if (filters.clientId)  where.clientId  = filters.clientId;
    if (filters.agenteId)  where.agenteId  = filters.agenteId;
    if (filters.area)      where.area      = filters.area;
    if (filters.tipo)      where.tipo      = filters.tipo;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59');
    }

    const all = await this.prisma.requerimiento.findMany({
      where,
      select: {
        id: true, estadoActual: true, prioridad: true, area: true, tipo: true,
        createdAt: true, devueltoPor: true, ticketRubi: true,
        client:         { select: { id: true, businessName: true } },
        agente:         { select: { id: true, firstName: true, lastName: true } },
        templateModule: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const total = all.length;

    // Helper group count
    const groupCount = (arr: any[], key: string) =>
      arr.reduce((acc: Record<string, number>, item) => {
        const v = item[key] ?? 'Sin definir';
        acc[v] = (acc[v] ?? 0) + 1;
        return acc;
      }, {});

    const byEstado    = groupCount(all, 'estadoActual');
    const byPrioridad = groupCount(all, 'prioridad');
    const byArea      = (Object.entries(groupCount(all, 'area')) as [string, number][]).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);
    const byTipo      = (Object.entries(groupCount(all, 'tipo')) as [string, number][]).map(([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count);

    const byModuloMap: Record<string, number> = {};
    all.forEach(r => {
      const name = r.templateModule?.name ?? 'Sin módulo';
      byModuloMap[name] = (byModuloMap[name] ?? 0) + 1;
    });
    const byModulo = Object.entries(byModuloMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    const byClienteMap: Record<string, { name: string; count: number; entregados: number; devueltos: number }> = {};
    all.forEach(r => {
      const name = r.client?.businessName ?? 'Sin cliente';
      if (!byClienteMap[name]) byClienteMap[name] = { name, count: 0, entregados: 0, devueltos: 0 };
      byClienteMap[name].count++;
      if (r.estadoActual === 'Entregado') byClienteMap[name].entregados++;
      if (r.estadoActual === 'Devuelto')  byClienteMap[name].devueltos++;
    });
    const byCliente = Object.values(byClienteMap).sort((a, b) => b.count - a.count).slice(0, 10);

    const byAgenteMap: Record<string, { name: string; count: number; entregados: number; devueltos: number; negados: number }> = {};
    all.forEach(r => {
      const name = `${r.agente.firstName} ${r.agente.lastName}`;
      if (!byAgenteMap[name]) byAgenteMap[name] = { name, count: 0, entregados: 0, devueltos: 0, negados: 0 };
      byAgenteMap[name].count++;
      if (r.estadoActual === 'Entregado') byAgenteMap[name].entregados++;
      if (r.estadoActual === 'Devuelto')  byAgenteMap[name].devueltos++;
      if (r.estadoActual === 'Negado')    byAgenteMap[name].negados++;
    });
    const byAgente = Object.values(byAgenteMap).sort((a, b) => b.count - a.count);

    // Evolución mensual
    const byMonthMap: Record<string, { month: string; created: number; entregados: number; devueltos: number }> = {};
    all.forEach(r => {
      const month = r.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonthMap[month]) byMonthMap[month] = { month, created: 0, entregados: 0, devueltos: 0 };
      byMonthMap[month].created++;
      if (r.estadoActual === 'Entregado') byMonthMap[month].entregados++;
      if (r.estadoActual === 'Devuelto')  byMonthMap[month].devueltos++;
    });
    const byMonth = Object.values(byMonthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Atribución devoluciones
    const devueltoPorBreakdown = {
      cliente:    all.filter(r => r.devueltoPor === 'cliente').length,
      desarrollo: all.filter(r => r.devueltoPor === 'desarrollo').length,
      sinAtribuir: all.filter(r => r.estadoActual === 'Devuelto' && !r.devueltoPor).length,
    };

    // Tasas
    const entregados         = byEstado['Entregado'] ?? 0;
    const totalDevueltos     = byEstado['Devuelto']  ?? 0;
    const negados            = byEstado['Negado']    ?? 0;
    const elaborados         = byEstado['Elaborado'] ?? 0;
    const altaPrioSinEntregar = all.filter(r => r.prioridad === 'Alta' && r.estadoActual !== 'Entregado').length;

    const tasas = {
      entrega:    total > 0 ? Math.round((entregados / total) * 100) : 0,
      devolucion: total > 0 ? Math.round((totalDevueltos / total) * 100) : 0,
      negacion:   total > 0 ? Math.round((negados / total) * 100) : 0,
      repriorizado: total > 0 ? Math.round(((byEstado['Repriorizado'] ?? 0) / total) * 100) : 0,
    };

    // Alertas
    const alerts: { level: 'critico' | 'advertencia' | 'info'; titulo: string; detalle: string }[] = [];

    if (altaPrioSinEntregar > 0) {
      alerts.push({ level: 'critico', titulo: `${altaPrioSinEntregar} requerimiento${altaPrioSinEntregar !== 1 ? 's' : ''} de alta prioridad sin entregar`,
        detalle: 'Estos requerimientos requieren atención inmediata para no comprometer la implementación.' });
    }
    if (elaborados > 0) {
      alerts.push({ level: tasas.devolucion > 25 ? 'critico' : 'advertencia',
        titulo: `${elaborados} requerimiento${elaborados !== 1 ? 's' : ''} en estado Elaborado sin priorizar`,
        detalle: 'Están registrados pero no han pasado por el proceso de priorización.' });
    }
    if (tasas.devolucion > 25) {
      alerts.push({ level: 'critico', titulo: `Tasa de devolución alta: ${tasas.devolucion}%`,
        detalle: 'Más de un cuarto de los requerimientos han sido devueltos. Revisar la calidad de las especificaciones.' });
    } else if (tasas.devolucion > 10) {
      alerts.push({ level: 'advertencia', titulo: `Tasa de devolución moderada: ${tasas.devolucion}%`,
        detalle: 'Hay oportunidad de mejorar la calidad de los requerimientos antes de priorizarlos.' });
    }
    if (tasas.negacion > 15) {
      alerts.push({ level: 'advertencia', titulo: `Tasa de negación alta: ${tasas.negacion}%`,
        detalle: `${negados} requerimientos han sido negados. Validar criterios de aceptación con el cliente.` });
    }
    if (devueltoPorBreakdown.sinAtribuir > 0) {
      alerts.push({ level: 'info', titulo: `${devueltoPorBreakdown.sinAtribuir} devolución${devueltoPorBreakdown.sinAtribuir !== 1 ? 'es' : ''} sin responsable atribuido`,
        detalle: 'Al registrar devoluciones, indica si fue por el cliente o por desarrollo para mejorar la trazabilidad.' });
    }
    if (byArea.length > 0 && byArea[0].count / total > 0.5 && total > 5) {
      alerts.push({ level: 'info', titulo: `Alta concentración en área "${byArea[0].area}"`,
        detalle: `El ${Math.round((byArea[0].count / total) * 100)}% de los requerimientos pertenecen a una sola área.` });
    }
    if (alerts.length === 0) {
      alerts.push({ level: 'info', titulo: 'Sin alertas críticas', detalle: 'Los requerimientos están en buen estado operativo.' });
    }

    // Áreas únicas y tipos únicos (para filtros)
    const areas  = [...new Set(all.map(r => r.area).filter(Boolean))].sort();
    const tipos  = [...new Set(all.map(r => r.tipo).filter(Boolean))].sort();

    return {
      total, byEstado, byPrioridad, byArea, byTipo, byModulo,
      byCliente, byAgente, byMonth, devueltoPorBreakdown, tasas, alerts,
      altaPrioSinEntregar, elaboradosSinPriorizar: elaborados,
      totalDevueltos, negados, entregados,
      areas, tipos,
    };
  }

  private async syncActivityForReq(
    reqId: string,
    serviceOrderId: string,
    templatePhaseId: string,
    titulo: string,
    numero: string,
    prioridad: string,
    agenteId?: string | null,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { serviceOrderId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { phases: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!project) return;

    const tPhase = await this.prisma.templatePhase.findUnique({
      where: { id: templatePhaseId },
      include: { templateModule: { select: { name: true } } },
    });
    if (!tPhase) return;

    let targetPhaseId: string | null = null;
    for (const pMod of project.modules) {
      const nameMatch = pMod.name.toLowerCase() === tPhase.templateModule?.name?.toLowerCase();
      if (!nameMatch) continue;
      const ph = pMod.phases.find(p => p.name.toLowerCase() === tPhase.name.toLowerCase());
      if (ph) { targetPhaseId = ph.id; break; }
    }
    if (!targetPhaseId) {
      for (const pMod of project.modules) {
        const ph = pMod.phases.find(p => p.name.toLowerCase() === tPhase.name.toLowerCase());
        if (ph) { targetPhaseId = ph.id; break; }
      }
    }
    if (!targetPhaseId) return;

    const actCount = await this.prisma.activity.count({ where: { phaseId: targetPhaseId } });
    const nextOrder = actCount + 1;
    const code = `REQ-${String(nextOrder).padStart(3, '0')}`;
    const prioMap: Record<string, string> = { Crítico: 'critica', Alta: 'alta', Media: 'media', Baja: 'baja' };

    const activity = await this.prisma.activity.create({
      data: {
        phaseId:      targetPhaseId,
        code,
        name:         `[REQ] ${titulo}`,
        description:  `Requerimiento ${numero}`,
        priority:     prioMap[prioridad] ?? 'media',
        status:       'pendiente',
        order:        nextOrder,
        plannedHours: 0,
        ...(agenteId && { assignedToId: agenteId }),
      },
    });

    await this.prisma.requerimiento.update({ where: { id: reqId }, data: { activityId: activity.id } });
  }
}
