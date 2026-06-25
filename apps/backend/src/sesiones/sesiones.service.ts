import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateSesionDto, UpdateSesionDto, EntrarSalaDto } from './dto/sesion.dto';

@Injectable()
export class SesionesService {
  private readonly logger = new Logger(SesionesService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // ── CRUD autenticado ─────────────────────────────────────────────────────────

  async create(dto: CreateSesionDto, userId: string) {
    const salaToken = randomBytes(24).toString('hex');

    const sesion = await this.prisma.sesionCapacitacion.create({
      data: {
        projectId:  dto.projectId,
        companyId:  dto.companyId,
        titulo:     dto.titulo,
        fecha:      new Date(dto.fecha),
        moduloId:   dto.moduloId ?? null,
        expositor:  dto.expositor ?? null,
        temas:      dto.temas ?? null,
        lugar:      dto.lugar ?? null,
        teamsLink:  dto.teamsLink ?? null,
        salaToken,
        createdById: userId,
        invitados: dto.invitados?.length
          ? {
              create: dto.invitados.map(inv => ({
                nombre:       inv.nombre,
                email:        inv.email,
                cargo:        inv.cargo ?? null,
                clientStaffId: inv.clientStaffId ?? null,
                rsvpToken:    randomBytes(24).toString('hex'),
              })),
            }
          : undefined,
      },
      include: { invitados: true },
    });

    // Enviar invitaciones
    if (sesion.invitados.length > 0) {
      await this.sendInvitations(sesion.id, sesion.companyId);
    }

    return sesion;
  }

  async findAll(projectId: string) {
    return this.prisma.sesionCapacitacion.findMany({
      where: { projectId },
      include: {
        modulo:    { select: { name: true } },
        invitados: { select: { id: true, nombre: true, email: true, respuesta: true, entroSalaAt: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: string) {
    const sesion = await this.prisma.sesionCapacitacion.findUnique({
      where: { id },
      include: {
        modulo:    { select: { id: true, name: true } },
        invitados: true,
      },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    return sesion;
  }

  async update(id: string, dto: UpdateSesionDto) {
    await this.findOne(id);
    return this.prisma.sesionCapacitacion.update({
      where: { id },
      data: {
        ...(dto.titulo    !== undefined && { titulo:    dto.titulo }),
        ...(dto.fecha     !== undefined && { fecha:     new Date(dto.fecha) }),
        ...(dto.moduloId  !== undefined && { moduloId:  dto.moduloId }),
        ...(dto.expositor !== undefined && { expositor: dto.expositor }),
        ...(dto.temas     !== undefined && { temas:     dto.temas }),
        ...(dto.lugar     !== undefined && { lugar:     dto.lugar }),
        ...(dto.teamsLink !== undefined && { teamsLink: dto.teamsLink }),
        ...(dto.estado    !== undefined && { estado:    dto.estado }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.sesionCapacitacion.delete({ where: { id } });
  }

  // ── Invitados ────────────────────────────────────────────────────────────────

  async addInvitado(sesionId: string, inv: { nombre: string; email: string; cargo?: string; clientStaffId?: string }) {
    const sesion = await this.findOne(sesionId);
    const invitado = await this.prisma.sesionInvitado.create({
      data: {
        sesionId,
        nombre:        inv.nombre,
        email:         inv.email,
        cargo:         inv.cargo ?? null,
        clientStaffId: inv.clientStaffId ?? null,
        rsvpToken:     randomBytes(24).toString('hex'),
      },
    });
    await this.sendOneInvitation(invitado, sesion);
    return invitado;
  }

  async removeInvitado(invitadoId: string) {
    await this.prisma.sesionInvitado.delete({ where: { id: invitadoId } });
  }

  // ── Generar acta desde sala ──────────────────────────────────────────────────

  async generarActa(sesionId: string, userId: string) {
    const sesion = await this.findOne(sesionId);
    if (sesion.actaId) throw new BadRequestException('Esta sesión ya tiene un acta generada');

    const enSala = sesion.invitados.filter(i => i.entroSalaAt);
    if (enSala.length === 0) throw new BadRequestException('No hay participantes en la sala aún');

    const acta = await this.prisma.acta.create({
      data: {
        projectId:         sesion.projectId,
        type:              'capacitacion',
        fecha:             sesion.fecha,
        lugar:             sesion.lugar ?? '',
        moduloId:          sesion.moduloId,
        expositor:         sesion.expositor,
        temasCapacitacion: sesion.temas,
        status:            'borrador',
        createdById:       userId,
        participantes: {
          create: enSala.map((inv, i) => ({
            numero:   i + 1,
            nombre:   inv.nombre,
            cargo:    inv.cargo ?? '',
            email:    inv.email,
            horaEntrada: inv.entroSalaAt
              ? inv.entroSalaAt.toTimeString().slice(0, 5)
              : undefined,
          })),
        },
      },
    });

    await this.prisma.sesionCapacitacion.update({
      where: { id: sesionId },
      data:  { actaId: acta.id, estado: 'completada' },
    });

    return acta;
  }

  // ── RSVP público ─────────────────────────────────────────────────────────────

  async getRsvp(rsvpToken: string) {
    const invitado = await this.prisma.sesionInvitado.findUnique({
      where: { rsvpToken },
      include: { sesion: true },
    });
    if (!invitado) throw new NotFoundException('Invitación no encontrada');
    return invitado;
  }

  async confirmarRsvp(rsvpToken: string) {
    const inv = await this.getRsvp(rsvpToken);
    if (inv.respuesta === 'confirmado') return inv;

    const updated = await this.prisma.sesionInvitado.update({
      where: { rsvpToken },
      data:  { respuesta: 'confirmado', confirmadoAt: new Date() },
      include: { sesion: true },
    });

    await this.sendConfirmacionEmail(updated);
    return updated;
  }

  async cancelarRsvp(rsvpToken: string) {
    const inv = await this.getRsvp(rsvpToken);
    const updated = await this.prisma.sesionInvitado.update({
      where: { rsvpToken },
      data:  { respuesta: 'cancelado' },
      include: { sesion: true },
    });
    return updated;
  }

  // ── Sala público ─────────────────────────────────────────────────────────────

  async getSala(salaToken: string) {
    const sesion = await this.prisma.sesionCapacitacion.findUnique({
      where: { salaToken },
      include: {
        modulo:    { select: { name: true } },
        invitados: { select: { id: true, nombre: true, email: true, entroSalaAt: true } },
      },
    });
    if (!sesion) throw new NotFoundException('Sala no encontrada');
    return sesion;
  }

  async entrarSala(salaToken: string, dto: EntrarSalaDto) {
    const sesion = await this.prisma.sesionCapacitacion.findUnique({
      where: { salaToken },
      include: { invitados: true },
    });
    if (!sesion) throw new NotFoundException('Sala no encontrada');

    // Buscar si ya existe como invitado (por email)
    const existingInv = dto.email
      ? sesion.invitados.find(i => i.email.toLowerCase() === dto.email!.toLowerCase())
      : undefined;

    if (existingInv) {
      await this.prisma.sesionInvitado.update({
        where: { id: existingInv.id },
        data:  { entroSalaAt: new Date(), respuesta: 'confirmado' },
      });
      return { ok: true, message: 'Entrada registrada' };
    }

    // Crear nuevo invitado que entró directamente por el link de la sala
    await this.prisma.sesionInvitado.create({
      data: {
        sesionId:  sesion.id,
        nombre:    dto.nombre,
        email:     dto.email ?? '',
        cargo:     dto.cargo ?? null,
        rsvpToken: randomBytes(24).toString('hex'),
        respuesta: 'confirmado',
        confirmadoAt: new Date(),
        entroSalaAt:  new Date(),
      },
    });

    return { ok: true, message: 'Entrada registrada' };
  }

  // ── Recordatorios (llamados por el scheduler) ────────────────────────────────

  async enviarRecordatorios24h() {
    const now    = new Date();
    const desde  = new Date(now.getTime() + 23 * 3600_000);
    const hasta  = new Date(now.getTime() + 25 * 3600_000);

    const sesiones = await this.prisma.sesionCapacitacion.findMany({
      where: {
        estado:           'programada',
        recordatorio24hAt: null,
        fecha:             { gte: desde, lte: hasta },
      },
      include: { invitados: { where: { respuesta: 'confirmado' } } },
    });

    for (const sesion of sesiones) {
      for (const inv of sesion.invitados) {
        await this.sendRecordatorio24h(inv, sesion).catch(err =>
          this.logger.error(`Error recordatorio 24h inv=${inv.id}: ${err?.message}`),
        );
      }
      await this.prisma.sesionCapacitacion.update({
        where: { id: sesion.id },
        data:  { recordatorio24hAt: new Date() },
      });
      this.logger.log(`Recordatorio 24h enviado sesion=${sesion.id}`);
    }
  }

  async enviarRecordatorios1h() {
    const now   = new Date();
    const desde = new Date(now.getTime() + 45 * 60_000);
    const hasta = new Date(now.getTime() + 75 * 60_000);

    const sesiones = await this.prisma.sesionCapacitacion.findMany({
      where: {
        estado:          'programada',
        recordatorio1hAt: null,
        fecha:            { gte: desde, lte: hasta },
      },
      include: { invitados: { where: { respuesta: 'confirmado' } } },
    });

    for (const sesion of sesiones) {
      for (const inv of sesion.invitados) {
        await this.sendRecordatorio1h(inv, sesion).catch(err =>
          this.logger.error(`Error recordatorio 1h inv=${inv.id}: ${err?.message}`),
        );
      }
      await this.prisma.sesionCapacitacion.update({
        where: { id: sesion.id },
        data:  { recordatorio1hAt: new Date() },
      });
      this.logger.log(`Recordatorio 1h enviado sesion=${sesion.id}`);
    }
  }

  // ── Emails ───────────────────────────────────────────────────────────────────

  private async sendInvitations(sesionId: string, companyId: string) {
    const sesion = await this.prisma.sesionCapacitacion.findUnique({
      where: { id: sesionId },
      include: { invitados: true },
    });
    if (!sesion) return;
    for (const inv of sesion.invitados) {
      await this.sendOneInvitation(inv, sesion).catch(err =>
        this.logger.error(`Error invitación inv=${inv.id}: ${err?.message}`),
      );
    }
  }

  private async sendOneInvitation(
    inv: { email: string; nombre: string; rsvpToken: string },
    sesion: { titulo: string; fecha: Date; lugar?: string | null; temas?: string | null; teamsLink?: string | null; companyId: string },
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const confirmarUrl = `${frontendUrl}/confirmar/${inv.rsvpToken}`;
    const cancelarUrl  = `${frontendUrl}/confirmar/${inv.rsvpToken}?accion=cancelar`;
    const fechaLabel   = sesion.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1E3A5F;margin-bottom:4px">📚 Invitación a Capacitación</h2>
  <h3 style="color:#334155;margin-top:0">${sesion.titulo}</h3>
  <p style="color:#475569">Hola <strong>${inv.nombre}</strong>, has sido invitado/a a la siguiente sesión de capacitación.</p>
  <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:4px 0"><strong>📅 Fecha:</strong> ${fechaLabel}</p>
    ${sesion.lugar ? `<p style="margin:4px 0"><strong>📍 Lugar:</strong> ${sesion.lugar}</p>` : ''}
    ${sesion.temas ? `<p style="margin:4px 0"><strong>📋 Temas:</strong> ${sesion.temas}</p>` : ''}
    ${sesion.teamsLink ? `<p style="margin:4px 0"><strong>💻 Reunión Teams:</strong> <a href="${sesion.teamsLink}" style="color:#2563eb">Unirse a la reunión</a></p>` : ''}
  </div>
  <p style="color:#475569">Por favor confirma tu asistencia:</p>
  <div style="text-align:center;margin:24px 0">
    <a href="${confirmarUrl}" style="background:#22c55e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:12px;display:inline-block">✅ Confirmar asistencia</a>
    <a href="${cancelarUrl}" style="background:#ef4444;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">❌ No podré asistir</a>
  </div>
</div>`;

    await this.mail.sendFromCompany(sesion.companyId, [inv.email], `Invitación: ${sesion.titulo}`, html);
  }

  private async sendConfirmacionEmail(
    inv: { email: string; nombre: string; sesion: { titulo: string; fecha: Date; lugar?: string | null; teamsLink?: string | null; companyId: string } },
  ) {
    const fechaLabel = inv.sesion.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#22c55e">✅ Asistencia Confirmada</h2>
  <p>Hola <strong>${inv.nombre}</strong>, tu asistencia a la capacitación ha sido confirmada.</p>
  <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #22c55e">
    <p style="margin:4px 0"><strong>${inv.sesion.titulo}</strong></p>
    <p style="margin:4px 0">📅 ${fechaLabel}</p>
    ${inv.sesion.lugar ? `<p style="margin:4px 0">📍 ${inv.sesion.lugar}</p>` : ''}
    ${inv.sesion.teamsLink ? `<p style="margin:4px 0">💻 <a href="${inv.sesion.teamsLink}" style="color:#2563eb">Link de reunión Teams</a></p>` : ''}
  </div>
  <p style="color:#475569">Recibirás recordatorios antes de la sesión. ¡Te esperamos!</p>
</div>`;

    await this.mail.sendFromCompany(inv.sesion.companyId, [inv.email], `Confirmación: ${inv.sesion.titulo}`, html);
  }

  private async sendRecordatorio24h(
    inv: { email: string; nombre: string },
    sesion: { titulo: string; fecha: Date; lugar?: string | null; teamsLink?: string | null; companyId: string },
  ) {
    const fechaLabel = sesion.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#f59e0b">⏰ Recordatorio: Capacitación mañana</h2>
  <p>Hola <strong>${inv.nombre}</strong>, te recordamos que mañana tienes una sesión de capacitación.</p>
  <div style="background:#fffbeb;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #f59e0b">
    <p style="margin:4px 0"><strong>${sesion.titulo}</strong></p>
    <p style="margin:4px 0">📅 ${fechaLabel}</p>
    ${sesion.lugar ? `<p style="margin:4px 0">📍 ${sesion.lugar}</p>` : ''}
    ${sesion.teamsLink ? `<p style="margin:4px 0">💻 <a href="${sesion.teamsLink}" style="color:#2563eb">Link de reunión Teams</a></p>` : ''}
  </div>
  <p style="color:#475569">Recibirás otro recordatorio 1 hora antes del inicio.</p>
</div>`;

    await this.mail.sendFromCompany(sesion.companyId, [inv.email], `Recordatorio mañana: ${sesion.titulo}`, html);
  }

  private async sendRecordatorio1h(
    inv: { email: string; nombre: string },
    sesion: { titulo: string; fecha: Date; lugar?: string | null; teamsLink?: string | null; salaToken: string; companyId: string },
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const salaUrl    = `${frontendUrl}/sala/${sesion.salaToken}`;
    const fechaLabel = sesion.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#ef4444">🚨 ¡Comienza en 1 hora!</h2>
  <p>Hola <strong>${inv.nombre}</strong>, tu capacitación comienza en 1 hora.</p>
  <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #ef4444">
    <p style="margin:4px 0"><strong>${sesion.titulo}</strong></p>
    <p style="margin:4px 0">📅 ${fechaLabel}</p>
    ${sesion.lugar ? `<p style="margin:4px 0">📍 ${sesion.lugar}</p>` : ''}
  </div>
  ${sesion.teamsLink ? `
  <div style="text-align:center;margin:16px 0">
    <a href="${sesion.teamsLink}" style="background:#5b5ea6;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">💻 Unirse a la reunión Teams</a>
  </div>` : ''}
  <div style="text-align:center;margin:16px 0">
    <a href="${salaUrl}" style="background:#1E3A5F;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">🚪 Ingresar a la sala y registrar asistencia</a>
  </div>
  <p style="color:#94a3b8;font-size:12px;text-align:center">Al hacer clic en "Ingresar a la sala" tu asistencia quedará registrada automáticamente.</p>
</div>`;

    await this.mail.sendFromCompany(sesion.companyId, [inv.email], `¡Comienza en 1 hora! ${sesion.titulo}`, html);
  }
}
