import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const QUERY_TIMEOUT_MS = 30_000; // individual query limit

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['warn', 'error'],
    });

    // Abort any single query that takes longer than QUERY_TIMEOUT_MS.
    // This releases the connection slot back to the pool so other requests
    // are not starved while a slow query blocks indefinitely.
    (this as any).$use(async (params: any, next: (p: any) => Promise<any>) => {
      const timer = setTimeout(() => {
        this.logger.warn(
          `[Prisma] Query timeout (${QUERY_TIMEOUT_MS}ms): ${params.model}.${params.action}`,
        );
      }, QUERY_TIMEOUT_MS);
      try {
        return await next(params);
      } finally {
        clearTimeout(timer);
      }
    });
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
