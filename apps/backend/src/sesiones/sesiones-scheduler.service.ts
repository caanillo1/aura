import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SesionesService } from './sesiones.service';

@Injectable()
export class SesionesSchedulerService {
  private readonly logger = new Logger(SesionesSchedulerService.name);

  constructor(private sesionesService: SesionesService) {}

  // Cada 15 minutos
  @Cron('0 */15 * * * *')
  async handleRecordatorios() {
    try {
      await this.sesionesService.enviarRecordatorios24h();
      await this.sesionesService.enviarRecordatorios1h();
    } catch (err: any) {
      this.logger.error(`Error en cron de recordatorios: ${err?.message}`);
    }
  }
}
