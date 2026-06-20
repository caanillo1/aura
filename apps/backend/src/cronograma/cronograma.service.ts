import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBloqueDto, UpdateBloqueDto, BloqueFilterDto } from './dto/cronograma.dto';

@Injectable()
export class CronogramaService {
  constructor(private prisma: PrismaService) {}

  private bloqueSelect = {
    id: true, titulo: true, fecha: true, horaInicio: true, horaFin: true,
    color: true, status: true, notas: true, actaId: true, tipoActa: true, createdAt: true,
    agente: { select: { id: true, firstName: true, lastName: true } },
    client: { select: { id: true, businessName: true } },
    serviceOrder: { select: { id: true, osNumber: true, product: true, project: { select: { id: true } } } },
  };

  async findAll(companyId: string, filters: BloqueFilterDto) {
    return this.prisma.cronogramaBloque.findMany({
      where: {
        companyId,
        ...(filters.agenteId && { agenteId: filters.agenteId }),
        ...(filters.clientId && { clientId: filters.clientId }),
        ...(filters.fechaDesde || filters.fechaHasta ? {
          fecha: {
            ...(filters.fechaDesde && { gte: new Date(filters.fechaDesde) }),
            ...(filters.fechaHasta && { lte: new Date(filters.fechaHasta) }),
          },
        } : {}),
      },
      select: this.bloqueSelect,
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    const b = await this.prisma.cronogramaBloque.findFirst({ where: { id, companyId }, select: this.bloqueSelect });
    if (!b) throw new NotFoundException('Bloque no encontrado');
    return b;
  }

  async create(companyId: string, userId: string, dto: CreateBloqueDto) {
    await this.checkOverlap(companyId, dto.agenteId, dto.fecha, dto.horaInicio, dto.horaFin);
    return this.prisma.cronogramaBloque.create({
      data: {
        titulo: dto.titulo,
        fecha: new Date(dto.fecha), horaInicio: dto.horaInicio, horaFin: dto.horaFin,
        color: dto.color ?? '#2563EB',
        notas:    dto.notas    ?? null,
        tipoActa: dto.tipoActa ?? null,
        company:      { connect: { id: companyId } },
        agente:       { connect: { id: dto.agenteId } },
        createdBy:    { connect: { id: userId } },
        client:       dto.clientId       ? { connect: { id: dto.clientId } }       : undefined,
        serviceOrder: dto.serviceOrderId ? { connect: { id: dto.serviceOrderId } } : undefined,
      },
      select: this.bloqueSelect,
    });
  }

  async update(companyId: string, id: string, dto: UpdateBloqueDto) {
    const existing = await this.findOne(companyId, id);
    if (dto.agenteId || dto.fecha || dto.horaInicio || dto.horaFin) {
      await this.checkOverlap(
        companyId,
        dto.agenteId ?? existing.agente.id,
        dto.fecha    ?? (existing.fecha as unknown as string),
        dto.horaInicio ?? existing.horaInicio,
        dto.horaFin    ?? existing.horaFin,
        id,
      );
    }
    return this.prisma.cronogramaBloque.update({
      where: { id },
      data: {
        ...(dto.titulo      !== undefined && { titulo: dto.titulo }),
        ...(dto.fecha       !== undefined && { fecha: new Date(dto.fecha) }),
        ...(dto.horaInicio  !== undefined && { horaInicio: dto.horaInicio }),
        ...(dto.horaFin     !== undefined && { horaFin: dto.horaFin }),
        ...(dto.agenteId    !== undefined && { agenteId: dto.agenteId }),
        ...(dto.clientId    !== undefined && { clientId: dto.clientId }),
        ...(dto.serviceOrderId !== undefined && { serviceOrderId: dto.serviceOrderId }),
        ...(dto.notas       !== undefined && { notas: dto.notas }),
        ...(dto.color       !== undefined && { color: dto.color }),
        ...(dto.status      !== undefined && { status: dto.status }),
        ...(dto.actaId      !== undefined && { actaId: dto.actaId }),
        ...(dto.tipoActa    !== undefined && { tipoActa: dto.tipoActa }),
      },
      select: this.bloqueSelect,
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.cronogramaBloque.delete({ where: { id } });
    return { ok: true };
  }

  private toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

  private async checkOverlap(
    companyId: string, agenteId: string,
    fecha: string | Date, inicio: string, fin: string,
    excludeId?: string,
  ) {
    const startMin = this.toMin(inicio);
    const endMin   = this.toMin(fin);
    const fechaDate = new Date(fecha);
    const bloques = await this.prisma.cronogramaBloque.findMany({
      where: { companyId, agenteId, fecha: fechaDate, ...(excludeId && { id: { not: excludeId } }) },
      select: { horaInicio: true, horaFin: true, titulo: true },
    });
    for (const b of bloques) {
      const bStart = this.toMin(b.horaInicio);
      const bEnd   = this.toMin(b.horaFin);
      if (startMin < bEnd && endMin > bStart) {
        throw new BadRequestException(`El agente ya tiene un bloque "${b.titulo}" de ${b.horaInicio} a ${b.horaFin}`);
      }
    }
  }
}
