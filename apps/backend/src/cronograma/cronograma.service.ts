import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { EventsGateway } from '../gateway/events.gateway';
import { CreateBloqueDto, UpdateBloqueDto, BloqueFilterDto, RespondVisitDto } from './dto/cronograma.dto';

@Injectable()
export class CronogramaService {
  private readonly logger = new Logger(CronogramaService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private jwtService: JwtService,
    private gateway: EventsGateway,
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
    this.sendVisitEmail(companyId, bloque).catch(err =>
      this.logger.error(`Error enviando correo de visita (create) bloqueId=${bloque.id}: ${err?.message}`),
    );
    return bloque;
  }

  /** Genera el contenido de un archivo .ics para agregar al calendario nativo */
  private buildIcs(bloque: any, acceptUrl: string, cancelUrl: string): Buffer {
    const fecha = (bloque.fecha as string).substring(0, 10).replace(/-/g, ''); // YYYYMMDD
    const dtStart = `${fecha}T${bloque.horaInicio.replace(':', '')}00`;
    const dtEnd   = `${fecha}T${bloque.horaFin.replace(':', '')}00`;
    const dtstamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
    const desc = `Confirmar visita: ${acceptUrl}\\nCancelar visita: ${cancelUrl}`;
    const titulo = (bloque.titulo as string).replace(/[,;\\]/g, ' ');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AURA ERP//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${bloque.id}@aura-erp`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=America/Bogota:${dtStart}`,
      `DTEND;TZID=America/Bogota:${dtEnd}`,
      `SUMMARY:${titulo}`,
      `DESCRIPTION:${desc}`,
      'STATUS:TENTATIVE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio: ${titulo}`,
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return Buffer.from(ics, 'utf-8');
  }

  private async sendVisitEmail(companyId: string, bloque: any) {
    if (!bloque.serviceOrder?.id) return; // sin OS no hay líder de cliente

    // Obtener líder de cliente de la OS
    const so = await this.prisma.serviceOrder.findUnique({
      where: { id: bloque.serviceOrder.id },
      select: {
        clientLeader: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const lider = so?.clientLeader;
    if (!lider?.email) return;

    const payload = {
      bloqueId: bloque.id, companyId,
      nombre: lider.firstName,
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
    const clienteNombre = bloque.client?.businessName ?? '';
    const soInfo = bloque.serviceOrder ? `OS ${bloque.serviceOrder.osNumber} — ${bloque.serviceOrder.product}` : '';

    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 28px">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">Visita programada — confirmación requerida</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#93c5fd">Se ha agendado una visita en su empresa</p>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1">Estimado/a <strong style="color:#e2e8f0">${lider.firstName} ${lider.lastName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8">Le informamos que se ha programado una visita de nuestro equipo. Le pedimos confirmar o cancelar esta cita:</p>
    <div style="background:#0f2040;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;width:120px">Actividad</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#e2e8f0">${bloque.titulo}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Fecha</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${fechaFmt}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Horario</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${bloque.horaInicio} – ${bloque.horaFin}</td></tr>
        ${clienteNombre ? `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Empresa</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${clienteNombre}</td></tr>` : ''}
        ${soInfo ? `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Orden</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${soInfo}</td></tr>` : ''}
      </table>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8">Al hacer clic en cualquiera de los botones, se le pedirá validar su número de documento de identidad:</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">✓ Confirmar visita</a>
      <a href="${cancelUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">✗ Cancelar visita</a>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#475569">Este enlace expira en 7 días. Si no esperaba esta visita, puede ignorar este correo o cancelarla.</p>
  </div>
</div>`;

    const icsBuffer = this.buildIcs(bloque, acceptUrl, cancelUrl);
    await this.mail.sendFromCompany(
      companyId, [lider.email],
      `Visita programada — ${fechaFmt}: ${bloque.titulo}`,
      html,
      [{ filename: 'visita.ics', content: icsBuffer, contentType: 'text/calendar' }],
    );
  }

  private async notifyAgent(companyId: string, bloque: any, tipo: 'confirm' | 'cancel', motivo?: string) {
    const agente = await this.prisma.user.findUnique({
      where: { id: bloque.agenteId },
      select: { email: true, firstName: true },
    });
    if (!agente?.email) return;

    const fechaFmt = dayjs(bloque.fecha).format('DD/MM/YYYY');

    if (tipo === 'confirm') {
      const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#14532d,#16a34a);padding:32px 28px">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">Visita confirmada por el cliente</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#86efac">El líder de cliente confirmó la visita</p>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1">Hola <strong style="color:#e2e8f0">${agente.firstName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8">El cliente ha <strong style="color:#4ade80">confirmado</strong> la siguiente visita:</p>
    <div style="background:#0f2040;border:1px solid #14532d;border-radius:12px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;width:120px">Actividad</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#e2e8f0">${bloque.titulo}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Fecha</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${fechaFmt}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Horario</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${bloque.horaInicio} – ${bloque.horaFin}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#64748b">La visita está confirmada. Recuerda estar preparado/a para la fecha acordada.</p>
  </div>
</div>`;
      await this.mail.sendFromCompany(companyId, [agente.email], `Visita confirmada por cliente — ${fechaFmt}: ${bloque.titulo}`, html);
      return;
    }

    // cancel
    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:32px 28px">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">Visita cancelada por el cliente</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#fca5a5">El cliente canceló la siguiente visita</p>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1">Hola <strong style="color:#e2e8f0">${agente.firstName}</strong>,</p>
    <div style="background:#0f2040;border:1px solid #7f1d1d;border-radius:12px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;width:140px">Actividad</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#e2e8f0">${bloque.titulo}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Fecha</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${fechaFmt}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">Horario</td><td style="padding:6px 0;font-size:14px;color:#e2e8f0">${bloque.horaInicio} – ${bloque.horaFin}</td></tr>
        ${motivo ? `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px;vertical-align:top">Motivo</td><td style="padding:6px 0;font-size:14px;color:#fca5a5">${motivo}</td></tr>` : ''}
      </table>
    </div>
    <p style="font-size:13px;color:#64748b">Coordina con el cliente una nueva fecha. El estado fue actualizado a <strong style="color:#fca5a5">Cancelado</strong> en el cronograma.</p>
  </div>
</div>`;
    await this.mail.sendFromCompany(companyId, [agente.email], `Visita cancelada por cliente — ${fechaFmt}: ${bloque.titulo}`, html);
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
      select: {
        id: true, status: true, titulo: true, fecha: true, horaInicio: true, horaFin: true,
        agenteId: true, createdById: true, serviceOrderId: true,
      },
    });
    if (!bloque) throw new NotFoundException('Bloque no encontrado.');

    const razonBase = `Visita "${bloque.titulo}" del ${dayjs(bloque.fecha).format('DD/MM/YYYY')} ${bloque.horaInicio}–${bloque.horaFin}`;

    // ── Confirmar ────────────────────────────────────────────────────────────
    if (dto.action === 'accept') {
      await this.prisma.cronogramaBloque.update({
        where: { id: bloque.id },
        data: { status: 'programado' },
      });

      if (bloque.serviceOrderId) {
        await this.prisma.serviceOrderHistory.create({
          data: {
            serviceOrderId: bloque.serviceOrderId,
            changedById: bloque.createdById,
            fieldName: 'visita_confirmada',
            oldValue: bloque.status,
            newValue: 'programado',
            reason: `${razonBase} — Confirmada por el cliente`,
            noteType: 'nota',
            noteLevel: 'info',
          },
        }).catch(() => {});
      }

      this.notifyAgent(payload.companyId, bloque, 'confirm').catch(() => {});
      this.pushVisitNotification(bloque.agenteId, 'visita_confirmada',
        'Visita confirmada por el cliente',
        `El cliente confirmó la visita "${bloque.titulo}" del ${dayjs(bloque.fecha).format('DD/MM/YYYY')} ${bloque.horaInicio}–${bloque.horaFin}`,
        bloque.id,
      );
      return { ok: true, message: '¡Visita confirmada! Nuestro equipo estará listo para la fecha acordada.' };
    }

    // ── Cancelar ─────────────────────────────────────────────────────────────
    const motivoTexto = dto.motivo?.trim() || 'Sin motivo especificado';
    const notas = `Cancelado por el cliente. Motivo: ${motivoTexto}`;

    await this.prisma.cronogramaBloque.update({
      where: { id: bloque.id },
      data: { status: 'cancelado', notas },
    });

    if (bloque.serviceOrderId) {
      await this.prisma.serviceOrderHistory.create({
        data: {
          serviceOrderId: bloque.serviceOrderId,
          changedById: bloque.createdById,
          fieldName: 'visita_cancelada',
          oldValue: bloque.status,
          newValue: 'cancelado',
          reason: `${razonBase} — Cancelada por el cliente. Motivo: ${motivoTexto}`,
          noteType: 'nota',
          noteLevel: 'alerta',
        },
      }).catch(() => {});
    }

    this.notifyAgent(payload.companyId, bloque, 'cancel', motivoTexto).catch(() => {});
    this.pushVisitNotification(bloque.agenteId, 'visita_cancelada',
      'Visita cancelada por el cliente',
      `El cliente canceló la visita "${bloque.titulo}" del ${dayjs(bloque.fecha).format('DD/MM/YYYY')}. Motivo: ${motivoTexto}`,
      bloque.id,
    );
    return { ok: true, message: 'Visita cancelada y registrada. El equipo será notificado.' };
  }

  private pushVisitNotification(
    userId: string, type: string, title: string, message: string, bloqueId: string,
  ): void {
    this.prisma.notification.create({
      data: { userId, type, title, message, entityType: 'bloque', entityId: bloqueId },
    }).then(notif => {
      this.gateway.emitToUser(userId, 'notification:new', notif);
    }).catch(() => {});
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
    const bloque = await this.prisma.cronogramaBloque.update({
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
    // Enviar correo si se acaba de asignar una OS que antes no tenía
    const osAnterior = (existing.serviceOrder as any)?.id ?? null;
    const osNueva    = (bloque.serviceOrder as any)?.id ?? null;
    if (osNueva && osNueva !== osAnterior) {
      this.sendVisitEmail(companyId, bloque).catch(err =>
        this.logger.error(`Error enviando correo de visita (update) bloqueId=${bloque.id}: ${err?.message}`),
      );
    }
    return bloque;
  }

  async resendInvite(companyId: string, id: string): Promise<{ message: string }> {
    const bloque = await this.prisma.cronogramaBloque.findFirst({
      where: { id, companyId },
      select: this.bloqueSelect,
    });
    if (!bloque) throw new NotFoundException('Bloque no encontrado');
    if (!(bloque.serviceOrder as any)?.id) throw new BadRequestException('El bloque no tiene una OS asignada');
    await this.sendVisitEmail(companyId, bloque);
    return { message: 'Invitación reenviada correctamente' };
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
