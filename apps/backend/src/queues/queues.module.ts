import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './processors/notification.processor';
import { ReportProcessor } from './processors/report.processor';
import { QueueService } from './services/queue.service';
import { PrismaModule } from '../prisma/prisma.module';

export const NOTIFICATION_QUEUE = 'notifications';
export const REPORT_QUEUE      = 'reports';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host:     config.get('REDIS_HOST', 'localhost'),
          port:     config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') ?? undefined,
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 20,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: NOTIFICATION_QUEUE },
      { name: REPORT_QUEUE },
    ),
    PrismaModule,
  ],
  providers: [NotificationProcessor, ReportProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueuesModule {}
