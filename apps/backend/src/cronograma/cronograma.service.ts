import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateBloqueDto, UpdateBloqueDto, BloqueFilterDto, RespondVisitDto } from './dto/cronograma.dto';

@Injectable()
export class CronogramaService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private jwtService: JwtService,
  ) {}

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
        ...(filters.tipoActa && { tipoActa: filters.tipoActa }),
        ...(filters.status   && { status:   filters.status   }),
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
    const bloque = await this.prisma.cronogramaBloque.create({
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
    this.sendVisitEmail(companyId, bloque).catch(() => {}); // no bloquear respuesta
    return bloque;
  }

  private async sendVisitEmail(companyId: string, bloque: any) {
    const agente = await this.prisma.user.findUnique({
      where: { id: bloque.agente.id },
      select: { email: true, firstName: true },
    });
    if (!agente?.email) return;

    const payload = {
      bloqueId: bloque.id, companyId,
      nombre: agente.firstName,
      titulo: bloque.titulo,
      fecha: bloque.fecha,
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
      clienteNombre: bloque.client?.businessName ?? null,
    };
    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    const frontUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const acceptUrl = `${frontUrl}/cronograma/responder?token=${token}&action=accept`;
    const cancelUrl = `${frontUrl}/cronograma/responder?token=${token}&action=cancel`;

    const fechaFmt = dayjs(bloque.fecha).format('DD/MM/YYYY');
    const clienteNombre = bloque.client?.businessName ?? 'Sin cliente';
    const soInfo = bloque.serviceOrder ? `OS ${bloque.serviceOrder.osNumber} — ${bloque.serviceOrder.product}` : '';

    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 28px">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">Nueva visita programada</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#93c5fd">Tienes una cita agendada en el cronograma</p>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1">Hola <strong style="color:#e2e8f0">${agente.firstName}</strong>,</p>
    <div style="background:#0f2040;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;width:120px">Actividad</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#e2e8f0">${bloque.titulo}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Fecha</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${fechaFmt}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Horario</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${bloque.horaInicio} – ${bloque.horaFin}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Cliente</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${clienteNombre}</td></tr>
        ${soInfo ? `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Orden</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${soInfo}</td></tr>` : ''}
      </table>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8">Por favor confirma tu disponibilidad para esta visita:</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">✓ Confirmar visita</a>
      <a href="${cancelUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">✗ Cancelar visita</a>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#475569">Este enlace expira en 7 días. Si no reconoces esta solicitud, ignora este correo.</p>
  </div>
</div>`;

    await this.mail.sendFromCompany(companyId, [agente.email], `Visita agendada: ${bloque.titulo} — ${fechaFmt}`, html);
  }

  async respondToVisit(dto: RespondVisitDto) {
    let payload: { bloqueId: string; companyId: string };
    try {
      payload = this.jwtService.verify(dto.token) as { bloqueId: string; companyId: string };
    } catch {
      throw new BadRequestException('El enlace ha expirado o no es válido.');
    }

    const bloque = await this.prisma.cronogramaBloque.findFirst({
      where: { id: payload.bloqueId, companyId: payload.companyId },
      select: { id: true, status: true, titulo: true },
    });
    if (!bloque) throw new NotFoundException('Bloque no encontrado.');

    if (dto.action === 'accept') {
      await this.prisma.cronogramaBloque.update({
        where: { id: bloque.id },
        data: { status: 'programado' },
      });
      return { ok: true, message: 'Visita confirmada. ¡Hasta pronto!' };
    }

    // cancel
    const notas = dto.motivo
      ? `Cancelado por el agente. Motivo: ${dto.motivo}`
      : 'Cancelado por el agente.';
    await this.prisma.cronogramaBloque.update({
      where: { id: bloque.id },
      data: { status: 'cancelado', notas },
    });
    return { ok: true, message: 'Visita cancelada y registrada en el sistema.' };
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
