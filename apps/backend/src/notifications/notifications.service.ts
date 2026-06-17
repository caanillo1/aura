import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EventsGateway } from '../gateway/events.gateway';

export interface NotifPayload {
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  /**
   * Persiste una notificación en BD y emite WebSocket a TODOS los agentes activos
   * de la empresa. Fire-and-forget — no bloquea el request principal.
   * Emite el objeto completo del registro (con id, isRead, createdAt) para que
   * el frontend pueda renderizarlo correctamente sin necesidad de re-fetch.
   */
  broadcastToAgents(companyId: string, payload: NotifPayload, gateway: EventsGateway): void {
    this.prisma.user
      .findMany({ where: { companyId, userType: 'agent' }, select: { id: true } })
      .then(users =>
        Promise.all(
          users.map(async u => {
            try {
              const notif = await this.create({ userId: u.id, ...payload });
              // Emitir el registro completo (no solo el payload) para que el frontend
              // tenga id, isRead y createdAt sin necesidad de recargar la lista
              gateway.emitToUser(u.id, 'notification:new', notif);
            } catch {
              // skip this user silently
            }
          }),
        ),
      )
      .catch(() => {});
  }
}
