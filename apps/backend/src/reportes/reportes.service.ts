import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReporteOrdenesDto, ReporteProyectosDto,
  ReporteCapacitacionesDto, ReporteRequerimientosDto,
} from './dto/reporte.dto';

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  async reporteOrdenes(companyId: string, dto: ReporteOrdenesDto) {
    const where: any = { companyId };
    if (dto.estado)   where.status   = dto.estado;
    if (dto.clientId) where.clientId = dto.clientId;
    if (dto.fechaDesde || dto.fechaHasta) {
      where.startDate = {};
      if (dto.fechaDesde) where.startDate.gte = new Date(dto.fechaDesde);
      if (dto.fechaHasta) where.startDate.lte = new Date(dto.fechaHasta + 'T23:59:59.999Z');
    }
    return this.prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client:         { select: { businessName: true, nit: true } },
        clinicalLeader: { select: { firstName: true, lastName: true } },
        financialLeader:{ select: { firstName: true, lastName: true } },
        implementers:   { include: { user: { select: { firstName: true, lastName: true } } } },
        project:        { select: { status: true, progressPercent: true } },
      },
    });
  }

  async reporteProyectos(companyId: string, dto: ReporteProyectosDto) {
    const where: any = { serviceOrder: { companyId } };
    if (dto.status)   where.status = dto.status;
    if (dto.clientId) where.serviceOrder = { companyId, clientId: dto.clientId };
    return this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        serviceOrder: {
          select: {
            osNumber: true, product: true, startDate: true, endDate: true,
            client: { select: { businessName: true, nit: true } },
          },
        },
        modules: {
          select: {
            id: true, progressPercent: true,
            phases: {
              select: {
                activities: { select: { id: true, status: true } },
              },
            },
          },
        },
      },
    });
  }

  async reporteCapacitaciones(companyId: string, dto: ReporteCapacitacionesDto) {
    const soWhere: any = { companyId };
    if (dto.clientId)      soWhere.clientId = dto.clientId;
    if (dto.serviceOrderId) soWhere.id      = dto.serviceOrderId;
    return this.prisma.acta.findMany({
      where: {
        type: 'capacitacion',
        project: { serviceOrder: soWhere },
      },
      orderBy: { fecha: 'desc' },
      include: {
        firmantes: { orderBy: { orden: 'asc' } },
        modulo:    { select: { name: true } },
        project: {
          include: {
            serviceOrder: {
              select: {
                osNumber: true, product: true,
                client: { select: { businessName: true } },
              },
            },
          },
        },
      },
    });
  }

  async reporteRequerimientos(companyId: string, dto: ReporteRequerimientosDto) {
    const where: any = { companyId };
    if (dto.estadoActual)   where.estadoActual   = dto.estadoActual;
    if (dto.prioridad)      where.prioridad      = dto.prioridad;
    if (dto.area)           where.area           = dto.area;
    if (dto.clientId)       where.clientId       = dto.clientId;
    if (dto.serviceOrderId) where.serviceOrderId = dto.serviceOrderId;
    if (dto.fechaDesde || dto.fechaHasta) {
      where.createdAt = {};
      if (dto.fechaDesde) where.createdAt.gte = new Date(dto.fechaDesde);
      if (dto.fechaHasta) where.createdAt.lte = new Date(dto.fechaHasta + 'T23:59:59.999Z');
    }
    return this.prisma.requerimiento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client:        { select: { businessName: true } },
        serviceOrder:  { select: { osNumber: true } },
        agente:        { select: { firstName: true, lastName: true } },
        templateModule:{ select: { name: true } },
        templatePhase: { select: { name: true } },
        _count:        { select: { gestiones: true } },
      },
    });
  }
}
