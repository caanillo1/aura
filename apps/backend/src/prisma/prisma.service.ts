import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const QUERY_TIMEOUT_MS = 30_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private reconnecting = false;
  private reconnectPromise: Promise<void> | null = null;

  constructor() {
    super({ log: ['warn', 'error'] });

    (this as any).$use(async (params: any, next: (p: any) => Promise<any>) => {
      const timer = setTimeout(() => {
        this.logger.warn(`[Prisma] Query timeout (${QUERY_TIMEOUT_MS}ms): ${params.model}.${params.action}`);
      }, QUERY_TIMEOUT_MS);
      try {
        return await next(params);
      } catch (err: any) {
        // P1001 = can't reach DB, P1002 = timeout connecting
        if (err?.code === 'P1001' || err?.code === 'P1002') {
          this.scheduleReconnect();
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.reconnectPromise = (async () => {
      try {
        this.logger.warn('BD desconectada – reconectando en 3 s…');
        await new Promise((r) => setTimeout(r, 3000));
        await this.$disconnect();
        await this.$connect();
        this.logger.log('BD reconectada ✓');
      } catch (err) {
        this.logger.error('Reconexión fallida:', (err as Error).message);
        // reintenta en 10 s
        setTimeout(() => this.scheduleReconnect(), 10_000);
      } finally {
        this.reconnecting = false;
        this.reconnectPromise = null;
      }
    })();
  }

  async onModuleInit() {
    const maxRetries = 5;
    const delayMs    = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected ✓');
        return;
      } catch (err) {
        this.logger.warn(`Intento ${attempt}/${maxRetries} fallido: ${(err as Error).message}`);
        if (attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected ✓');
  }
}
