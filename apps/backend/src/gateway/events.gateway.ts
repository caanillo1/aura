import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AuthSocket extends Socket {
  userId?:    string;
  companyId?: string;
  role?:      string;
}

export interface ActivityUpdatePayload {
  activityId: string;
  progress:   number;
  status:     string;
  updatedBy:  string;
}

export interface DashboardUpdatePayload {
  type:    string;
  payload: unknown;
}

// ── Gateway ──────────────────────────────────────────────────────────────────

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin:      process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  /** Mapa clientId → { userId, companyId } para tracking */
  private connectedClients = new Map<string, { userId: string; companyId: string }>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.logger.log('🔌 Socket.IO Gateway iniciado en /ws');
  }

  // ── Conexión ─────────────────────────────────────────────────────────────

  async handleConnection(client: AuthSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.headers?.authorization as string | undefined)?.replace('Bearer ', '');

      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token) as {
        sub: string; companyId: string; role: string;
      };

      client.userId    = payload.sub;
      client.companyId = payload.companyId;
      client.role      = payload.role;

      // Rooms: empresa (multi-tenant) + usuario personal
      await client.join(`company:${payload.companyId}`);
      await client.join(`user:${payload.sub}`);

      this.connectedClients.set(client.id, {
        userId:    payload.sub,
        companyId: payload.companyId,
      });

      this.logger.log(
        `✓ Conectado [${client.id}] Usuario:${payload.sub} Empresa:${payload.companyId} Rol:${payload.role}`,
      );

      client.emit('connected', {
        message:   'Conectado a AURA en tiempo real',
        userId:    payload.sub,
        companyId: payload.companyId,
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`✗ Desconectado [${client.id}]`);
  }

  // ── Eventos del cliente ───────────────────────────────────────────────────

  @SubscribeMessage('project:join')
  async handleJoinProject(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { projectId: string },
  ) {
    await client.join(`project:${data.projectId}`);
    this.logger.debug(`[${client.id}] joined project:${data.projectId}`);
    return { event: 'project:joined', projectId: data.projectId };
  }

  @SubscribeMessage('project:leave')
  async handleLeaveProject(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { projectId: string },
  ) {
    await client.leave(`project:${data.projectId}`);
    return { event: 'project:left', projectId: data.projectId };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', timestamp: new Date().toISOString() };
  }

  // ── Emisión desde servicios ───────────────────────────────────────────────

  /** Emite a todos los usuarios de una empresa */
  emitToCompany(companyId: string, event: string, data: unknown) {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  /** Emite a un usuario específico */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Emite a todos los conectados a un proyecto */
  emitToProject(projectId: string, event: string, data: unknown) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  // ── Helpers de dominio ────────────────────────────────────────────────────

  notifyUser(userId: string, notification: {
    type: string; title: string; message: string;
    entityType?: string; entityId?: string;
  }) {
    this.emitToUser(userId, 'notification:new', notification);
  }

  activityUpdated(projectId: string, payload: ActivityUpdatePayload) {
    this.emitToProject(projectId, 'activity:updated', payload);
  }

  dashboardUpdate(companyId: string, payload: DashboardUpdatePayload) {
    this.emitToCompany(companyId, 'dashboard:update', payload);
  }

  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
