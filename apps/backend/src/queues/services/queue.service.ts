import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { NOTIFICATION_QUEUE, REPORT_QUEUE } from '../queues.constants';

export interface NotificationJobData {
  userId:      string;
  companyId:   string;
  type:        string;
  title:       string;
  message:     string;
  entityType?: string;
  entityId?:   string;
}

export interface ReportJobData {
  reportId:      string;
  projectId:     string;
  companyId:     string;
  type:          'weekly' | 'biweekly' | 'monthly';
  recipients:    string[];
  generatedById: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
    @InjectQueue(REPORT_QUEUE)       private readonly reportQueue: Queue,
  ) {}

  // â”€â”€ Notificaciones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async sendNotification(data: NotificationJobData) {
    const job = await this.notificationQueue.add('send', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    this.logger.debug(`NotificaciÃ³n encolada [job:${job.id}] para usuario ${data.userId}`);
    return job;
  }

  async sendBulkNotifications(notifications: NotificationJobData[]) {
    const jobs = notifications.map(data => ({ name: 'send', data }));
    return this.notificationQueue.addBulk(jobs);
  }

  // â”€â”€ Reportes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async scheduleReport(data: ReportJobData, delayMs?: number) {
    const job = await this.reportQueue.add('generate', data, {
      delay:    delayMs,
      attempts: 2,
      backoff:  { type: 'fixed', delay: 5000 },
    });
    this.logger.debug(`Reporte encolado [job:${job.id}] tipo ${data.type} proyecto ${data.projectId}`);
    return job;
  }

  // â”€â”€ Estado de colas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getQueueStatus() {
    const [nActive, nWaiting, nFailed, rActive, rWaiting, rFailed] = await Promise.all([
      this.notificationQueue.getActiveCount(),
      this.notificationQueue.getWaitingCount(),
      this.notificationQueue.getFailedCount(),
      this.reportQueue.getActiveCount(),
      this.reportQueue.getWaitingCount(),
      this.reportQueue.getFailedCount(),
    ]);
    return {
      notifications: { active: nActive, waiting: nWaiting, failed: nFailed },
      reports:       { active: rActive, waiting: rWaiting, failed: rFailed },
    };
  }

  async cleanQueues() {
    await Promise.all([
      this.notificationQueue.clean(0, 'completed'),
      this.reportQueue.clean(0, 'completed'),
    ]);
  }
}


