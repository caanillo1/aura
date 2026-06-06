import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_QUEUE } from '../queues.constants';
import { NotificationJobData } from '../services/queue.service';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('send')
  async handleSend(job: Job<NotificationJobData>) {
    const { userId, type, title, message, entityType, entityId } = job.data;

    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        entityType: entityType ?? null,
        entityId:   entityId   ?? null,
        isRead:     false,
      },
    });

    this.logger.log(`âœ“ NotificaciÃ³n [${type}] enviada a usuario ${userId}: "${title}"`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Job #${job.id} completado`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job #${job.id} fallÃ³ (intento ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
    );
  }
}


