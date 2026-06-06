import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { REPORT_QUEUE } from '../queues.module';
import { ReportJobData } from '../services/queue.service';

@Processor(REPORT_QUEUE)
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('generate')
  async handleGenerate(job: Job<ReportJobData>) {
    const { reportId, projectId, type, recipients } = job.data;
    this.logger.log(`Generando informe [${type}] para proyecto ${projectId}...`);

    // Marcar como ejecutado
    await this.prisma.scheduledReport.update({
      where: { id: reportId },
      data:  { lastRunAt: new Date() },
    });

    // TODO F7: generar PDF/Excel/PPT y enviar por M365
    this.logger.log(
      `✓ Informe [${reportId}] generado. Destinatarios: ${recipients.join(', ')}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Reporte job #${job.id} falló (intento ${job.attemptsMade}): ${error.message}`,
    );
  }
}
