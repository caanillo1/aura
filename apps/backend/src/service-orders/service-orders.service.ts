import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
  InternalServerErrorException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { Prisma } from '@prisma/client';
import { paginate, buildMeta } from '../common/dto/pagination.dto';
import {
  CreateServiceOrderDto, UpdateServiceOrderDto,
  ChangeStatusDto, AddImplementerDto, AddNoteDto, ServiceOrderFilterDto,
} from './dto/service-order.dto';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const OS_SELECT = {
  id: true, osNumber: true, ticketRubi: true, product: true, scope: true,
  durationDays: true, startDate: true, endDate: true,
  observations: true, status: true, createdAt: true, updatedAt: true,
  client: { select: { id: true, businessName: true, nit: true } },
  clinicalLeader:  { select: { id: true, firstName: true, lastName: true } },
  financialLeader: { select: { id: true, firstName: true, lastName: true } },
  clientLeader:    { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  implementers: {
    select: {
      role: true, assignedAt: true,
      user: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
    },
  },
  _count: { select: { history: true } },
};

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private gateway: EventsGateway,
    private notifications: NotificationsService,
  ) {}

  // ── PDF cache — keyed by osId+type, invalidated when data hash changes ──
  private readonly pdfCache = new Map<string, { hash: string; buffer: Buffer }>();

  private dataHash(data: any): string {
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 20);
  }

  invalidatePdfCache(osId: string) {
    this.pdfCache.delete(`${osId}:ejecutivo`);
    this.pdfCache.delete(`${osId}:completo`);
  }

  // ── Print token cache (one-time use, 10 min TTL) ─────────────────────────
  private readonly printCache = new Map<string, { data: any; expires: number }>();

  storePrintData(data: any): string {
    const crypto  = require('crypto') as typeof import('crypto');
    const token   = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + 10 * 60 * 1000;
    this.printCache.set(token, { data, expires });
    console.log(`[PrintCache] stored token ${token.slice(0, 12)}… (cache size: ${this.printCache.size})`);
    for (const [k, v] of this.printCache.entries()) {
      if (Date.now() > v.expires) this.printCache.delete(k);
    }
    return token;
  }

  retrievePrintData(token: string): any {
    console.log(`[PrintCache] retrieve token ${token.slice(0, 12)}… (cache size: ${this.printCache.size})`);
    const entry = this.printCache.get(token);
    if (!entry) { console.warn(`[PrintCache] token NOT FOUND`); return null; }
    if (Date.now() > entry.expires) { console.warn(`[PrintCache] token EXPIRED`); this.printCache.delete(token); return null; }
    return entry.data;
  }

  async findAll(companyId: string, dto: ServiceOrderFilterDto) {
    const { take, skip } = paginate(dto.page, dto.limit);
    const where: any = { companyId };
    const andConditions: any[] = [];
    if (dto.search) {
      andConditions.push({ OR: [
        { osNumber: { contains: dto.search } },
        { product: { contains: dto.search } },
        { client: { businessName: { contains: dto.search } } },
      ]});
    }
    if (dto.agentId) {
      andConditions.push({ OR: [
        { clinicalLeaderId: dto.agentId },
        { financialLeaderId: dto.agentId },
      ]});
    }
    if (andConditions.length > 0) where.AND = andConditions;
    if (dto.status)   where.status   = dto.status;
    if (dto.clientId) where.clientId = dto.clientId;

    const [data, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where, select: OS_SELECT, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto.page ?? 1, dto.limit ?? 20) };
  }

  async findOne(companyId: string, id: string) {
    const os = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      include: {
        client: { select: { id: true, businessName: true, nit: true } },
        clinicalLeader:  { select: { id: true, firstName: true, lastName: true } },
        financialLeader: { select: { id: true, firstName: true, lastName: true } },
        clientLeader:    { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        implementers: {
          include: { user: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
        },
        history: { orderBy: { createdAt: 'desc' } },
        project: { select: { id: true, name: true, status: true, progressPercent: true } },
      },
    });
    if (!os) throw new NotFoundException('Orden de servicio no encontrada');
    return os;
  }

  async create(companyId: string, createdById: string, dto: CreateServiceOrderDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Use MAX(osNumber) approach to avoid race conditions with count
        const existing = await tx.serviceOrder.findMany({
          where: { companyId },
          select: { osNumber: true },
          orderBy: { createdAt: 'desc' },
        });
        const year = new Date().getFullYear();
        const nums = existing
          .map(o => parseInt(o.osNumber.split('-')[2] ?? '0', 10))
          .filter(n => !isNaN(n));
        const nextNum = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
        const osNumber = `OS-${year}-${String(nextNum).padStart(3, '0')}`;

        const os = await tx.serviceOrder.create({
          data: {
            companyId, createdById, osNumber,
            clientId:         dto.clientId,
            ticketRubi:       dto.ticketRubi        || null,
            product:          dto.product,
            scope:            dto.scope             ?? null,
            startDate:        new Date(dto.startDate),
            endDate:          new Date(dto.endDate),
            durationDays:     dto.durationDays      ?? 0,
            clinicalLeaderId: dto.clinicalLeaderId  ?? null,
            financialLeaderId: dto.financialLeaderId ?? null,
            observations:     dto.observations      ?? null,
            status:           'pendiente',
          },
          select: OS_SELECT,
        });

        await tx.serviceOrderHistory.create({
          data: {
            serviceOrderId: os.id,
            changedById:    createdById,
            fieldName:      'status',
            oldValue:       null,
            newValue:       'pendiente',
            reason:         'Creación de la orden de servicio',
          },
        });

        return os;
      });
    } catch (err: any) {
      // P2002 = unique constraint (race condition on osNumber)
      if (err?.code === 'P2002') {
        throw new ConflictException('El número de OS ya existe, intenta de nuevo');
      }
      throw new BadRequestException(err?.message ?? 'Error al crear la orden de servicio');
    }
  }

  async update(companyId: string, id: string, dto: UpdateServiceOrderDto) {
    await this.findOne(companyId, id);
    const data: any = {
      ...(dto.ticketRubi   !== undefined && { ticketRubi:       dto.ticketRubi?.trim() || null }),
      ...(dto.product      !== undefined && { product:          dto.product.trim().toUpperCase() }),
      ...(dto.scope        !== undefined && { scope:            dto.scope?.trim().toUpperCase() || null }),
      ...(dto.observations !== undefined && { observations:     dto.observations?.trim().toUpperCase() || null }),
      ...(dto.durationDays !== undefined && { durationDays:     dto.durationDays }),
      ...(dto.startDate    !== undefined && { startDate:        new Date(dto.startDate) }),
      ...(dto.endDate      !== undefined && { endDate:          new Date(dto.endDate) }),
      ...(dto.clinicalLeaderId  !== undefined && { clinicalLeaderId:  dto.clinicalLeaderId  || null }),
      ...(dto.financialLeaderId !== undefined && { financialLeaderId: dto.financialLeaderId || null }),
      ...(dto.clientLeaderId    !== undefined && { clientLeaderId:    dto.clientLeaderId    || null }),
    };
    const result = await this.prisma.serviceOrder.update({ where: { id }, data, select: OS_SELECT });
    this.invalidatePdfCache(id);
    return result;
  }

  async changeStatus(companyId: string, id: string, changedById: string, dto: ChangeStatusDto) {
    const os = await this.findOne(companyId, id);
    const oldStatus = os.status;
    if (oldStatus === dto.status) {
      throw new BadRequestException('El estado es igual al actual');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.serviceOrder.update({
        where: { id },
        data: { status: dto.status },
        select: OS_SELECT,
      }),
      this.prisma.serviceOrderHistory.create({
        data: {
          serviceOrderId: id,
          changedById,
          fieldName: 'status',
          oldValue: oldStatus,
          newValue: dto.status,
          reason: dto.reason,
        },
      }),
    ]);
    this.invalidatePdfCache(id);

    const STATUS_LABEL: Record<string, string> = {
      pendiente: 'Pendiente', en_curso: 'En Curso', finalizada: 'Finalizada',
      suspendida: 'Suspendida', cancelada: 'Cancelada',
    };
    this.notifications.broadcastToAgents(
      companyId,
      {
        type: 'orden_servicio',
        title: `OS ${updated.osNumber}: estado → ${STATUS_LABEL[dto.status] ?? dto.status}`,
        message: dto.reason ?? undefined,
        entityType: 'serviceOrder',
        entityId: id,
      },
      this.gateway,
    );
    this.gateway.dashboardUpdate(companyId, { type: 'os_status_changed', payload: { id } });

    return updated;
  }

  async addNote(companyId: string, id: string, userId: string, dto: AddNoteDto) {
    await this.findOne(companyId, id);
    await this.prisma.serviceOrderHistory.create({
      data: {
        serviceOrderId: id,
        changedById: userId,
        fieldName: 'nota',
        oldValue: null,
        newValue: null,
        reason: dto.note.trim(),
        noteType:      dto.noteType,
        noteLevel:     dto.noteLevel,
        noteSubtype:   dto.noteSubtype   ?? null,
        noteMitigation: dto.noteSubtype === 'riesgo_critico' && dto.noteMitigation
          ? dto.noteMitigation.trim()
          : null,
      },
    });
    this.invalidatePdfCache(id);

    const NOTE_LEVEL_LABEL: Record<string, string> = {
      informativo: 'ℹ️', baja: '🟡', media: '🟠', alta: '🔴', critica: '🚨',
    };
    const levelTag = NOTE_LEVEL_LABEL[dto.noteLevel] ?? '';
    const typeTag  = dto.noteType === 'interna' ? '[Interna] ' : '';
    this.notifications.broadcastToAgents(
      companyId,
      {
        type: 'nota',
        title: `${levelTag} ${typeTag}Nueva nota en OS`,
        message: dto.note.trim().slice(0, 120),
        entityType: 'serviceOrder',
        entityId: id,
      },
      this.gateway,
    );

    if (dto.notifyClient && dto.noteType !== 'interna') {
      this.notifyNote(companyId, id, userId, {
        noteText:       dto.note.trim(),
        noteType:       dto.noteType as 'general' | 'interna',
        noteLevel:      dto.noteLevel,
        noteSubtype:    dto.noteSubtype ?? null,
        noteMitigation: dto.noteMitigation ?? null,
        notifyClient:   true,
      }).catch(() => {});
    }

    return this.findOne(companyId, id);
  }

  async notifyNote(
    companyId: string,
    osId: string,
    userId: string,
    dto: {
      noteText: string;
      noteType: 'general' | 'interna';
      noteLevel: string;
      noteSubtype?: string | null;
      noteMitigation?: string | null;
      notifyClient?: boolean;
    },
  ): Promise<{ sent: number }> {
    // Load OS data + author name for email context
    const [os, author] = await Promise.all([
      this.findOne(companyId, osId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
    ]);
    const authorName = author
      ? `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim() || author.email
      : 'Sistema';
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, commercialName: true, primaryColor: true },
    });

    // Load recipients from both schedules (stored in systemConfig as JSON)
    const [weeklyCfg, bimensualCfg, osExtra] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { companyId_configKey: { companyId, configKey: `informe_weekly_${osId}` } },
        select: { configValue: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { companyId_configKey: { companyId, configKey: `informe_bimensual_${osId}` } },
        select: { configValue: true },
      }),
      this.prisma.serviceOrder.findUnique({
        where: { id: osId },
        select: { clientLeader: { select: { email: true } } },
      }),
    ]);
    const parseDestination = (cfg: { configValue: string | null } | null): string[] => {
      try { return JSON.parse(cfg?.configValue ?? '{}')?.destinatarios ?? []; } catch { return []; }
    };
    const clientLeaderEmail = dto.notifyClient && dto.noteType !== 'interna'
      ? (osExtra?.clientLeader?.email ?? null)
      : null;
    const allRecipients = Array.from(new Set([
      ...parseDestination(weeklyCfg),
      ...parseDestination(bimensualCfg),
      ...(clientLeaderEmail ? [clientLeaderEmail] : []),
    ]));
    if (!allRecipients.length) return { sent: 0 };

    // Split recipients: AURA agents vs client contacts
    const agentUsers = await this.prisma.user.findMany({
      where: { companyId, email: { in: allRecipients }, userType: 'agent' },
      select: { email: true },
    });
    const agentEmails  = agentUsers.map(u => u.email);
    const clientEmails = allRecipients.filter(e => !agentEmails.includes(e));

    // Always send to agents; optionally include client contacts
    const recipients = [
      ...agentEmails,
      ...(dto.notifyClient && dto.noteType !== 'interna' ? clientEmails : []),
    ];
    if (!recipients.length) return { sent: 0 };

    const pc  = company?.primaryColor ?? '#1E3A5F';
    const nom = company?.commercialName ?? company?.name ?? 'AURA';
    const osData = os as any;
    const osNum = osData.osNumber ?? '';
    const client = osData.client?.businessName ?? '';

    const LEVEL_COLOR: Record<string, string> = {
      critica: '#ef4444', alta: '#f97316', media: '#f59e0b', baja: '#3b82f6',
    };
    const LEVEL_LABEL: Record<string, string> = {
      critica: 'CRÍTICA', alta: 'ALTA', media: 'MEDIA', baja: 'BAJA',
    };
    const SUBTYPE_LABEL: Record<string, string> = {
      proximos_logros: 'Próximos Logros', riesgo_critico: 'Riesgo Crítico',
    };

    const levelColor = LEVEL_COLOR[dto.noteLevel] ?? '#6b7280';
    const levelLabel = LEVEL_LABEL[dto.noteLevel] ?? dto.noteLevel;
    const visibility = dto.noteType === 'interna' ? '🔒 Nota Interna (solo agentes)' : '🌐 Nota Pública';
    const subtypeHtml = dto.noteSubtype
      ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;">
           Subtipo: <strong>${SUBTYPE_LABEL[dto.noteSubtype] ?? dto.noteSubtype}</strong>
         </div>`
      : '';
    const mitigationHtml = dto.noteMitigation
      ? `<div style="margin-top:12px;padding:12px 16px;background:#fef9c3;border-left:4px solid #eab308;border-radius:4px;">
           <div style="font-size:11px;font-weight:700;color:#854d0e;text-transform:uppercase;margin-bottom:4px;">Mitigación</div>
           <div style="font-size:13px;color:#854d0e;">${dto.noteMitigation}</div>
         </div>`
      : '';

    const issuedAt = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const asunto = `${dto.noteType === 'interna' ? '[Interna] ' : ''}Nota ${levelLabel} – OS ${osNum} – ${client}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
  <tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
    <div style="font-size:15px;font-weight:800;">${nom}</div>
    <div style="font-size:12px;opacity:0.8;margin-top:2px;">Orden de Servicio ${osNum} · ${client}</div>
  </td></tr>
  <tr><td style="height:4px;background:linear-gradient(90deg,${levelColor},${pc});"></td></tr>
  <tr><td style="padding:24px 28px;">
    <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:${levelColor}20;border:1px solid ${levelColor};color:${levelColor};font-size:11px;font-weight:700;letter-spacing:0.5px;">
      ${levelLabel}
    </div>
    <div style="margin-top:6px;font-size:11px;color:#6b7280;">${visibility}</div>
    ${subtypeHtml}
    <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:6px;border-left:4px solid ${levelColor};">
      <div style="font-size:13px;color:#1f2937;line-height:1.6;">${dto.noteText.replace(/\n/g, '<br>')}</div>
    </div>
    ${mitigationHtml}
    <div style="margin-top:16px;font-size:12px;color:#9ca3af;">
      Registrado por <strong style="color:#6b7280;">${authorName}</strong> · ${issuedAt}
    </div>
  </td></tr>
  <tr><td style="padding:12px 28px;border-top:1px solid #f3f4f6;">
    <div style="font-size:11px;color:#9ca3af;">
      Este mensaje fue generado automáticamente por ${nom}. No responda a este correo.
    </div>
  </td></tr>
</table></td></tr></table></body></html>`;

    await this.mail.sendFromCompany(companyId, recipients, asunto, html);
    return { sent: recipients.length };
  }

  async findOneForAgent(companyId: string, id: string) {
    return this.findOne(companyId, id);
  }

  async findOneForClient(companyId: string, id: string) {
    const os = await this.findOne(companyId, id);
    (os as any).history = ((os as any).history ?? []).filter(
      (h: any) => h.fieldName !== 'nota' || h.noteType === 'general',
    );
    return os;
  }

  async addImplementer(companyId: string, id: string, dto: AddImplementerDto) {
    await this.findOne(companyId, id);
    const existing = await this.prisma.serviceOrderImplementer.findUnique({
      where: { serviceOrderId_userId: { serviceOrderId: id, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('El implementador ya está asignado');

    this.invalidatePdfCache(id);
    return this.prisma.serviceOrderImplementer.create({
      data: { serviceOrderId: id, userId: dto.userId, role: dto.role ?? 'apoyo' },
      include: { user: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
    });
  }

  async removeImplementer(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    const existing = await this.prisma.serviceOrderImplementer.findUnique({
      where: { serviceOrderId_userId: { serviceOrderId: id, userId } },
    });
    if (!existing) throw new NotFoundException('Implementador no encontrado en esta OS');
    await this.prisma.serviceOrderImplementer.delete({
      where: { serviceOrderId_userId: { serviceOrderId: id, userId } },
    });
    this.invalidatePdfCache(id);
    return { message: 'Implementador removido' };
  }

  async deleteHistoryEntry(companyId: string, osId: string, historyId: string) {
    await this.findOne(companyId, osId);
    const entry = await this.prisma.serviceOrderHistory.findFirst({
      where: { id: historyId, serviceOrderId: osId },
    });
    if (!entry) throw new NotFoundException('Entrada de historial no encontrada');
    await this.prisma.serviceOrderHistory.delete({ where: { id: historyId } });
    this.invalidatePdfCache(osId);
    return { ok: true };
  }

  async bulkDelete(companyId: string, ids: string[]) {
    const results: { id: string; osNumber: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        const res = await this.delete(companyId, id);
        results.push({ id, osNumber: (res as any).osNumber ?? id, ok: true });
      } catch (err: any) {
        const os = await this.prisma.serviceOrder.findFirst({ where: { id, companyId }, select: { osNumber: true } });
        results.push({ id, osNumber: os?.osNumber ?? id, ok: false, error: err?.message ?? 'Error desconocido' });
      }
    }
    return {
      eliminadas: results.filter(r => r.ok).length,
      fallidas: results.filter(r => !r.ok).length,
      resultados: results,
    };
  }

  async getExecutiveReport(companyId: string, id: string) {
    const os = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      include: {
        client: { select: { id: true, businessName: true, nit: true } },
        clinicalLeader:  { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true } },
        financialLeader: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true } },
        clientLeader:    { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true } },
        implementers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true } },
          },
        },
      },
    });
    if (!os) throw new NotFoundException('Orden de servicio no encontrada');

    const [company, project, requerimientos, clientStaff, noteHistory] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, commercialName: true, nit: true, logo: true, logoData: true, primaryColor: true, secondaryColor: true, address: true, city: true, phone: true, email: true, website: true },
      }),
      this.prisma.project.findUnique({
        where: { serviceOrderId: id },
        include: {
          modules: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            include: {
              phases: {
                orderBy: { order: 'asc' },
                include: {
                  activities: {
                    orderBy: { order: 'asc' },
                    select: {
                      id: true, name: true, code: true, status: true, priority: true,
                      progressPercent: true, plannedStartDate: true, plannedEndDate: true,
                      actualEndDate: true, executionDate: true,
                      assignedTo: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.requerimiento.findMany({
        where: { companyId, serviceOrderId: id },
        select: {
          id: true, numero: true, titulo: true, tipo: true, prioridad: true,
          estadoActual: true, area: true, ticketRubi: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.clientStaff.findMany({
        where: { clientId: (os as any).clientId, isActive: true },
        select: {
          id: true, firstName: true, lastName: true, jobTitle: true,
          email: true, phone: true, area: true, document: true, isProjectLeader: true,
        },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.serviceOrderHistory.findMany({
        where: { serviceOrderId: id, fieldName: 'nota' },
        select: {
          id: true, reason: true, noteType: true, noteLevel: true,
          noteSubtype: true, noteMitigation: true, createdAt: true, changedById: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const authorIds = [...new Set(noteHistory.map((n: any) => n.changedById))];
    const authors = authorIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const authorMap = new Map(authors.map((u: any) => [u.id, `${u.firstName} ${u.lastName}`]));
    const notes = noteHistory.map((n: any) => ({
      ...n,
      autorNombre: authorMap.get(n.changedById) ?? 'Desconocido',
    }));

    const actas = project
      ? await this.prisma.acta.findMany({
          where: { projectId: project.id },
          include: {
            municipio:     { select: { nombreMunicipio: true } },
            firmantes:     { select: { nombre: true, cargo: true, empresa: true, signedAt: true, signerType: true, documento: true } },
            participantes: { select: { nombre: true, cargo: true, documento: true } },
            modulo:        { select: { name: true } },
            createdBy:     { select: { firstName: true, lastName: true } },
          },
          orderBy: { fecha: 'asc' },
        })
      : [];

    const capActas = actas.filter((a: any) => a.type === 'capacitacion');
    const allParticipantDocs = new Set<string>(
      capActas.flatMap((a: any) => (a.participantes ?? []).map((p: any) => p.documento).filter(Boolean)),
    );
    const signedDocs = new Set<string>(
      capActas.flatMap((a: any) =>
        (a.firmantes ?? [])
          .filter((f: any) => f.signerType === 'participante' && f.signedAt)
          .map((f: any) => f.documento)
          .filter(Boolean),
      ),
    );
    const docToStaff = new Map(clientStaff.map((s: any) => [s.document, s]));

    return {
      company,
      os,
      project,
      actas,
      requerimientos,
      notes,
      personalCapacitado: Array.from(signedDocs).map(d => docToStaff.get(d)).filter(Boolean),
      personalEnProceso:  Array.from(allParticipantDocs).filter(d => !signedDocs.has(d)).map(d => docToStaff.get(d)).filter(Boolean),
      personalPendiente:  clientStaff.filter((s: any) => !allParticipantDocs.has(s.document) && !signedDocs.has(s.document)),
      generatedAt: new Date().toISOString(),
    };
  }

  async getFullReport(companyId: string, id: string) {
    const base = await this.getExecutiveReport(companyId, id);
    if (!(base as any).project) return base;
    const projectId = (base as any).project.id;

    const actasCompletas = await this.prisma.acta.findMany({
      where: { projectId },
      include: {
        firmantes:     { orderBy: { orden: 'asc' as const } },
        fechasVisita:  { orderBy: { fecha: 'asc' as const } },
        compromisos: {
          select: {
            id: true, numero: true, compromiso: true, responsable: true,
            estado: true, assignedToId: true, clientStaffId: true,
            moduleId: true, phaseId: true, activityId: true,
            assignedTo:  { select: { id: true, firstName: true, lastName: true } },
            clientStaff: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
            module:      { select: { id: true, name: true } },
            phase:       { select: { id: true, name: true } },
          },
        },
        participantes: { orderBy: { numero: 'asc' as const } },
        acciones:      true,
        contactos:     true,
        modulo:        { select: { id: true, name: true } },
        municipio:     { select: { id: true, nombreMunicipio: true, nombreDepartamento: true } },
        createdBy:     { select: { id: true, firstName: true, lastName: true } },
        actaActividades: {
          include: {
            activity: {
              select: {
                id: true, code: true, name: true, status: true, phaseId: true,
                assignedToId: true, clientStaffId: true,
                phase: {
                  select: {
                    id: true, name: true, projectModuleId: true,
                    projectModule: { select: { id: true, name: true } },
                  },
                },
              },
            },
            assignedTo:  { select: { id: true, firstName: true, lastName: true } },
            clientStaff: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
          },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    return { ...base, actas: actasCompletas };
  }

  async getAlerts(companyId: string, osId: string) {
    const today = new Date();
    const cutoff14 = new Date(today.getTime() - 14 * 86400000);

    const [os, project, recentHistory, bloques, reqs] = await Promise.all([
      this.prisma.serviceOrder.findFirst({
        where: { id: osId, companyId },
        select: {
          id: true, osNumber: true, status: true, product: true,
          startDate: true, endDate: true, durationDays: true,
          client: { select: { id: true, businessName: true, nit: true } },
        },
      }),
      this.prisma.project.findUnique({
        where: { serviceOrderId: osId },
        select: {
          id: true, name: true, status: true, progressPercent: true,
          startDate: true, endDate: true,
          modules: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            select: {
              id: true, name: true, progressPercent: true,
              phases: {
                orderBy: { order: 'asc' },
                select: {
                  id: true, name: true,
                  activities: {
                    orderBy: { order: 'asc' },
                    select: {
                      id: true, name: true, code: true, status: true,
                      progressPercent: true, plannedStartDate: true, plannedEndDate: true,
                      blockedBy: true, clientDelayDays: true,
                      assignedTo: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.serviceOrderHistory.findMany({
        where: { serviceOrderId: osId, createdAt: { gte: cutoff14 } },
        select: { id: true, createdAt: true },
        take: 1,
      }),
      this.prisma.cronogramaBloque.findMany({
        where: { serviceOrderId: osId },
        select: { id: true, status: true, fecha: true, titulo: true },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.requerimiento.findMany({
        where: { serviceOrderId: osId },
        select: { id: true, numero: true, titulo: true, prioridad: true,
                  estadoActual: true, ticketRubi: true, tipo: true, devueltoPor: true },
        orderBy: [{ prioridad: 'asc' }, { estadoActual: 'asc' }],
      }),
    ]);

    if (!os) throw new Error('OS no encontrada');

    // Si no hay tickets vinculados directamente a la OS, buscar por cliente
    const reqsRaw = reqs.length > 0 ? reqs
      : await this.prisma.requerimiento.findMany({
          where: { clientId: os.client.id },
          select: { id: true, numero: true, titulo: true, prioridad: true,
                    estadoActual: true, ticketRubi: true, tipo: true,
                    devueltoPor: true, serviceOrderId: true },
          orderBy: [{ prioridad: 'asc' }, { estadoActual: 'asc' }],
        });

    type Alert = { level: 'critico' | 'advertencia' | 'info'; tipo: string; titulo: string; detalle: string };
    const alerts: Alert[] = [];

    const allActivities = (project?.modules ?? []).flatMap(m =>
      m.phases.flatMap(p => p.activities.map(a => ({ ...a, moduleName: m.name, phaseName: p.name }))));
    const doneActs    = allActivities.filter(a => a.status === 'completado').length;
    const totalActs   = allActivities.length;

    // ── 1. OS vencida ────────────────────────────────────────────────────────
    if (os.endDate && new Date(os.endDate) < today && !['completada', 'cancelada'].includes(os.status)) {
      const days = Math.floor((today.getTime() - new Date(os.endDate).getTime()) / 86400000);
      alerts.push({ level: 'critico', tipo: 'os_vencida',
        titulo: 'Fecha de cierre vencida',
        detalle: `La OS venció hace ${days} día${days !== 1 ? 's' : ''} y sigue activa.` });
    }

    // ── 2. Actividades vencidas ──────────────────────────────────────────────
    const overdueActs = allActivities.filter(a =>
      a.plannedEndDate && new Date(a.plannedEndDate) < today && a.status !== 'completado');
    if (overdueActs.length > 0) {
      alerts.push({ level: 'critico', tipo: 'actividades_vencidas',
        titulo: `${overdueActs.length} actividad${overdueActs.length !== 1 ? 'es' : ''} vencida${overdueActs.length !== 1 ? 's' : ''}`,
        detalle: overdueActs.slice(0, 3).map(a => `${a.code ?? ''} ${a.name} (${a.moduleName})`).join(' · ') +
                 (overdueActs.length > 3 ? ` y ${overdueActs.length - 3} más` : '') });
    }

    // ── 3. Actividades bloqueadas ─────────────────────────────────────────────
    const blockedActs = allActivities.filter(a => a.status === 'bloqueado');
    const blockedByBreakdown = {
      cliente:       blockedActs.filter(a => (a as any).blockedBy === 'cliente').length,
      desarrollo:    blockedActs.filter(a => (a as any).blockedBy === 'desarrollo').length,
      implementador: blockedActs.filter(a => (a as any).blockedBy === 'implementador').length,
      sinAtribuir:   blockedActs.filter(a => !(a as any).blockedBy).length,
    };
    const totalClientDelayDays = allActivities.reduce((s, a) => s + ((a as any).clientDelayDays ?? 0), 0);
    if (blockedActs.length > 0) {
      alerts.push({ level: 'critico', tipo: 'actividades_bloqueadas',
        titulo: `${blockedActs.length} actividad${blockedActs.length !== 1 ? 'es' : ''} bloqueada${blockedActs.length !== 1 ? 's' : ''}`,
        detalle: blockedActs.slice(0, 3).map(a => `${a.code ?? ''} ${a.name}`).join(' · ') +
                 (blockedActs.length > 3 ? ` y ${blockedActs.length - 3} más` : '') });
    }

    // ── 4. Sin movimiento en 14 días ─────────────────────────────────────────
    if (project && recentHistory.length === 0 && !['completada', 'cancelada'].includes(os.status)) {
      alerts.push({ level: 'advertencia', tipo: 'sin_movimiento',
        titulo: 'Sin movimiento en los últimos 14 días',
        detalle: 'No se ha registrado ningún cambio en el historial de la OS en 14 días.' });
    }

    // ── 5. Visitas canceladas ────────────────────────────────────────────────
    const cancelledVisits = bloques.filter(b => b.status === 'cancelado');
    if (cancelledVisits.length > 0) {
      const afterCancel = bloques.filter(b =>
        b.status !== 'cancelado' && cancelledVisits.some(c => new Date(b.fecha) > new Date(c.fecha)));
      if (afterCancel.length === 0) {
        alerts.push({ level: 'advertencia', tipo: 'visita_cancelada_sin_reagendar',
          titulo: `${cancelledVisits.length} visita${cancelledVisits.length !== 1 ? 's' : ''} cancelada${cancelledVisits.length !== 1 ? 's' : ''} sin reagendar`,
          detalle: 'Hay visitas canceladas y no se ha programado ninguna nueva visita posterior.' });
      }
    }

    // ── 6. Tickets devueltos sin resolver ────────────────────────────────────
    const reqDevueltos = reqsRaw.filter(r => r.estadoActual === 'Devuelto').length;
    if (reqDevueltos > 0) {
      alerts.push({ level: 'advertencia', tipo: 'tickets_devueltos',
        titulo: `${reqDevueltos} requerimiento${reqDevueltos !== 1 ? 's' : ''} devuelto${reqDevueltos !== 1 ? 's' : ''}`,
        detalle: 'Hay requerimientos que fueron devueltos y requieren revisión o corrección antes de continuar.' });
    }

    // ── 7. Sin proyecto vinculado ────────────────────────────────────────────
    if (!project && os.status === 'en_curso') {
      alerts.push({ level: 'advertencia', tipo: 'sin_proyecto',
        titulo: 'OS en curso sin proyecto vinculado',
        detalle: 'La orden de servicio está activa pero no tiene un proyecto de implementación creado.' });
    }

    // ── 7. Progreso muy bajo en tiempo avanzado ──────────────────────────────
    if (os.startDate && os.endDate && project) {
      const totalMs   = new Date(os.endDate).getTime() - new Date(os.startDate).getTime();
      const elapsedMs = today.getTime() - new Date(os.startDate).getTime();
      const timePct   = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
      const progPct   = Number(project.progressPercent ?? 0);
      if (timePct > 50 && progPct < timePct * 0.5) {
        alerts.push({ level: 'advertencia', tipo: 'progreso_bajo',
          titulo: 'Progreso por debajo del ritmo esperado',
          detalle: `${timePct.toFixed(0)}% del tiempo transcurrido con solo ${progPct.toFixed(0)}% de avance.` });
      }
    }

    // ── Resumen de tickets (requerimientos) ──────────────────────────────────
    const PRIO_ORDER: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };
    const reqsSorted = [...reqsRaw].sort((a, b) =>
      (PRIO_ORDER[a.prioridad] ?? 1) - (PRIO_ORDER[b.prioridad] ?? 1));
    const ticketsDetail = {
      total:          reqsRaw.length,
      entregados:     reqsRaw.filter(r => r.estadoActual === 'Entregado').length,
      devueltos:      reqsRaw.filter(r => r.estadoActual === 'Devuelto').length,
      negados:        reqsRaw.filter(r => r.estadoActual === 'Negado').length,
      repriorizados:  reqsRaw.filter(r => r.estadoActual === 'Repriorizado').length,
      pendientes:     reqsRaw.filter(r => r.estadoActual === 'Pendiente').length,
      altaPrioridad:  reqsRaw.filter(r => r.prioridad === 'Alta').length,
      vinculadosAOs:  reqs.length,
      list: reqsSorted.slice(0, 25).map(r => ({
        id: r.id, numero: r.numero, titulo: r.titulo,
        prioridad: r.prioridad, estadoActual: r.estadoActual,
        ticketRubi: r.ticketRubi, tipo: r.tipo,
        devueltoPor: (r as any).devueltoPor ?? null,
        vinculadoAEstaOS: (r as any).serviceOrderId === osId || !!(reqs.find((rr: any) => rr.id === r.id)),
      })),
    };

    // ── Módulos detalle ───────────────────────────────────────────────────────
    const modulesDetail = (project?.modules ?? []).map(m => {
      const modActs = m.phases.flatMap(p => p.activities);
      const total   = modActs.length;
      const done    = modActs.filter(a => a.status === 'completado').length;
      const inProg  = modActs.filter(a => a.status === 'en_progreso').length;
      const blocked = modActs.filter(a => a.status === 'bloqueado').length;
      const pending = modActs.filter(a => a.status === 'pendiente').length;
      const overdue = modActs.filter(a =>
        a.plannedEndDate && new Date(a.plannedEndDate).getTime() < today.getTime() && a.status !== 'completado').length;
      const health  = blocked > 0 || overdue > 0 ? 'critico'
                    : done === total && total > 0  ? 'completado'
                    : inProg > 0                   ? 'en_progreso'
                    : 'pendiente';
      return {
        id: m.id, name: m.name,
        progressPercent: Number(m.progressPercent ?? 0),
        phaseCount: m.phases.length,
        activities: { total, done, inProgress: inProg, blocked, pending, overdue },
        health,
      };
    });

    // ── Resumen de visitas ────────────────────────────────────────────────────
    const visitsDetail = {
      total:     bloques.length,
      confirmed: bloques.filter(b => b.status === 'confirmado').length,
      pending:   bloques.filter(b => b.status === 'pendiente').length,
      cancelled: bloques.filter(b => b.status === 'cancelado').length,
      completed: bloques.filter(b => b.status === 'completado').length,
      upcoming:  bloques.filter(b => new Date(b.fecha).getTime() > today.getTime() && b.status !== 'cancelado').length,
    };

    // ── Línea de tiempo ───────────────────────────────────────────────────────
    const timelineDetail = (os.startDate && os.endDate) ? (() => {
      const start     = new Date(os.startDate).getTime();
      const end       = new Date(os.endDate).getTime();
      const now       = today.getTime();
      const totalMs   = Math.max(1, end - start);
      const elapsedMs = now - start;
      return {
        daysElapsed:         Math.max(0, Math.floor(elapsedMs / 86400000)),
        daysRemaining:       Math.max(0, Math.floor((end - now) / 86400000)),
        totalDays:           Math.floor(totalMs / 86400000),
        timeProgressPercent: Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))),
      };
    })() : null;

    // ── Resumen de actividades ────────────────────────────────────────────────
    const activitySummary = {
      total:      totalActs,
      done:       doneActs,
      inProgress: allActivities.filter(a => a.status === 'en_progreso').length,
      pending:    allActivities.filter(a => a.status === 'pendiente').length,
      blocked:    blockedActs.length,
      overdue:    overdueActs.length,
    };

    // ── Predicciones ─────────────────────────────────────────────────────────
    let predictions: Record<string, any> = {};
    let delayDaysPred: number | null = null;
    if (project && totalActs > 0 && os.startDate) {
      const daysSinceStart = Math.max(1,
        Math.floor((today.getTime() - new Date(os.startDate).getTime()) / 86400000));
      const ratePerDay     = doneActs / daysSinceStart;
      const ratePerWeek    = Math.round(ratePerDay * 7 * 10) / 10;
      const remaining      = totalActs - doneActs;
      const daysToComplete = ratePerDay > 0 ? remaining / ratePerDay : null;
      const estimatedEnd   = daysToComplete != null
        ? new Date(today.getTime() + daysToComplete * 86400000)
        : null;
      delayDaysPred = estimatedEnd && os.endDate
        ? Math.floor((estimatedEnd.getTime() - new Date(os.endDate).getTime()) / 86400000)
        : null;

      let successProbability: number | null = null;
      if (os.startDate && os.endDate) {
        const totalMs  = new Date(os.endDate).getTime() - new Date(os.startDate).getTime();
        const elapsed  = today.getTime() - new Date(os.startDate).getTime();
        const timePct  = totalMs > 0 ? Math.min(1, elapsed / totalMs) : 0;
        const progPct  = Number(project.progressPercent ?? 0) / 100;
        if (timePct > 0) {
          const ratio = progPct / timePct;
          successProbability = Math.max(0, Math.min(100,
            Math.round(ratio * 60 + (delayDaysPred != null && delayDaysPred <= 0 ? 25 : 0))));
        }
      }

      predictions = {
        ritmoActividadesSemana: ratePerWeek,
        actividadesCompletadas: doneActs,
        actividadesRestantes:   remaining,
        totalActividades:       totalActs,
        fechaEstimadaFin:       estimatedEnd?.toISOString() ?? null,
        diasDeRetraso:          delayDaysPred,
        probabilidadExito:      successProbability,
      };
    }

    // ── Recomendaciones ───────────────────────────────────────────────────────
    const recommendations: Array<{ priority: 'alta' | 'media' | 'baja'; titulo: string; accion: string }> = [];
    for (const alert of alerts) {
      if (alert.tipo === 'os_vencida') {
        recommendations.push({ priority: 'alta',
          titulo: 'Regularizar plazo de la OS',
          accion: 'Solicitar extensión formal del contrato o marcar como completada si el trabajo ya terminó.' });
      } else if (alert.tipo === 'actividades_vencidas') {
        recommendations.push({ priority: 'alta',
          titulo: 'Actualizar actividades con plazo vencido',
          accion: `Revisar y reasignar fechas de ${overdueActs.length} actividad${overdueActs.length !== 1 ? 'es' : ''} vencida${overdueActs.length !== 1 ? 's' : ''}. Puede requerir comunicación con el cliente para ajustar expectativas.` });
      } else if (alert.tipo === 'actividades_bloqueadas') {
        recommendations.push({ priority: 'alta',
          titulo: 'Desbloquear actividades críticas',
          accion: `Identificar el impedimento que frena ${blockedActs.length} actividad${blockedActs.length !== 1 ? 'es' : ''} y resolverlo de inmediato. Puede requerir coordinación con el cliente o equipo técnico.` });
      } else if (alert.tipo === 'tickets_devueltos') {
        recommendations.push({ priority: 'media',
          titulo: 'Revisar requerimientos devueltos',
          accion: `Analizar los ${reqDevueltos} requerimiento${reqDevueltos !== 1 ? 's' : ''} devuelto${reqDevueltos !== 1 ? 's' : ''} y corregir o clarificar antes de continuar la implementación.` });
      } else if (alert.tipo === 'sin_movimiento') {
        recommendations.push({ priority: 'media',
          titulo: 'Reactivar el seguimiento de la OS',
          accion: 'Registrar avance en el historial, contactar al cliente o programar una visita de seguimiento para retomar el proceso.' });
      } else if (alert.tipo === 'visita_cancelada_sin_reagendar') {
        recommendations.push({ priority: 'media',
          titulo: 'Reagendar visita cancelada',
          accion: 'Confirmar una nueva fecha con el cliente para continuar el proceso de implementación sin perder momentum.' });
      } else if (alert.tipo === 'sin_proyecto') {
        recommendations.push({ priority: 'media',
          titulo: 'Crear proyecto de implementación',
          accion: 'Vincular un proyecto a esta OS desde Implementación › Proyectos, con módulos, fases y actividades para poder medir el avance.' });
      } else if (alert.tipo === 'progreso_bajo') {
        recommendations.push({ priority: 'media',
          titulo: 'Incrementar el ritmo de trabajo',
          accion: 'Aumentar la frecuencia de visitas, revisar la asignación de recursos o ajustar el alcance del proyecto con el cliente.' });
      }
    }
    if (delayDaysPred != null && delayDaysPred > 7) {
      recommendations.push({ priority: 'media',
        titulo: 'Retraso proyectado detectado',
        accion: `Al ritmo actual el proyecto finalizará con ${delayDaysPred} días de retraso. Considere aumentar los recursos disponibles o negociar el alcance con el cliente.` });
    }
    if (alerts.length === 0) {
      recommendations.push({ priority: 'baja',
        titulo: 'Implementación en buen camino',
        accion: 'Mantener el ritmo actual y continuar documentando los avances en el historial de la OS para garantizar trazabilidad completa.' });
    }

    // ── Nivel de riesgo global ───────────────────────────────────────────────
    const criticos     = alerts.filter(a => a.level === 'critico').length;
    const advertencias = alerts.filter(a => a.level === 'advertencia').length;
    const riskLevel    = criticos >= 1 ? 'alto' : advertencias >= 1 ? 'medio' : 'normal';

    // ── Atribución de retraso ────────────────────────────────────────────────
    const visitasCanceladas  = bloques.filter(b => b.status === 'cancelado').length;
    // Señales de cliente: tickets devueltos + visitas canceladas + bloqueos por cliente
    const clientSignalScore  = reqDevueltos + visitasCanceladas + blockedByBreakdown.cliente;
    // Señales de implementador: bloqueos por desarrollo/implementador + vencidas
    const implSignalScore    = blockedByBreakdown.desarrollo + blockedByBreakdown.implementador + overdueActs.length;
    const totalSignals       = clientSignalScore + implSignalScore;
    const delayAttribution   = totalSignals === 0 && totalClientDelayDays === 0 ? null : {
      clientePct:      totalSignals > 0 ? Math.round((clientSignalScore  / totalSignals) * 100) : 0,
      implementadorPct:totalSignals > 0 ? Math.round((implSignalScore    / totalSignals) * 100) : 0,
      clientDelayDays: totalClientDelayDays,
      blockedByBreakdown,
      signals: {
        ticketsDevueltos:    reqDevueltos,
        visitasCanceladas,
        actividadesBloqueadas: blockedActs.length,
        actividadesVencidas:   overdueActs.length,
      },
    };

    return {
      os: {
        id: os.id, osNumber: os.osNumber, product: os.product, status: os.status,
        startDate: os.startDate, endDate: os.endDate, client: os.client,
      },
      project: project ? {
        name: project.name, status: project.status,
        progressPercent: Number(project.progressPercent ?? 0),
        startDate: project.startDate, endDate: project.endDate,
      } : null,
      riskLevel,
      alerts,
      predictions,
      modules:          modulesDetail,
      visits:           visitsDetail,
      timeline:         timelineDetail,
      activitySummary,
      recommendations,
      tickets:          ticketsDetail,
      delayAttribution,
    };
  }

  async delete(companyId: string, id: string) {
    const os = await this.findOne(companyId, id);

    // Verificar dependencias que bloquean el delete (onDelete: NoAction en DB)
    const [project, reqCount] = await Promise.all([
      this.prisma.project.findUnique({ where: { serviceOrderId: id }, select: { id: true, name: true } }),
      this.prisma.requerimiento.count({ where: { serviceOrderId: id } }),
    ]);

    const bloqueos: string[] = [];
    if (project)    bloqueos.push(`el proyecto "${project.name}"`);
    if (reqCount > 0) bloqueos.push(`${reqCount} requerimiento${reqCount !== 1 ? 's' : ''}`);

    if (bloqueos.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la OS "${os.osNumber}" porque tiene: ${bloqueos.join(' y ')}. Elimina primero esos registros.`,
      );
    }

    // ServiceOrderImplementer y ServiceOrderHistory tienen onDelete: Cascade en DB
    try {
      return await this.prisma.serviceOrder.delete({ where: { id } });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('Foreign key') || msg.includes('REFERENCE') || err?.code === 'P2003') {
        throw new BadRequestException(
          `No se puede eliminar la OS "${os.osNumber}" porque tiene registros asociados en la base de datos.`,
        );
      }
      throw err;
    }
  }

  async sendWeeklyActivities(
    companyId: string,
    osId: string,
    dto: { destinatarios: string[]; asunto?: string; startDate: Date; endDate: Date; reportType?: 'ejecutivo' | 'completo' },
  ): Promise<void> {
    const reportType = dto.reportType ?? 'ejecutivo';
    const data = reportType === 'completo'
      ? await this.getFullReport(companyId, osId)
      : await this.getExecutiveReport(companyId, osId);
    const { company, os } = data;
    const pc  = company?.primaryColor ?? '#1E3A5F';
    const nom = company?.commercialName ?? company?.name ?? '';

    const fmt = (d: any) => d
      ? new Date(d).toLocaleDateString('es-CO', { timeZone: 'UTC', day:'2-digit', month:'2-digit', year:'numeric' })
      : '—';

    const allActs = (data.project?.modules ?? []).flatMap((m: any) =>
      (m.phases ?? []).flatMap((p: any) =>
        (p.activities ?? []).map((a: any) => ({ ...a, moduleName: m.name, phaseName: p.name })),
      ),
    );

    const acts = allActs.filter((a: any) => {
      const date = a.actualEndDate ?? a.updatedAt;
      if (!date) return false;
      const d = new Date(date);
      return d >= dto.startDate && d <= dto.endDate;
    });

    const startLabel = fmt(dto.startDate.toISOString());
    const endLabel   = fmt(dto.endDate.toISOString());
    const pdfLabel   = reportType === 'completo' ? 'Informe con Actas' : 'Informe Ejecutivo';
    const osName     = os.product ?? os.osNumber;
    const asunto = dto.asunto
      ?? `${pdfLabel} – ${osName} – Semana ${startLabel}/${endLabel}`;

    // Generate PDF via Puppeteer to match InformeConActas/InformeEjecutivo visual
    const pdf = await this.generatePdfPuppeteer(data, reportType === 'completo');
    const filename = `${pdfLabel.replace(/ /g,'_')}_${osName.replace(/[^a-zA-Z0-9-]/g,'_')}_Semana_${startLabel.replace(/\//g,'-')}.pdf`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
  <div style="font-size:16px;font-weight:800;">${nom}</div>
  <div style="font-size:12px;opacity:0.85;margin-top:4px;">${pdfLabel} · ${osName}</div>
  <div style="font-size:11px;opacity:0.7;margin-top:2px;">Semana ${startLabel} – ${endLabel}</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},#60a5fa);"></td></tr>
<tr><td style="padding:24px 28px;">
  <p style="font-size:13px;color:#374151;margin:0 0 8px;">Adjunto encontrará el <b>${pdfLabel}</b> correspondiente a la semana del ${startLabel} al ${endLabel}.</p>
  <p style="font-size:12px;color:#6b7280;margin:0;">${acts.length} actividad(es) registrada(s) en el período.</p>
</td></tr>
<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;border-radius:0 0 8px 8px;">
  ${nom} · Reporte semanal generado automáticamente
</td></tr>
</table></td></tr></table></body></html>`;

    await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html, [
      { filename, content: pdf, contentType: 'application/pdf' },
    ]);
  }

  async sendPeriodReport(
    companyId: string,
    osId: string,
    dto: { destinatarios: string[]; asunto?: string; startDate: Date; endDate: Date; periodLabel: string; period?: 'quincenal' | 'mensual' },
  ): Promise<void> {
    const isMensual = dto.period === 'mensual';

    const fmt = (d: any) => d
      ? new Date(d).toLocaleDateString('es-CO', { timeZone: 'UTC', day:'2-digit', month:'2-digit', year:'numeric' })
      : '—';

    if (isMensual) {
      // Full report with actas
      const data = await this.getFullReport(companyId, osId);
      const { company, os } = data as any;
      const pc  = company?.primaryColor ?? '#1E3A5F';
      const nom = company?.commercialName ?? company?.name ?? '';

      const pdf = await this.generatePdfPuppeteer(data, true);
      const osNameM = os.product ?? os.osNumber;
      const asunto = dto.asunto ?? `Informe con Actas – ${osNameM} – ${dto.periodLabel}`;
      const filename = `Informe_con_Actas_${osNameM.replace(/[^a-zA-Z0-9-]/g, '_')}_${dto.periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
  <div style="font-size:16px;font-weight:800;">${nom}</div>
  <div style="font-size:12px;opacity:0.85;margin-top:4px;">Informe con Actas · ${osNameM}</div>
  <div style="font-size:11px;opacity:0.7;margin-top:2px;">${dto.periodLabel}</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},#60a5fa);"></td></tr>
<tr><td style="padding:24px 28px;">
  <p style="font-size:13px;color:#374151;margin:0 0 8px;">Adjunto encontrará el <b>Informe con Actas</b> correspondiente al período <b>${dto.periodLabel}</b>.</p>
  <p style="font-size:12px;color:#6b7280;margin:0;">Este informe incluye el resumen ejecutivo y todas las actas de implementación diligenciadas.</p>
</td></tr>
<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;border-radius:0 0 8px 8px;">
  ${nom} · Reporte mensual generado automáticamente el ${fmt(new Date().toISOString())}
</td></tr>
</table></td></tr></table></body></html>`;

      await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html, [
        { filename, content: pdf, contentType: 'application/pdf' },
      ]);
    } else {
      // Quincenal (día 15): also sends "Informe con Actas" via Puppeteer
      const data = await this.getFullReport(companyId, osId);
      const { company, os } = data as any;
      const pc  = company?.primaryColor ?? '#1E3A5F';
      const nom = company?.commercialName ?? company?.name ?? '';

      const pdf = await this.generatePdfPuppeteer(data, true);
      const osNameQ = os.product ?? os.osNumber;
      const asunto = dto.asunto ?? `Informe con Actas – Quincenal – ${osNameQ} – ${dto.periodLabel}`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
  <div style="font-size:16px;font-weight:800;">${nom}</div>
  <div style="font-size:12px;opacity:0.85;margin-top:4px;">Informe con Actas – Quincenal · ${osNameQ}</div>
  <div style="font-size:11px;opacity:0.7;margin-top:2px;">${dto.periodLabel}</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},#60a5fa);"></td></tr>
<tr><td style="padding:24px 28px;">
  <p style="font-size:13px;color:#374151;margin:0 0 8px;">Adjunto encontrará el <b>Informe con Actas</b> del avance quincenal, período <b>${dto.periodLabel}</b>.</p>
  <p style="font-size:12px;color:#6b7280;margin:0;">Este informe incluye el resumen ejecutivo y todas las actas de implementación diligenciadas.</p>
</td></tr>
<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;border-radius:0 0 8px 8px;">
  ${nom} · Reporte quincenal generado automáticamente
</td></tr>
</table></td></tr></table></body></html>`;

      const filename = `Informe_con_Actas_Quincenal_${osNameQ.replace(/[^a-zA-Z0-9-]/g, '_')}_${dto.periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html, [
        { filename, content: pdf, contentType: 'application/pdf' },
      ]);
    }
  }

  private async generateActivitiesPdf(
    companyName: string,
    osNumber: string,
    periodLabel: string,
    activities: any[],
    primaryColor: string,
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true,
        info: { Title: `Actividades ${osNumber} – ${periodLabel}` } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('error', reject);

      const pc = primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`;
      const toRgb = (hex: string): [number, number, number] => {
        const h = hex.replace('#', '');
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
      };
      const [pr, pg, pb] = toRgb(pc);
      const fmt = (d: any) => d
        ? new Date(d).toLocaleDateString('es-CO', { timeZone:'UTC', day:'2-digit', month:'2-digit', year:'2-digit' })
        : '—';

      // ── Header ──────────────────────────────────────────────────────────────
      doc.rect(50, 50, 495, 60).fill([pr, pg, pb]);
      doc.font('Helvetica-Bold').fontSize(15).fillColor('white')
         .text(companyName, 60, 62, { width: 480 });
      doc.font('Helvetica').fontSize(9).fillColor('white')
         .text(`Informe de Actividades · OS: ${osNumber}`, 60, 82, { width: 480 });
      doc.font('Helvetica').fontSize(8).fillColor('white')
         .text(`Período: ${periodLabel}  ·  ${activities.length} actividad(es)`, 60, 96, { width: 480 });
      doc.moveDown(0.5);

      // Gradient line
      doc.rect(50, 112, 495, 3).fill([96, 165, 250]);
      doc.y = 124;

      // ── Table header ────────────────────────────────────────────────────────
      const COL = { x: [50,120,260,350,430,490], w: [68,138,88,78,58,54] };
      const HDRS = ['Código','Actividad','Módulo','Fase','Estado','Fecha'];

      const drawTableHeader = (y: number) => {
        doc.rect(50, y, 495, 17).fill([55,65,81]);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('white');
        HDRS.forEach((h, i) => doc.text(h, COL.x[i]+3, y+5, { width: COL.w[i]-4, lineBreak: false }));
        return y + 17;
      };

      let y = drawTableHeader(doc.y);

      // ── Rows ────────────────────────────────────────────────────────────────
      const STATUS_LABEL: Record<string,string> = {
        completado:'Completado', en_progreso:'En Progreso', bloqueado:'Bloqueado', pendiente:'Pendiente',
      };
      const STATUS_COLOR: Record<string,[number,number,number]> = {
        completado:[6,95,70], en_progreso:[30,64,175], bloqueado:[153,27,27], pendiente:[107,114,128],
      };

      activities.forEach((act, idx) => {
        if (y > 770) {
          doc.addPage();
          y = drawTableHeader(50);
        }
        const bg: [number,number,number] = idx % 2 === 0 ? [249,250,251] : [255,255,255];
        doc.rect(50, y, 495, 17).fill(bg);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor([55,65,81])
           .text(act.code ?? '—', COL.x[0]+3, y+5, { width: COL.w[0]-4, lineBreak:false });
        doc.font('Helvetica').fontSize(7.5).fillColor([55,65,81])
           .text(act.name ?? '—', COL.x[1]+3, y+5, { width: COL.w[1]-4, lineBreak:false, ellipsis:true })
           .text(act.moduleName ?? '—', COL.x[2]+3, y+5, { width: COL.w[2]-4, lineBreak:false, ellipsis:true })
           .text(act.phaseName ?? '—', COL.x[3]+3, y+5, { width: COL.w[3]-4, lineBreak:false, ellipsis:true });
        const sc = STATUS_COLOR[act.status] ?? [107,114,128];
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(sc)
           .text(STATUS_LABEL[act.status] ?? act.status, COL.x[4]+3, y+5, { width: COL.w[4]-4, lineBreak:false });
        doc.font('Helvetica').fontSize(7.5).fillColor([55,65,81])
           .text(fmt(act.actualEndDate ?? act.plannedEndDate), COL.x[5]+3, y+5, { width: COL.w[5]-4, lineBreak:false });
        y += 17;
      });

      if (activities.length === 0) {
        doc.font('Helvetica').fontSize(11).fillColor([156,163,175])
           .text('No se registraron actividades en este período.', 50, y+16, { width:495, align:'center' });
      }

      // ── Page footers ────────────────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(7.5).fillColor([156,163,175])
           .text(
             `${companyName}  ·  OS: ${osNumber}  ·  ${periodLabel}  ·  Página ${i+1} de ${range.count}`,
             50, 818, { width: 495, align: 'center' },
           );
        doc.moveTo(50, 812).lineTo(545, 812).strokeColor([229,231,235]).stroke();
      }

      doc.flushPages();
      doc.end();
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // ── transformPdfData: maps raw DB fields → InformeData shape expected by react-pdf ──
  private transformPdfData(raw: any): any {
    const { company, os, project, actas, notes, personalCapacitado,
            personalEnProceso, personalPendiente, requerimientos, generatedAt } = raw;

    // 1. Flatten project modules/phases/activities into os.projectTasks
    const projectTasks = (project?.modules ?? []).flatMap((mod: any) =>
      (mod.phases ?? []).flatMap((phase: any) =>
        (phase.activities ?? []).map((act: any) => ({
          id:                   act.id,
          module:               mod.name,
          fase:                 phase.name,
          phase:                phase.name,
          code:                 act.code,
          taskName:             act.name,
          status:               act.status,
          completionPercentage: act.progressPercent ?? 0,
          assignedUser:         act.assignedTo ?? null,
          plannedStartDate:     act.plannedStartDate,
          plannedEndDate:       act.plannedEndDate,
          actualEndDate:        act.actualEndDate,
        })),
      ),
    );

    // 2. Transform actas — rename fields to match InformeData interface
    const transformedActas = (actas ?? []).map((a: any) => ({
      ...a,
      actaType:    a.type    ?? a.actaType,
      actaNumber:  a.numero  ?? a.actaNumber,
      visitDate:   a.fecha   ?? a.visitDate,
      city:        a.municipio?.nombreMunicipio ?? a.city,
      module:      a.modulo?.name ?? a.module,
      sede:        a.sede,
      startTime:   a.horaInicio ?? a.startTime,
      endTime:     a.horaFin    ?? a.endTime,
      // signatures: map firmantes to unified shape
      signatures: (a.firmantes ?? a.signatures ?? []).map((f: any) => ({
        id:            f.id ?? f.nombre,
        fullName:      f.nombre    ?? f.fullName,
        jobTitle:      f.cargo     ?? f.jobTitle,
        signatureData: f.signatureData ?? null,
        signedAt:      f.signedAt  ?? null,
        empresa:       f.empresa   ?? null,
        signerType:    f.signerType ?? null,
      })),
      // participants: keep as-is (field names match)
      participants:  a.participantes ?? a.participants ?? [],
      // activities in acta visita
      actividades:   (a.actaActividades ?? []).map((aa: any) => ({
        id:       aa.id,
        module:   aa.activity?.phase?.projectModule?.name ?? '',
        fase:     aa.activity?.phase?.name ?? '',
        modulo:   aa.activity?.phase?.projectModule?.name ?? '',
        codigo:   aa.activity?.code ?? '',
        code:     aa.activity?.code ?? '',
        actividad:aa.activity?.name ?? '',
        taskName: aa.activity?.name ?? '',
        status:   aa.activity?.status ?? aa.status,
        estado:   aa.activity?.status ?? aa.status,
      })),
      // Visit dates
      visitDates:    (a.fechasVisita ?? []).map((fv: any) => ({
        date:      fv.fecha,
        startTime: fv.horaInicio,
        endTime:   fv.horaFin,
      })),
      // Compromisos — field names already match (compromiso, responsable, estado)
      compromisos: (a.compromisos ?? []).map((c: any) => ({
        ...c,
        compromiso:  c.compromiso  ?? c.description,
        responsable: c.responsable ?? (c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : null)
                     ?? (c.clientStaff ? `${c.clientStaff.firstName} ${c.clientStaff.lastName}` : null),
        estado:      c.estado ?? c.status,
      })),
      // Acciones
      acciones: (a.acciones ?? []).map((ac: any) => ({
        ...ac,
        accion:      ac.accion      ?? ac.description,
        responsable: ac.responsable ?? ac.assignedTo,
        fechaLimite: ac.fechaLimite ?? ac.dueDate,
      })),
    }));

    // 3. Transform notes — exclude internal, map reason → title
    const transformedNotes = (notes ?? [])
      .filter((n: any) => (n.noteType ?? 'general') !== 'interna')
      .map((n: any) => ({
        ...n,
        title:       n.reason         ?? n.title       ?? '(Sin título)',
        description: n.noteMitigation ?? n.description ?? null,
        noteLevel:   n.noteLevel      ?? 'media',
        noteType:    n.noteType       ?? 'general',
        noteSubtype: n.noteSubtype    ?? null,
        resolved:    n.resolved       ?? false,
      }));

    return {
      company: {
        ...company,
        secondaryColor: company?.secondaryColor ?? '#2563EB',
      },
      os: {
        ...os,
        projectTasks,
      },
      project,
      actas:              transformedActas,
      notes:              transformedNotes,
      requerimientos:     requerimientos ?? [],
      personalCapacitado: personalCapacitado ?? [],
      personalEnProceso:  personalEnProceso  ?? [],
      personalPendiente:  personalPendiente  ?? [],
      generatedAt:        generatedAt ?? new Date().toISOString(),
    };
  }

  // ── generatePdfPuppeteer: delegates to Next.js /api/generate-pdf (react-pdf, no Chromium) ──
  async generatePdfPuppeteer(data: any, includeActas = false): Promise<Buffer> {
    const { os } = data as any;

    // Cache check — return immediately if data hasn't changed
    const cacheKey = `${os.id}:${includeActas ? 'completo' : 'ejecutivo'}`;
    const hash     = this.dataHash(data);
    const cached   = this.pdfCache.get(cacheKey);
    if (cached?.hash === hash) {
      console.log(`[PDF cache] hit for ${cacheKey}`);
      return cached.buffer;
    }

    // Transform raw DB shape → InformeData shape before sending to react-pdf
    const pdfData = this.transformPdfData(data);

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const res = await fetch(`${frontendUrl}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: pdfData, includeActas }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`[generate-pdf] HTTP ${res.status}: ${msg}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    this.pdfCache.set(cacheKey, { hash, buffer });
    console.log(`[PDF cache] stored ${cacheKey} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return buffer;
  }

  private buildPrintHtml(data: any, includeActas = false): string {
    const { company, os, project, actas,
            personalCapacitado, personalEnProceso, personalPendiente } = data as any;
    const pc  = company?.primaryColor ?? '#1E3A5F';
    const nom = company?.commercialName ?? company?.name ?? '';

    const esc = (s: any) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const fmt = (d: any) => !d ? '—'
      : new Date(d).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' });

    const band = (n: string, t: string) =>
      `<div style="background:${pc};color:#fff;font-weight:700;font-size:10.5pt;padding:7px 10px;margin-top:16px;">${n}. ${t.toUpperCase()}</div>`;

    const kv = (k: string, v: string, shade = false) =>
      `<tr${shade ? ' style="background:#f9fafb;"' : ''}>` +
      `<td style="padding:5px 10px;font-weight:700;font-size:9pt;color:#374151;width:38%;white-space:nowrap;">${esc(k)}</td>` +
      `<td style="padding:5px 10px;font-size:9pt;">${v}</td></tr>`;

    const th = (...cols: string[]) =>
      `<tr>${cols.map(c =>
        `<th style="padding:5px 8px;background:#f3f4f6;color:#374151;font-weight:700;font-size:9pt;text-align:left;border-bottom:1px solid #e5e7eb;">${esc(c)}</th>`,
      ).join('')}</tr>`;

    const subLabel = (t: string) =>
      `<div style="font-weight:700;font-size:9pt;color:#374151;margin:10px 0 4px;text-transform:uppercase;">${esc(t)}</div>`;

    const STATUS_COLOR: Record<string, string> = {
      completado: '#065f46', en_progreso: '#1e40af', pendiente: '#92400e',
      completada: '#065f46', borrador: '#92400e', finalizado: '#065f46',
      firmada: '#065f46', cancelada: '#6b7280', cumplido: '#065f46',
    };
    const TIPO_LABEL: Record<string, string> = {
      inicio: 'Acta de Inicio', visita: 'Acta de Visita',
      capacitacion: 'Acta de Capacitación', cierre: 'Acta de Cierre',
      entrega_soporte: 'Entrega a Soporte',
    };

    // Computed values
    const modules  = project?.modules ?? [];
    const allActs  = modules.flatMap((m: any) => (m.phases ?? []).flatMap((p: any) => p.activities ?? []));
    const doneActs = allActs.filter((a: any) => a.status === 'completado').length;
    const progress = allActs.length > 0 ? Math.round(doneActs / allActs.length * 100) : 0;
    const dias     = os.startDate && os.endDate
      ? Math.round((new Date(os.endDate).getTime() - new Date(os.startDate).getTime()) / 86400000) + ' días'
      : '—';

    const leaders: Array<{ rol: string; p: any }> = [];
    if (os.clinicalLeader)  leaders.push({ rol: 'Líder Asistencial', p: os.clinicalLeader });
    if (os.financialLeader) leaders.push({ rol: 'Líder Financiero',  p: os.financialLeader });
    (os.implementers ?? []).forEach((u: any) => leaders.push({ rol: 'Implementador', p: u }));

    const allPersonal = [
      ...(personalCapacitado  ?? []).map((p: any) => ({ ...p, estado: 'Capacitado',  clr: '#065f46' })),
      ...(personalEnProceso   ?? []).map((p: any) => ({ ...p, estado: 'En Proceso',  clr: '#1e40af' })),
      ...(personalPendiente   ?? []).map((p: any) => ({ ...p, estado: 'Pendiente',   clr: '#92400e' })),
    ];

    const actasAll: any[] = actas ?? [];

    let h = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #374151; }
table { border-collapse: collapse; width: 100%; }
@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
</style></head><body>`;

    // Subtitle
    h += `<div style="font-size:9pt;color:#6b7280;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">
      ${esc(os.client?.businessName)}  ·  OS: ${esc(os.osNumber)}  ·  ${esc(os.product)}
    </div>`;

    // §1 OS data
    h += band('1', 'Datos de la Orden de Servicio');
    h += `<table>`;
    h += kv('NO. ORDEN',          esc(os.osNumber));
    h += kv('CLIENTE',            `${esc(os.client?.businessName ?? '—')} · NIT: ${esc(os.client?.nit ?? '—')}`, true);
    h += kv('PRODUCTO / SERVICIO',esc(os.product ?? '—'));
    h += kv('ESTADO',             esc(os.status ?? '—'), true);
    h += kv('FECHA INICIO',       fmt(os.startDate));
    h += kv('FECHA FIN',          fmt(os.endDate), true);
    h += kv('DURACIÓN',           esc(dias));
    if (os.ticketRubi) h += kv('TICKET RUBÍ', esc(os.ticketRubi), true);
    h += `</table>`;

    // §2 Team
    if (leaders.length > 0) {
      h += band('2', 'Equipo del Proyecto');
      h += `<table>${th('Rol', 'Nombre', 'Email')}`;
      leaders.forEach(({ rol, p }, i) => {
        h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
          <td style="padding:5px 8px;font-size:9pt;">${esc(rol)}</td>
          <td style="padding:5px 8px;font-size:9pt;">${esc(`${p.firstName} ${p.lastName}`)}</td>
          <td style="padding:5px 8px;font-size:9pt;color:#6b7280;">${esc(p.email ?? '—')}</td>
        </tr>`;
      });
      h += `</table>`;
    }

    // §3 Project progress
    if (project) {
      h += band('3', 'Avance del Proyecto');
      h += `<table>`;
      h += kv('NOMBRE',   esc(project.name ?? '—'));
      h += kv('ESTADO',   esc(project.status ?? '—'), true);
      h += kv('PROGRESO', esc(`${progress}% (${doneActs}/${allActs.length} actividades completadas)`));
      h += kv('INICIO',   fmt(project.startDate), true);
      h += kv('FIN',      fmt(project.endDate));
      h += `</table>`;
      h += `<div style="margin:6px 0 10px;height:6px;background:#e5e7eb;border-radius:3px;">
        <div style="height:6px;background:${pc};border-radius:3px;width:${progress}%;"></div>
      </div>`;
      if (modules.length > 0) {
        h += `<table>${th('Módulo', 'Progreso', 'Fases', 'Actividades')}`;
        modules.forEach((m: any, i: number) => {
          const ma   = (m.phases ?? []).flatMap((p: any) => p.activities ?? []);
          const md   = ma.filter((a: any) => a.status === 'completado').length;
          const mpct = ma.length > 0 ? Math.round(md / ma.length * 100) : 0;
          h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
            <td style="padding:5px 8px;font-size:9pt;">${esc(m.name)}</td>
            <td style="padding:5px 8px;font-size:9pt;">${mpct}%</td>
            <td style="padding:5px 8px;font-size:9pt;">${m.phases?.length ?? 0}</td>
            <td style="padding:5px 8px;font-size:9pt;">${md}/${ma.length}</td>
          </tr>`;
        });
        h += `</table>`;
      }
    }

    // §4 Actas summary
    h += band('4', 'Actas del Proyecto');
    if (actasAll.length > 0) {
      h += `<table>${th('Tipo', 'Número', 'Fecha', 'Ciudad', 'Estado', 'Firmas')}`;
      actasAll.forEach((a: any, i: number) => {
        const firmados = (a.firmantes ?? []).filter((f: any) => f.signed || f.signedAt || f.signatureData).length;
        const stColor  = STATUS_COLOR[(a.estado ?? '').toLowerCase()] ?? '#374151';
        h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
          <td style="padding:5px 8px;font-size:9pt;">${esc(TIPO_LABEL[a.tipo] ?? a.tipo)}</td>
          <td style="padding:5px 8px;font-size:9pt;">${esc(a.numeroActa ?? '—')}</td>
          <td style="padding:5px 8px;font-size:9pt;">${fmt(a.fecha)}</td>
          <td style="padding:5px 8px;font-size:9pt;">${esc(a.municipio?.nombre ?? a.ciudad ?? '—')}</td>
          <td style="padding:5px 8px;font-size:9pt;color:${stColor};">${esc(a.estado ?? '—')}</td>
          <td style="padding:5px 8px;font-size:9pt;">${firmados}/${(a.firmantes ?? []).length}</td>
        </tr>`;
      });
      h += `</table>`;
    } else {
      h += `<p style="font-size:9pt;color:#9ca3af;padding:8px 10px;">No hay actas registradas.</p>`;
    }

    // §5 Training
    if (allPersonal.length > 0) {
      h += band('5', 'Estado de Capacitación del Personal');
      h += `<table>${th('Nombre', 'Cargo', 'Área', 'Estado')}`;
      allPersonal.forEach((p: any, i: number) => {
        h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
          <td style="padding:5px 8px;font-size:9pt;">${esc(`${p.firstName} ${p.lastName}`)}</td>
          <td style="padding:5px 8px;font-size:9pt;">${esc(p.jobTitle ?? 'Administrador')}</td>
          <td style="padding:5px 8px;font-size:9pt;">${esc(p.area ?? '—')}</td>
          <td style="padding:5px 8px;font-size:9pt;color:${p.clr};">${esc(p.estado)}</td>
        </tr>`;
      });
      h += `</table>`;
    }

    // ── Acta Annexes ────────────────────────────────────────────────────────
    if (includeActas && actasAll.length > 0) {
      h += `<div style="page-break-before:always;"></div>`;
      h += `<div style="background:${pc};color:#fff;padding:20px 24px;margin-bottom:0;">
        <div style="font-size:16pt;font-weight:700;">Anexo: Actas de Implementación</div>
        <div style="font-size:10pt;margin-top:6px;opacity:0.85;">
          ${esc(os.client?.businessName)} · OS: ${esc(os.osNumber)} · ${actasAll.length} acta(s)
        </div>
      </div>`;

      actasAll.forEach((acta: any, idx: number) => {
        const tipoLabel = TIPO_LABEL[acta.tipo] ?? acta.tipo;
        const firmados  = (acta.firmantes ?? []).filter((f: any) => f.signed || f.signedAt || f.signatureData).length;
        const totalF    = (acta.firmantes ?? []).length;
        const esBorrador = (acta.estado ?? '').toLowerCase() === 'borrador';

        h += `<div style="page-break-before:always;"></div>`;

        // Acta header band
        h += `<div style="background:#374151;color:#fff;padding:7px 10px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:10pt;">ANEXO ${idx + 1}: ${esc(tipoLabel.toUpperCase())} — ${esc(acta.numeroActa ?? '—')}</div>
          <div style="font-size:8pt;text-align:right;">
            ${fmt(acta.fecha)} · ${esc(acta.municipio?.nombre ?? acta.ciudad ?? '—')}
            ${esBorrador ? `<br><span style="background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;font-size:7pt;font-weight:700;">BORRADOR</span>` : ''}
          </div>
        </div>`;

        // Basic kv
        h += `<table>`;
        h += kv('FECHA',       fmt(acta.fecha));
        h += kv('CIUDAD',      esc(acta.municipio?.nombre ?? acta.ciudad ?? '—'), true);
        h += kv('LUGAR',       esc(acta.lugar ?? '—'));
        h += kv('CREADO POR',  acta.createdBy ? esc(`${acta.createdBy.firstName} ${acta.createdBy.lastName}`) : '—', true);
        h += kv('ESTADO',      esc(acta.estado ?? '—'));
        if (acta.tipo === 'visita' && acta.implementador) {
          h += kv('IMPLEMENTADOR', esc(`${acta.implementador.firstName} ${acta.implementador.lastName}`), true);
        }
        h += `</table>`;

        // Type-specific content
        if (acta.tipo === 'visita') {
          if (acta.actividades) {
            h += subLabel('Actividades Realizadas');
            h += `<div style="font-size:9pt;padding:4px 0 8px;">${esc(acta.actividades)}</div>`;
          }
          if ((acta.fechasVisita ?? []).length > 0) {
            h += subLabel('Fechas de Visita');
            h += `<table>${th('Fecha', 'Hora Inicio', 'Hora Fin')}`;
            (acta.fechasVisita as any[]).forEach((fv: any, i: number) => {
              h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
                <td style="padding:5px 8px;font-size:9pt;">${fmt(fv.fecha)}</td>
                <td style="padding:5px 8px;font-size:9pt;">${esc(fv.horaInicio ?? '—')}</td>
                <td style="padding:5px 8px;font-size:9pt;">${esc(fv.horaFin ?? '—')}</td>
              </tr>`;
            });
            h += `</table>`;
          }
          if ((acta.compromisos ?? []).length > 0) {
            h += subLabel('Compromisos');
            h += `<table>${th('#', 'Compromiso', 'Responsable', 'Estado')}`;
            (acta.compromisos as any[]).forEach((c: any, i: number) => {
              const cClr = STATUS_COLOR[(c.estado ?? '').toLowerCase()] ?? '#374151';
              h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
                <td style="padding:5px 8px;font-size:9pt;">${i + 1}</td>
                <td style="padding:5px 8px;font-size:9pt;">${esc(c.descripcion ?? '—')}</td>
                <td style="padding:5px 8px;font-size:9pt;">${c.responsable ? esc(`${c.responsable.firstName} ${c.responsable.lastName}`) : '—'}</td>
                <td style="padding:5px 8px;font-size:9pt;color:${cClr};">${esc(c.estado ?? '—')}</td>
              </tr>`;
            });
            h += `</table>`;
          }
          if ((acta.acciones ?? []).length > 0) {
            h += subLabel('Acciones');
            h += `<table>${th('Acción', 'Responsable', 'Fecha')}`;
            (acta.acciones as any[]).forEach((a: any, i: number) => {
              h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
                <td style="padding:5px 8px;font-size:9pt;">${esc(a.descripcion ?? '—')}</td>
                <td style="padding:5px 8px;font-size:9pt;">${a.responsable ? esc(`${a.responsable.firstName} ${a.responsable.lastName}`) : '—'}</td>
                <td style="padding:5px 8px;font-size:9pt;">${fmt(a.fechaLimite)}</td>
              </tr>`;
            });
            h += `</table>`;
          }
        }

        if (acta.tipo === 'inicio') {
          if (acta.asunto) { h += subLabel('Asunto'); h += `<div style="font-size:9pt;padding:4px 0 8px;">${esc(acta.asunto)}</div>`; }
          if (acta.objetivoGeneral) { h += subLabel('Objetivo General'); h += `<div style="font-size:9pt;padding:4px 0 8px;">${esc(acta.objetivoGeneral)}</div>`; }
          if (acta.alcance) { h += subLabel('Alcance'); h += `<div style="font-size:9pt;padding:4px 0 8px;">${esc(acta.alcance)}</div>`; }
        }

        if (acta.tipo === 'capacitacion') {
          if (acta.modulo?.name) { h += `<table>` + kv('MÓDULO', esc(acta.modulo.name)) + `</table>`; }
          if (acta.temas) { h += subLabel('Temas'); h += `<div style="font-size:9pt;padding:4px 0 8px;">${esc(acta.temas)}</div>`; }
          if ((acta.participantes ?? []).length > 0) {
            h += subLabel('Participantes');
            h += `<table>${th('Nombre', 'Cargo', 'Área')}`;
            (acta.participantes as any[]).forEach((p: any, i: number) => {
              h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
                <td style="padding:5px 8px;font-size:9pt;">${esc(`${p.firstName} ${p.lastName}`)}</td>
                <td style="padding:5px 8px;font-size:9pt;">${esc(p.jobTitle ?? '—')}</td>
                <td style="padding:5px 8px;font-size:9pt;">${esc(p.area ?? '—')}</td>
              </tr>`;
            });
            h += `</table>`;
          }
        }

        if (acta.tipo === 'cierre') {
          if (acta.descripcion) { h += subLabel('Descripción'); h += `<div style="font-size:9pt;padding:4px 0 8px;">${esc(acta.descripcion)}</div>`; }
          const modulesCierre: any[] = acta.contactos ?? [];
          if (modulesCierre.length > 0) {
            h += subLabel('Contactos');
            h += `<table>${th('Nombre', 'Cargo', 'Email')}`;
            modulesCierre.forEach((c: any, i: number) => {
              h += `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>
                <td style="padding:5px 8px;font-size:9pt;">${esc(`${c.firstName} ${c.lastName}`)}</td>
                <td style="padding:5px 8px;font-size:9pt;">${esc(c.jobTitle ?? '—')}</td>
                <td style="padding:5px 8px;font-size:9pt;color:#6b7280;">${esc(c.email ?? '—')}</td>
              </tr>`;
            });
            h += `</table>`;
          }
        }

        // Firmantes
        if ((acta.firmantes ?? []).length > 0) {
          h += subLabel(`Firmantes (${firmados}/${totalF} firmados)`);
          (acta.firmantes as any[]).forEach((f: any, i: number) => {
            const signed     = !!(f.signed || f.signedAt || f.signatureData);
            const persona    = f.user ?? f.contacto;
            const nombre     = persona ? `${persona.firstName} ${persona.lastName}` : (f.nombre ?? '—');
            const cargo      = persona?.jobTitle ?? '';
            const empresa    = f.contacto?.client?.businessName ?? '';
            const stClr      = signed ? '#065f46' : '#92400e';
            const stLabel    = signed ? `Firmado: ${fmt(f.signedAt)}` : 'Pendiente';
            h += `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:9pt;">
              <div>
                <strong>${i + 1}. ${esc(nombre)}</strong>
                ${cargo || empresa ? `<span style="color:#6b7280;"> · ${[cargo, empresa].filter(Boolean).map(s => esc(s)).join(' · ')}</span>` : ''}
              </div>
              <span style="color:${stClr};font-weight:700;font-size:8pt;white-space:nowrap;">${esc(stLabel)}</span>
            </div>`;
          });
        }
      });
    }

    h += `</body></html>`;
    return h;
  }

  // ── generateReportPdf: builds executive PDF; set includeActas=true for full report ──
  async generateReportPdf(data: any, includeActas = false): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;

    // Minimal checklist defaults for entrega_soporte actas
    const MODS_DEF = ['Archivo','Agenda médica','Consulta externa','Hospitalización','Inventario / Farmacia',
      'Facturación','Emisión electrónica','Dashboard Power BI','Contabilidad','Cartera y glosas','Tesorería','Nómina','Consentimiento','Compras']
      .map(l => ({ label: l, checked: false }));
    const INFRA_DEF = ['Certificado SSL','IP pública o VPN','Servidor OK','Estaciones OK','Internet ≥ 5 Mbps']
      .map(l => ({ label: l, checked: false }));
    const DOCS_DEF = ['Manuales de usuario','Video capacitaciones','Contrato / SLA','Certificados digitales']
      .map(l => ({ label: l, checked: false }));
    const EMIS_DEF = ['Emisión FEV/NE/DSA','XML UBL 2.1','Resolución y rangos','Firma electrónica',
      'CUFE/CUNE/CUDS','Representación gráfica','Anexos en factura','Portal proveedor','Descarga XML/PDF','Reenvío por correo']
      .map(l => ({ label: l, checked: false }));
    const parseChecklist = (json: string | null, def: {label:string;checked:boolean}[]) => {
      try { return json ? JSON.parse(json) : def; } catch { return def; }
    };

    return new Promise((resolve, reject) => {
      const { company, os, project, actas, requerimientos,
              personalCapacitado, personalEnProceso, personalPendiente, generatedAt } = data;

      const toRgb = (hex: string): [number,number,number] => {
        const h = (hex ?? '#1E3A5F').replace('#', '').padEnd(6, '0');
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
      };
      const [pr, pg, pb] = toRgb(company?.primaryColor ?? '#1E3A5F');
      const compName = company?.commercialName ?? company?.name ?? '';
      const osNum    = os.osNumber ?? '';
      const ML = 50; const PW = 595.28; const PH = 841.89; const CW = PW - ML * 2;
      const BOTTOM = PH - 50;

      const SLABEL: Record<string,string> = {
        pendiente:'Pendiente', en_curso:'En Curso', suspendida:'Suspendida', completada:'Completada',
        cancelada:'Cancelada', activo:'Activo', completado:'Completado', borrador:'Borrador',
        firmada:'Firmada', en_progreso:'En Progreso', bloqueado:'Bloqueado',
      };
      const TLABEL: Record<string,string> = {
        inicio:'Acta de Inicio', visita:'Acta de Visita', capacitacion:'Acta de Capacitación',
        cierre:'Acta de Cierre', entrega_soporte:'Entrega a Soporte',
      };
      const fmt = (d: any) => d ? new Date(d).toLocaleDateString('es-CO',
        { timeZone:'UTC', day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
      const fmtLong = (d: any) => d ? new Date(d).toLocaleDateString('es-CO',
        { year:'numeric', month:'long', day:'numeric' }) : '—';

      const doc = new PDFDocument({ size:'A4', margin:0, bufferPages:true,
        info: { Title: `Informe ${includeActas ? 'con Actas' : 'Ejecutivo'} OS ${osNum}` } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('error', reject);

      // ── Layout helpers ──────────────────────────────────────────────────────
      const ensureSpace = (needed: number) => {
        if (doc.y + needed > BOTTOM) { doc.addPage(); doc.y = ML; }
      };

      let secN = 0;
      const band = (title: string, color?: [number,number,number]) => {
        secN++;
        ensureSpace(22);
        const y = doc.y;
        doc.rect(ML, y, CW, 18).fill(color ?? [pr, pg, pb]);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('white')
           .text(`${secN}. ${title.toUpperCase()}`, ML+6, y+5, { width:CW-12, lineBreak:false });
        doc.y = y + 18;
      };

      const kvTable = (rows: [string, string|number][], labelW = 145) => {
        rows.forEach(([lbl, val], i) => {
          ensureSpace(16);
          const y = doc.y;
          doc.rect(ML, y, CW, 16).fill(i%2===0?[249,250,251]:[255,255,255])
             .strokeColor([229,231,235]).stroke();
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor([55,65,81])
             .text(String(lbl).toUpperCase(), ML+4, y+4, { width:labelW-8, lineBreak:false });
          doc.font('Helvetica').fontSize(8).fillColor([55,65,81])
             .text(String(val??'—'), ML+labelW, y+4, { width:CW-labelW-8, lineBreak:false, ellipsis:true });
          doc.y = y + 16;
        });
      };

      type CellVal = string | { text:string; color:[number,number,number] };
      const colTable = (headers:{label:string;w:number}[], rows: CellVal[][]) => {
        const totalW = headers.reduce((s,h) => s+h.w, 0);
        const scale  = CW / totalW;
        const ws     = headers.map(h => h.w * scale);
        const xs     = ws.reduce((acc, w) => { acc.push((acc[acc.length-1]??ML) + (acc.length?ws[acc.length-1]:0)); return acc; }, [ML] as number[]).slice(0,-1);
        // Simpler xs calculation
        const colXs: number[] = [ML];
        for (let i = 0; i < ws.length - 1; i++) colXs.push(colXs[i] + ws[i]);

        ensureSpace(18);
        const hy = doc.y;
        doc.rect(ML, hy, CW, 16).fill([55,65,81]);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('white');
        headers.forEach((h, i) => doc.text(h.label, colXs[i]+3, hy+4, { width:ws[i]-6, lineBreak:false }));
        doc.y = hy + 16;

        rows.forEach((row, ri) => {
          ensureSpace(16);
          const y = doc.y;
          doc.rect(ML, y, CW, 16).fill(ri%2===0?[249,250,251]:[255,255,255])
             .strokeColor([229,231,235]).stroke();
          row.forEach((cell, ci) => {
            const isObj = typeof cell === 'object';
            const text  = isObj ? (cell as any).text : String(cell??'—');
            const color: [number,number,number] = isObj ? (cell as any).color : [55,65,81];
            doc.font('Helvetica').fontSize(7.5).fillColor(color)
               .text(text, colXs[ci]+3, y+4, { width:ws[ci]-6, lineBreak:false, ellipsis:true });
          });
          doc.y = y + 16;
        });
      };

      const subLabel = (text: string) => {
        doc.moveDown(0.3);
        ensureSpace(14);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor([55,65,81])
           .text(text.toUpperCase(), ML, doc.y, { width:CW });
        doc.moveDown(0.15);
      };

      const bodyText = (text: string) => {
        doc.font('Helvetica').fontSize(8.5).fillColor([55,65,81])
           .text(String(text??''), ML, doc.y, { width:CW });
        doc.moveDown(0.25);
      };

      // ── Document header (page 1) ────────────────────────────────────────────
      const reportTitle = includeActas ? 'Informe con Actas' : 'Informe Ejecutivo';
      doc.rect(ML, ML, CW, 54).fill([pr, pg, pb]);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('white')
         .text(compName, ML+10, ML+10, { width:CW-155, lineBreak:false });
      if (company?.nit) {
        doc.font('Helvetica').fontSize(7.5).fillColor('white')
           .text(`NIT: ${company.nit}`, ML+10, ML+26, { width:CW-155, lineBreak:false });
      }
      doc.font('Helvetica-Bold').fontSize(10).fillColor('white')
         .text(reportTitle, ML+CW-148, ML+10, { width:148, align:'right', lineBreak:false });
      doc.font('Helvetica').fontSize(8).fillColor('white')
         .text(`OS: ${osNum}`, ML+CW-148, ML+26, { width:148, align:'right', lineBreak:false })
         .text(fmtLong(generatedAt??new Date().toISOString()), ML+CW-148, ML+38, { width:148, align:'right', lineBreak:false });
      doc.rect(ML, ML+54, CW, 3).fill([96,165,250]);
      doc.font('Helvetica').fontSize(8.5).fillColor([55,65,81])
         .text(`${os.client?.businessName??''}  ·  OS: ${osNum}  ·  ${os.product??''}`, ML, ML+62, { width:CW });
      doc.y = ML + 80;

      // ── 1. Datos de la OS ───────────────────────────────────────────────────
      band('Datos de la Orden de Servicio');
      kvTable([
        ['No. Orden',          os.osNumber],
        ['Cliente',            `${os.client?.businessName??'—'}  ·  NIT: ${os.client?.nit??'—'}`],
        ['Producto / Servicio', os.product??'—'],
        ['Estado',             SLABEL[os.status]??os.status??'—'],
        ['Fecha Inicio',       fmt(os.startDate)],
        ['Fecha Fin',          fmt(os.endDate)],
        ['Duración',           `${os.durationDays??0} días`],
        ...(os.ticketRubi ? [['Ticket Rubí', os.ticketRubi] as [string,string]] : []),
      ]);

      // ── 2. Equipo ───────────────────────────────────────────────────────────
      const teamRows: string[][] = [
        os.clinicalLeader  ? ['Líder Asistencial', `${os.clinicalLeader.firstName} ${os.clinicalLeader.lastName}`,  os.clinicalLeader.email??'—'] : null,
        os.financialLeader ? ['Líder Financiero',  `${os.financialLeader.firstName} ${os.financialLeader.lastName}`, os.financialLeader.email??'—'] : null,
        ...((os.implementers??[]).map((imp: any) => ['Implementador', `${imp.user.firstName} ${imp.user.lastName}`, imp.user.email??'—'])),
      ].filter(Boolean) as string[][];
      if (teamRows.length > 0) {
        doc.moveDown(0.3);
        band('Equipo del Proyecto');
        colTable(
          [{label:'Rol',w:120},{label:'Nombre',w:155},{label:'Email',w:220}],
          teamRows,
        );
      }

      // ── 3. Avance del Proyecto ──────────────────────────────────────────────
      if (project) {
        doc.moveDown(0.3);
        band('Avance del Proyecto');
        const allActs = (project.modules??[]).flatMap((m: any) =>
          (m.phases??[]).flatMap((p: any) => p.activities??[]));
        const doneActs = allActs.filter((a: any) => a.status==='completado').length;
        const pct = Number(project.progressPercent??0);
        kvTable([
          ['Nombre',  project.name??'—'],
          ['Estado',  SLABEL[project.status]??project.status??'—'],
          ['Progreso', `${pct.toFixed(0)}%  (${doneActs}/${allActs.length} actividades completadas)`],
          ['Inicio',  fmt(project.startDate)],
          ['Fin',     fmt(project.endDate)],
        ]);
        ensureSpace(14);
        const bary = doc.y + 2;
        doc.rect(ML, bary, CW, 8).fill([229,231,235]);
        doc.rect(ML, bary, CW*Math.min(pct/100,1), 8).fill([pr,pg,pb]);
        doc.y = bary + 14;
        if ((project.modules??[]).length > 0) {
          colTable(
            [{label:'Módulo',w:210},{label:'Progreso',w:75},{label:'Fases',w:55},{label:'Actividades',w:75}],
            (project.modules as any[]).map(mod => {
              const ma = (mod.phases??[]).flatMap((p: any) => p.activities??[]);
              const md = ma.filter((a: any) => a.status==='completado').length;
              return [mod.name??'—', `${Number(mod.progressPercent??0).toFixed(0)}%`, String((mod.phases??[]).length), `${md}/${ma.length}`];
            }),
          );
        }
      }

      // ── 4. Actas (resumen) ──────────────────────────────────────────────────
      doc.moveDown(0.3);
      band('Actas del Proyecto');
      if ((actas as any[]).length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor([156,163,175])
           .text('No hay actas registradas.', ML, doc.y+4, { width:CW, align:'center' });
        doc.y += 18;
      } else {
        colTable(
          [{label:'Tipo',w:115},{label:'Número',w:75},{label:'Fecha',w:72},{label:'Ciudad',w:100},{label:'Estado',w:68},{label:'Firmas',w:65}],
          (actas as any[]).map(a => {
            const signed = (a.firmantes??[]).filter((f: any) => f.signedAt).length;
            return [
              TLABEL[a.type]??a.type,
              a.numero??'—', fmt(a.fecha),
              a.municipio?.nombreMunicipio??a.ciudad??'—',
              { text: SLABEL[a.status]??a.status??'Borrador', color: a.status==='firmada'?[6,95,70]:[92,64,14] as [number,number,number] },
              `${signed}/${(a.firmantes??[]).length}`,
            ];
          }),
        );
      }

      // ── 5. Requerimientos ───────────────────────────────────────────────────
      if ((requerimientos as any[]).length > 0) {
        doc.moveDown(0.3);
        band('Requerimientos / Tickets');
        const PRIO: Record<string,[number,number,number]> = {
          critica:[153,27,27], alta:[146,64,14], media:[30,64,175], baja:[22,101,52],
        };
        colTable(
          [{label:'No.',w:55},{label:'Título',w:175},{label:'Tipo',w:70},{label:'Prioridad',w:70},{label:'Estado',w:125}],
          (requerimientos as any[]).map(r => [
            r.numero??'—', r.titulo??'—', r.tipo??'—',
            { text: r.prioridad??'—', color: PRIO[r.prioridad]??[55,65,81] as [number,number,number] },
            r.estadoActual??'—',
          ]),
        );
      }

      // ── 6. Capacitación ─────────────────────────────────────────────────────
      const allCap = [...(personalCapacitado??[]), ...(personalEnProceso??[]), ...(personalPendiente??[])];
      if (allCap.length > 0) {
        doc.moveDown(0.3);
        band('Estado de Capacitación del Personal');
        const CAP_COLOR: Record<string,[number,number,number]> = {
          Capacitado:[6,95,70], 'En proceso':[30,64,175], Pendiente:[217,119,6],
        };
        colTable(
          [{label:'Nombre',w:155},{label:'Cargo',w:130},{label:'Área',w:110},{label:'Estado',w:100}],
          [
            ...(personalCapacitado??[]).map((s: any) => [s,'Capacitado']),
            ...(personalEnProceso??[]).map((s: any)  => [s,'En proceso']),
            ...(personalPendiente??[]).map((s: any)  => [s,'Pendiente']),
          ].map(([s, est]: any) => [
            `${s.firstName} ${s.lastName}`, s.jobTitle??'—', s.area??'—',
            { text: est, color: CAP_COLOR[est]??[55,65,81] as [number,number,number] },
          ]),
        );
      }

      // ══════════════════════════════════════════════════════════════════
      // PARTE 2: ACTAS DETALLADAS (solo si includeActas)
      // ══════════════════════════════════════════════════════════════════
      if (includeActas && (actas as any[]).length > 0) {
        doc.addPage();
        // Portada del anexo
        doc.rect(ML, ML, CW, 64).fill([pr,pg,pb]);
        doc.font('Helvetica-Bold').fontSize(18).fillColor('white')
           .text('Anexo: Actas de Implementación', ML+14, ML+14, { width:CW-28 });
        doc.font('Helvetica').fontSize(10).fillColor('white')
           .text(`${os.client?.businessName??''}  ·  OS: ${osNum}  ·  ${(actas as any[]).length} acta(s)`,
                 ML+14, ML+44, { width:CW-28 });
        doc.rect(ML, ML+64, CW, 3).fill([96,165,250]);
        doc.y = ML + 80;

        (actas as any[]).forEach((acta, idx) => {
          if (idx > 0) doc.addPage();
          const typeLabel = TLABEL[acta.type]??acta.type;

          // Acta header band (use dark gray to distinguish from executive bands)
          ensureSpace(22);
          const aby = doc.y;
          doc.rect(ML, aby, CW, 20).fill([pr,pg,pb]);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('white')
             .text(`ANEXO ${idx+1}: ${typeLabel.toUpperCase()}  —  ${acta.numero??''}`, ML+6, aby+6,
                   { width:CW-80, lineBreak:false });
          doc.font('Helvetica').fontSize(8).fillColor('white')
             .text(`${fmt(acta.fecha)}  ·  ${acta.municipio?.nombreMunicipio??acta.ciudad??'—'}`,
                   ML+CW-160, aby+6, { width:154, align:'right', lineBreak:false });
          const isFirmada = acta.status==='firmada';
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('white')
             .text(isFirmada?'FIRMADA':'BORRADOR', ML+CW-160, aby+14, { width:154, align:'right', lineBreak:false });
          doc.y = aby + 20;

          // Meta info
          kvTable([
            ['Fecha',     fmt(acta.fecha)],
            ['Ciudad',    acta.municipio?.nombreMunicipio??acta.ciudad??'—'],
            ['Lugar',     acta.lugar??'—'],
            ['Creado por', acta.createdBy?`${acta.createdBy.firstName} ${acta.createdBy.lastName}`:'—'],
            ['Estado',    SLABEL[acta.status]??acta.status??'Borrador'],
          ]);

          // Type-specific content
          switch (acta.type) {
            case 'inicio': {
              if (acta.asunto) { subLabel('Asunto'); bodyText(acta.asunto); }
              if (acta.objetivoGeneral) { subLabel('Objetivo General'); bodyText(acta.objetivoGeneral); }
              if (acta.alcance) { subLabel('Alcance'); bodyText(acta.alcance); }
              break;
            }
            case 'visita': {
              const visMeta: [string,string][] = [];
              if (acta.implementadorNombre) visMeta.push(['Implementador', acta.implementadorNombre]);
              if (acta.jefeNombre) visMeta.push(['Jefe / Responsable', acta.jefeNombre]);
              if (visMeta.length) kvTable(visMeta);
              if (acta.actividadesRealizadas) { subLabel('Actividades Realizadas'); bodyText(acta.actividadesRealizadas); }
              if ((acta.fechasVisita??[]).length > 0) {
                subLabel('Fechas de Visita');
                colTable(
                  [{label:'Fecha',w:130},{label:'Hora Inicio',w:120},{label:'Hora Fin',w:120}],
                  (acta.fechasVisita as any[]).map((fv: any) => [fmt(fv.fecha), fv.horaInicio??'—', fv.horaFin??'—']),
                );
              }
              if ((acta.compromisos??[]).length > 0) {
                subLabel('Compromisos');
                const CEL: Record<string,[number,number,number]> = {
                  pendiente:[92,64,14], en_proceso:[30,64,175], cumplido:[6,95,70], completado:[6,95,70],
                };
                colTable(
                  [{label:'#',w:28},{label:'Compromiso',w:265},{label:'Responsable',w:115},{label:'Estado',w:87}],
                  (acta.compromisos as any[]).map((c: any, i: number) => {
                    const resp = c.assignedTo?`${c.assignedTo.firstName} ${c.assignedTo.lastName}`:c.clientStaff?`${c.clientStaff.firstName} ${c.clientStaff.lastName}`:c.responsable??'—';
                    return [String(c.numero??i+1), c.compromiso??'—', resp,
                            { text: c.estado==='cumplido'||c.estado==='completado'?'Cumplido':c.estado==='en_proceso'?'En proceso':'Pendiente',
                              color: CEL[c.estado]??[55,65,81] as [number,number,number] }];
                  }),
                );
              }
              if ((acta.acciones??[]).length > 0) {
                subLabel('Acciones');
                colTable(
                  [{label:'Acción',w:260},{label:'Responsable',w:130},{label:'Fecha Límite',w:105}],
                  (acta.acciones as any[]).map((a: any) => [a.accion??'—', a.responsable??'—', a.fechaLimite?fmt(a.fechaLimite):'—']),
                );
              }
              break;
            }
            case 'capacitacion': {
              const capMeta: [string,string][] = [];
              if (acta.modulo?.name) capMeta.push(['Módulo', acta.modulo.name]);
              if (acta.expositor) capMeta.push(['Expositor', acta.expositor]);
              if (acta.horaInicio) capMeta.push(['Horario', `${acta.horaInicio} – ${acta.horaFin??'—'}`]);
              if (capMeta.length) kvTable(capMeta);
              if (acta.temasCapacitacion) { subLabel('Temas'); bodyText(acta.temasCapacitacion); }
              if ((acta.participantes??[]).length > 0) {
                subLabel('Participantes');
                colTable(
                  [{label:'Nombre',w:160},{label:'Cargo',w:130},{label:'Documento',w:95},{label:'Entrada',w:55},{label:'Salida',w:55}],
                  (acta.participantes as any[]).map((p: any) => [p.nombre, p.cargo??'—', p.documento??'—', p.horaEntrada??'—', p.horaSalida??'—']),
                );
              }
              if ((acta.acciones??[]).length > 0) {
                subLabel('Acciones');
                colTable(
                  [{label:'Acción',w:260},{label:'Responsable',w:130},{label:'Fecha Límite',w:105}],
                  (acta.acciones as any[]).map((a: any) => [a.accion??'—', a.responsable??'—', a.fechaLimite?fmt(a.fechaLimite):'—']),
                );
              }
              break;
            }
            case 'cierre': {
              if (acta.cuerpo) { subLabel('Descripción'); bodyText(acta.cuerpo); }
              try {
                const mods = JSON.parse(acta.cierreModulosJson??'[]') as string[];
                if (mods.length > 0) { subLabel('Módulos Cerrados'); bodyText(mods.join('  ·  ')); }
              } catch { /**/ }
              if ((acta.contactos??[]).length > 0) {
                subLabel('Contactos de Soporte');
                colTable(
                  [{label:'Nombre',w:170},{label:'Área',w:155},{label:'Teléfono',w:170}],
                  (acta.contactos as any[]).map((c: any) => [c.nombre, c.area??'—', c.telefono??'—']),
                );
              }
              break;
            }
            case 'entrega_soporte': {
              const esMeta: [string,string][] = [];
              if (acta.nitCliente) esMeta.push(['NIT Cliente', acta.nitCliente]);
              if (acta.responsableImplementador) esMeta.push(['Resp. Implementación', acta.responsableImplementador]);
              if (acta.responsableSoporte) esMeta.push(['Resp. Soporte', acta.responsableSoporte]);
              if (acta.capacitacionModalidad) esMeta.push(['Modalidad', acta.capacitacionModalidad]);
              if (esMeta.length) kvTable(esMeta);
              // Checklists: simplified text rendering
              ([[acta.modulosChecklist, MODS_DEF, 'Módulos del Sistema'],
                [acta.infraestructuraChecklist, INFRA_DEF, 'Infraestructura'],
                [acta.documentacionChecklist, DOCS_DEF, 'Documentación'],
                [acta.emisionElectronicaChecklist, EMIS_DEF, 'Emisión Electrónica']] as [string|null, any[], string][])
                .forEach(([json, def, title]) => {
                  const items = parseChecklist(json, def);
                  const ok    = items.filter((i: any) => i.checked);
                  const nok   = items.filter((i: any) => !i.checked);
                  subLabel(`${title} (${ok.length}/${items.length} completados)`);
                  if (ok.length)  { doc.font('Helvetica').fontSize(7.5).fillColor([6,95,70])  .text('✓ '+ok.map((i:any)=>i.label).join('  ·  '),  ML, doc.y, { width:CW }); doc.moveDown(0.15); }
                  if (nok.length) { doc.font('Helvetica').fontSize(7.5).fillColor([156,163,175]).text('✗ '+nok.map((i:any)=>i.label).join('  ·  '), ML, doc.y, { width:CW }); doc.moveDown(0.15); }
                  doc.moveDown(0.2);
                });
              if (acta.observacionesGenerales) { subLabel('Observaciones'); bodyText(acta.observacionesGenerales); }
              break;
            }
          }

          // Firmantes
          if ((acta.firmantes??[]).length > 0) {
            subLabel(`Firmantes (${(acta.firmantes as any[]).filter((f: any) => f.signedAt).length}/${(acta.firmantes??[]).length} firmados)`);
            (acta.firmantes as any[]).forEach((f: any, i: number) => {
              ensureSpace(18);
              const fy = doc.y;
              doc.font('Helvetica-Bold').fontSize(8).fillColor([31,41,55])
                 .text(`${i+1}. ${f.nombre}  `, ML, fy, { continued:true, lineBreak:false });
              doc.font('Helvetica').fontSize(7.5).fillColor([107,114,128])
                 .text(`${f.cargo??'—'}  ·  ${f.empresa??'—'}`, { lineBreak:false });
              doc.font('Helvetica-Bold').fontSize(7).fillColor(f.signedAt?[6,95,70]:[217,119,6])
                 .text(f.signedAt?`Firmado: ${fmt(f.signedAt)}`:'Pendiente',
                       ML+CW-140, fy, { width:140, align:'right', lineBreak:false });
              doc.y = fy + 14;
            });
          }
        });
      }

      // ── Page footers ─────────────────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(ML, PH-28).lineTo(PW-ML, PH-28).strokeColor([229,231,235]).stroke();
        doc.font('Helvetica').fontSize(7).fillColor([156,163,175])
           .text(`${compName}  ·  ${reportTitle}  ·  Confidencial`, ML, PH-20, { lineBreak:false })
           .text(`OS: ${osNum}  ·  Página ${i+1} de ${range.count}`, ML, PH-20, { width:CW, align:'right', lineBreak:false });
      }

      doc.flushPages();
      doc.end();
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async sendReport(
    companyId: string,
    osId: string,
    dto: { destinatarios: string[]; asunto?: string },
  ): Promise<{ message: string; destinatarios: number }> {
    const data   = await this.getExecutiveReport(companyId, osId);
    const html   = this.buildReportHtml(data);
    const asunto = dto.asunto
      ?? `Informe Ejecutivo – ${data.os.osNumber} – ${(data.os as any).client.businessName}`;
    await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html);
    return { message: 'Informe enviado correctamente', destinatarios: dto.destinatarios.length };
  }

  async sendPdfAttachment(
    companyId: string,
    osId: string,
    dto: { destinatarios: string[]; asunto?: string; pdfBase64: string; filename?: string },
  ): Promise<{ message: string; destinatarios: number }> {
    const data = await this.getExecutiveReport(companyId, osId);
    const { company, os } = data;
    const nom = company?.commercialName ?? company?.name ?? '';
    const pc  = company?.primaryColor ?? '#1E3A5F';

    const osNameS  = os.product ?? os.osNumber;
    const asunto   = dto.asunto ?? `Informe – ${osNameS}`;
    const filename = dto.filename ?? `Informe_${osNameS.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    const pdf      = Buffer.from(dto.pdfBase64, 'base64');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
  <div style="font-size:16px;font-weight:800;">${nom}</div>
  <div style="font-size:12px;opacity:0.85;margin-top:4px;">${asunto}</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},#60a5fa);"></td></tr>
<tr><td style="padding:24px 28px;">
  <p style="font-size:13px;color:#374151;margin:0;">Adjunto encontrará el informe en formato PDF.</p>
</td></tr>
<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;border-radius:0 0 8px 8px;">
  ${nom} · Informe generado automáticamente
</td></tr>
</table></td></tr></table></body></html>`;

    await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html, [
      { filename, content: pdf, contentType: 'application/pdf' },
    ]);
    return { message: 'Informe enviado correctamente', destinatarios: dto.destinatarios.length };
  }

  async sendReportPdf(
    companyId: string,
    osId: string,
    dto: { destinatarios: string[]; asunto?: string; reportType: 'ejecutivo' | 'completo' },
  ): Promise<{ message: string; destinatarios: number }> {
    const isCompleto = dto.reportType === 'completo';
    const data = isCompleto
      ? await this.getFullReport(companyId, osId)
      : await this.getExecutiveReport(companyId, osId);

    const { company, os } = data as any;
    const nom = company?.commercialName ?? company?.name ?? '';
    const pc  = company?.primaryColor ?? '#1E3A5F';

    const reportLabel = isCompleto ? 'Informe con Actas' : 'Informe Ejecutivo';
    const osNameR     = os.product ?? os.osNumber;
    const asunto      = dto.asunto ?? `${reportLabel} – ${osNameR}`;
    const filename    = `${reportLabel.replace(/ /g, '_')}_${osNameR.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    const pdf         = await this.generatePdfPuppeteer(data, isCompleto);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
  <div style="font-size:16px;font-weight:800;">${nom}</div>
  <div style="font-size:12px;opacity:0.85;margin-top:4px;">${reportLabel} · ${osNameR}</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},#60a5fa);"></td></tr>
<tr><td style="padding:24px 28px;">
  <p style="font-size:13px;color:#374151;margin:0 0 8px;">Adjunto encontrará el <b>${reportLabel}</b> de la orden de servicio <b>${os.osNumber}</b>.</p>
  ${isCompleto ? '<p style="font-size:12px;color:#6b7280;margin:0;">Este informe incluye el resumen ejecutivo y todas las actas de implementación diligenciadas.</p>' : ''}
</td></tr>
<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;border-radius:0 0 8px 8px;">
  ${nom} · Generado automáticamente
</td></tr>
</table></td></tr></table></body></html>`;

    await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html, [
      { filename, content: pdf, contentType: 'application/pdf' },
    ]);
    return { message: `${reportLabel} enviado correctamente`, destinatarios: dto.destinatarios.length };
  }

  async generateReportPdfBuffer(companyId: string, osId: string, reportType = 'completo'): Promise<Buffer> {
    const isCompleto = reportType === 'completo';
    const data = isCompleto
      ? await this.getFullReport(companyId, osId)
      : await this.getExecutiveReport(companyId, osId);
    return this.generatePdfPuppeteer(data, isCompleto);
  }

  async generateAnalysisPdfBuffer(companyId: string, osId: string): Promise<Buffer> {
    const [data, company] = await Promise.all([
      this.getAlerts(companyId, osId),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true, commercialName: true, primaryColor: true,
          nit: true, city: true, email: true, logoData: true,
        },
      }),
    ]);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const res = await fetch(`${frontendUrl}/api/generate-analysis-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, company }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`[generate-analysis-pdf] HTTP ${res.status}: ${msg}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async sendAnalysis(
    companyId: string,
    osId: string,
    dto: { destinatarios: string[]; asunto?: string },
  ): Promise<{ message: string; destinatarios: number }> {
    const [alertData, company] = await Promise.all([
      this.getAlerts(companyId, osId),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, commercialName: true, primaryColor: true },
      }),
    ]);
    const { os, riskLevel, activitySummary, predictions } = alertData as any;
    const nom = company?.commercialName ?? company?.name ?? '';
    const pc  = company?.primaryColor ?? '#1E3A5F';

    const pdf      = await this.generateAnalysisPdfBuffer(companyId, osId);
    const osNameA  = os.product ?? os.osNumber;
    const asunto   = dto.asunto ?? `Análisis de Implementación – ${osNameA} – ${os.client?.businessName ?? ''}`;
    const filename = `Analisis_${osNameA.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

    const riskLabel: Record<string, string> = { alto: 'RIESGO ALTO', medio: 'RIESGO MEDIO', normal: 'EN CONTROL' };
    const riskColor: Record<string, string> = { alto: '#dc2626', medio: '#d97706', normal: '#059669' };
    const rl = riskLabel[riskLevel ?? 'normal'] ?? 'EN CONTROL';
    const rc = riskColor[riskLevel ?? 'normal'] ?? '#059669';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="background:${pc};padding:20px 28px;color:#fff;border-radius:8px 8px 0 0;">
  <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;opacity:0.8;">Análisis de Implementación</div>
  <div style="font-size:17px;font-weight:800;margin-top:6px;">${os.client?.businessName ?? ''}</div>
  <div style="font-size:12px;opacity:0.85;margin-top:3px;">OS: ${os.osNumber}  ·  ${os.product ?? ''}</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},${rc});"></td></tr>
<tr><td style="padding:24px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
  <tr>
    <td width="50%" style="padding:12px 14px;background:${riskLevel === 'alto' ? '#fef2f2' : riskLevel === 'medio' ? '#fffbeb' : '#f0fdf4'};border-radius:6px;border:1px solid ${rc}40;">
      <div style="font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${rc};">Nivel de Riesgo</div>
      <div style="font-size:18px;font-weight:800;color:${rc};margin-top:4px;">${rl}</div>
    </td>
    <td width="4%"></td>
    <td width="46%" style="padding:12px 14px;background:#f0f9ff;border-radius:6px;border:1px solid ${pc}40;">
      <div style="font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${pc};">Avance del Proyecto</div>
      <div style="font-size:18px;font-weight:800;color:${pc};margin-top:4px;">${Math.round(Number((alertData as any).project?.progressPercent ?? 0))}%</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">${activitySummary?.done ?? 0} / ${activitySummary?.total ?? 0} actividades</div>
    </td>
  </tr></table>
  <p style="font-size:13px;color:#374151;margin:0 0 6px;">Adjunto encontrará el <b>Análisis de Implementación</b> en formato PDF con detalle de módulos, predicciones, recomendaciones y alertas.</p>
  ${predictions?.diasDeRetraso != null ? `<p style="font-size:12px;color:#6b7280;margin:0;">Fin estimado: <b>${predictions.fechaEstimadaFin ? new Date(predictions.fechaEstimadaFin).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</b>${predictions.diasDeRetraso > 0 ? ` &nbsp;·&nbsp; <span style="color:#dc2626;">${predictions.diasDeRetraso} días de retraso</span>` : ' &nbsp;·&nbsp; <span style="color:#059669;">A tiempo</span>'}</p>` : ''}
</td></tr>
<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;border-radius:0 0 8px 8px;">
  ${nom} · Análisis generado automáticamente
</td></tr>
</table></td></tr></table></body></html>`;

    await this.mail.sendFromCompany(companyId, dto.destinatarios, asunto, html, [
      { filename, content: pdf, contentType: 'application/pdf' },
    ]);
    return { message: 'Análisis enviado correctamente', destinatarios: dto.destinatarios.length };
  }

  private buildReportHtml(data: any): string {
    const { company, os, project, actas, requerimientos,
            personalCapacitado, personalEnProceso, personalPendiente } = data;

    const pc  = company?.primaryColor ?? '#1E3A5F';
    const nom = company?.commercialName ?? company?.name ?? '';

    const fmt = (s: string | null | undefined) => {
      if (!s) return '—';
      return new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const STATUS: Record<string, string> = {
      pendiente: 'Pendiente', en_progreso: 'En Progreso', completado: 'Completado',
      en_curso: 'En Curso', activo: 'Activo', pausado: 'Pausado', bloqueado: 'Bloqueado',
    };

    const allActs = (project?.modules ?? []).flatMap((m: any) =>
      (m.phases ?? []).flatMap((p: any) => p.activities ?? []),
    );
    const cnt = (st: string) => allActs.filter((a: any) => a.status === st).length;

    const team = [
      os.clinicalLeader  ? `${os.clinicalLeader.firstName} ${os.clinicalLeader.lastName} (Líder Asistencial)` : null,
      os.financialLeader ? `${os.financialLeader.firstName} ${os.financialLeader.lastName} (Líder Financiero)` : null,
      ...(os.implementers ?? []).map((i: any) =>
        `${i.user.firstName} ${i.user.lastName} (Implementador)`),
    ].filter(Boolean).join('<br>');

    const modRows = (project?.modules ?? []).map((m: any, i: number) =>
      `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:6px 14px;font-size:12px;color:#374151;">${m.name}</td>
        <td style="padding:6px 14px;font-size:12px;color:${pc};font-weight:700;text-align:center;">${Number(m.progressPercent).toFixed(0)}%</td>
      </tr>`,
    ).join('');

    const osRows = [
      ['No. Orden',  os.osNumber],
      ['Cliente',    `${(os as any).client.businessName} · NIT: ${(os as any).client.nit}`],
      ['Producto',   os.product],
      ['Estado',     STATUS[os.status] ?? os.status],
      ['Fecha Inicio', fmt(os.startDate)],
      ['Fecha Fin',    fmt(os.endDate)],
      ['Duración',   `${os.durationDays} días`],
      ...(os.ticketRubi ? [['Ticket Rubí', os.ticketRubi]] : []),
    ].map(([l, v], i) =>
      `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:7px 14px;font-weight:700;font-size:10px;text-transform:uppercase;color:#374151;width:160px;">${l}</td>
        <td style="padding:7px 14px;font-size:12px;color:#374151;">${v}</td>
      </tr>`,
    ).join('');

    const stat = (n: number, label: string, color: string, bg: string) =>
      `<td style="padding:14px;text-align:center;background:${bg};border-right:1px solid #e5e7eb;">
        <div style="font-size:24px;font-weight:800;color:${color};">${n}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:${color};margin-top:2px;">${label}</div>
      </td>`;

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">

<tr><td style="background:${pc};padding:22px 28px;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><div style="font-size:17px;font-weight:800;">${nom}</div>
      ${company?.nit ? `<div style="font-size:10px;opacity:0.8;margin-top:2px;">NIT: ${company.nit}</div>` : ''}
    </td>
    <td align="right">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Informe Ejecutivo</div>
      <div style="font-size:12px;opacity:0.85;margin-top:3px;">OS: <b>${os.osNumber}</b></div>
      <div style="font-size:10px;opacity:0.7;margin-top:2px;">${fmt(new Date().toISOString())}</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,${pc},#60a5fa);"></td></tr>

<tr><td style="padding:24px 28px;">

<!-- Datos OS -->
<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${pc};">Datos de la Orden</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
${osRows}
${os.scope ? `<tr style="background:#f9fafb"><td style="padding:7px 14px;font-weight:700;font-size:10px;text-transform:uppercase;color:#374151;">Alcance</td><td style="padding:7px 14px;font-size:12px;color:#374151;">${os.scope}</td></tr>` : ''}
</table>

${project ? `
<!-- Avance -->
<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${pc};">Avance del Proyecto</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:13px;font-weight:700;color:#1f2937;">${project.name} &nbsp;·&nbsp; <span style="font-weight:400;color:#6b7280;">${STATUS[project.status] ?? project.status}</span></td>
    <td align="right" style="font-size:20px;font-weight:800;color:${pc};">${Number(project.progressPercent).toFixed(0)}%</td>
  </tr></table>
  <div style="height:7px;background:#e5e7eb;border-radius:4px;margin-top:10px;">
    <div style="height:7px;width:${Math.min(Number(project.progressPercent), 100)}%;background:${pc};border-radius:4px;"></div>
  </div>
</td></tr>
${modRows ? `<tr><td><table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <th style="padding:6px 14px;background:#374151;color:#fff;font-size:10px;text-align:left;font-weight:700;">Módulo</th>
    <th style="padding:6px 14px;background:#374151;color:#fff;font-size:10px;text-align:center;font-weight:700;width:80px;">Progreso</th>
  </tr>
  ${modRows}
</table></td></tr>` : ''}
</table>

<!-- Actividades -->
<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${pc};">Actividades del Plan de Trabajo</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
<tr>
  ${stat(cnt('completado'),  'Completadas', '#065f46', '#d1fae5')}
  ${stat(cnt('en_progreso'), 'En Progreso', '#1e40af', '#dbeafe')}
  ${stat(cnt('bloqueado'),   'Bloqueadas',  '#991b1b', '#fee2e2')}
  ${stat(cnt('pendiente'),   'Pendientes',  '#6b7280', '#f3f4f6')}
</tr>
</table>` : ''}

<!-- Actas y Reqs -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
<tr>
  <td width="48%" style="border:1px solid #e5e7eb;border-radius:6px;padding:14px;text-align:center;vertical-align:top;">
    <div style="font-size:26px;font-weight:800;color:${pc};">${actas.length}</div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-top:2px;">Actas del Proyecto</div>
    <div style="font-size:11px;color:#374151;margin-top:6px;">${actas.filter((a: any) => a.status === 'firmada').length} firmada(s)</div>
  </td>
  <td width="4%"></td>
  <td width="48%" style="border:1px solid #e5e7eb;border-radius:6px;padding:14px;text-align:center;vertical-align:top;">
    <div style="font-size:26px;font-weight:800;color:${pc};">${requerimientos.length}</div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-top:2px;">Requerimientos</div>
    <div style="font-size:11px;color:#374151;margin-top:6px;">${requerimientos.filter((r: any) => ['Aprobado','Cerrado'].includes(r.estadoActual)).length} cerrado(s)</div>
  </td>
</tr>
</table>

${team ? `
<!-- Equipo -->
<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${pc};">Equipo del Proyecto</p>
<div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;font-size:12px;color:#374151;line-height:1.8;margin-bottom:20px;">${team}</div>
` : ''}

<!-- Capacitación -->
<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${pc};">Estado de Capacitación</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;">
<tr>
  ${stat(personalCapacitado.length, 'Capacitados', '#059669', '#d1fae5')}
  ${stat(personalEnProceso.length,  'En Proceso',  '#2563eb', '#dbeafe')}
  ${stat(personalPendiente.length,  'Pendientes',  '#d97706', '#fef3c7')}
</tr>
</table>

</td></tr>

<tr><td style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;">
  ${nom} &nbsp;·&nbsp; Informe Ejecutivo &nbsp;·&nbsp; Generado automáticamente el ${fmt(new Date().toISOString())}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  }

  // ── AI Analysis ─────────────────────────────────────────────────────────────

  private async callGroq(messages: { role: string; content: string }[], maxTokens = 1800): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('GROQ_API_KEY no configurada');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.35,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Groq API error ${response.status}: ${err}`);
        if (response.status === 429) throw new InternalServerErrorException('Límite de solicitudes alcanzado. Intenta de nuevo en unos segundos.');
        throw new InternalServerErrorException('Error al consultar la IA');
      }

      const data: any = await response.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const finishReason: string = data?.choices?.[0]?.finish_reason ?? '';
      if (finishReason === 'length') {
        this.logger.warn(`Groq finish_reason=length — respuesta truncada. max_tokens=${maxTokens}`);
      }
      return content;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new InternalServerErrorException('La IA tardó demasiado en responder. Intenta de nuevo.');
      if (e instanceof InternalServerErrorException) throw e;
      this.logger.error(e);
      throw new InternalServerErrorException('Error al consultar la IA');
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildOsContext(alertData: any): string {
    const { os, project, riskLevel, alerts, activitySummary, predictions, modules, visits, timeline, tickets, delayAttribution } = alertData;
    const ctx = {
      os: { num: os.osNumber, prod: os.product, cliente: os.client?.businessName, estado: os.status, inicio: os.startDate?.slice(0,10), fin: os.endDate?.slice(0,10) },
      riesgo: riskLevel,
      alertas: (alerts ?? []).slice(0, 6).map((a: any) => `[${a.level}] ${a.titulo}`),
      proyecto: project ? { avance: `${Number(project.progressPercent).toFixed(0)}%`, estado: project.status } : null,
      actividades: activitySummary ? { total: activitySummary.total, done: activitySummary.done, prog: activitySummary.inProgress, bloq: activitySummary.blocked, venc: activitySummary.overdue } : null,
      predicciones: predictions ? { ritmo: predictions.ritmoActividadesSemana, finEst: predictions.fechaEstimadaFin?.slice(0,10), retraso: predictions.diasDeRetraso, exito: predictions.probabilidadExito } : null,
      cronograma: timeline ? { elapsed: timeline.daysElapsed, remaining: timeline.daysRemaining, timePct: timeline.timeProgressPercent } : null,
      modulos: (modules ?? []).slice(0, 15).map((m: any) => ({ n: m.name, pct: Math.round(m.progressPercent), h: m.health, bloq: m.activities.blocked, venc: m.activities.overdue })),
      visitas: visits ? { total: visits.total, cancel: visits.cancelled, prox: visits.upcoming } : null,
      tickets: tickets ? { total: tickets.total, devueltos: tickets.devueltos, alta: tickets.altaPrioridad } : null,
      retraso: delayAttribution ? { clientePct: delayAttribution.clientePct, implPct: delayAttribution.implementadorPct } : null,
    };
    return JSON.stringify(ctx);
  }

  async aiAnalyzeOs(companyId: string, osId: string): Promise<{ narrative: string; insights: string[]; nextActions: string[] }> {
    try {
      const alertData = await this.getAlerts(companyId, osId);
      const context = this.buildOsContext(alertData);

      const prompt = `Analiza esta orden de servicio de implementación HIS/ERP y responde SOLO con JSON válido (sin texto extra).

Datos: ${context}

JSON requerido (sin texto antes ni después):
{"narrative":"<párrafo ejecutivo 3-4 oraciones con datos concretos>","insights":["<hallazgo 1>","<hallazgo 2>","<hallazgo 3>","<hallazgo 4>","<hallazgo 5>"],"nextActions":["<acción 1>","<acción 2>","<acción 3>","<acción 4>"]}`;

      const text = await this.callGroq([{ role: 'user', content: prompt }], 1800);

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        this.logger.error(`AI no-json response: ${text.slice(0, 300)}`);
        throw new InternalServerErrorException('La IA no devolvió el formato esperado. Intenta de nuevo.');
      }

      let parsed: any;
      try { parsed = JSON.parse(match[0]); }
      catch (pe) {
        this.logger.error(`AI JSON parse error: ${String(pe)} | raw: ${match[0].slice(0, 200)}`);
        throw new InternalServerErrorException('Error procesando la respuesta de la IA. Intenta de nuevo.');
      }

      return {
        narrative:   String(parsed.narrative ?? ''),
        insights:    Array.isArray(parsed.insights)    ? parsed.insights.slice(0, 7)    : [],
        nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.slice(0, 5) : [],
      };
    } catch (e: any) {
      if (e instanceof InternalServerErrorException || e?.status) throw e;
      this.logger.error(`aiAnalyzeOs unexpected error: ${String(e?.message ?? e)}`);
      throw new InternalServerErrorException(`Error en análisis IA: ${String(e?.message ?? 'error desconocido')}`);
    }
  }

  async aiChatOs(
    companyId: string,
    osId: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ reply: string }> {
    try {
      const alertData = await this.getAlerts(companyId, osId);
      const context = this.buildOsContext(alertData);

      const systemPrompt = `Eres un consultor senior de implementaciones HIS/ERP. Responde directo, conciso y en español. Si algo no está en los datos, dilo.
OS data: ${context}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: message },
      ];

      const reply = await this.callGroq(messages, 700);
      return { reply: reply.trim() };
    } catch (e: any) {
      if (e instanceof InternalServerErrorException || e?.status) throw e;
      this.logger.error(`aiChatOs unexpected error: ${String(e?.message ?? e)}`);
      throw new InternalServerErrorException(`Error en chat IA: ${String(e?.message ?? 'error desconocido')}`);
    }
  }
}
