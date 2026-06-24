import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { RequerimientosService } from './requerimientos.service';

export interface EmailScheduleConfig {
  enabled: boolean;
  diasSemana: number[];   // 0=Dom 1=Lun ... 6=Sáb
  hora: number;
  minuto: number;
  estados: string[];
  destinatarios: string[];
  asunto?: string;
  mensaje?: string;
  area?: string;
  prioridad?: string;
}

const CONFIG_KEY = 'email_auto_schedule';
const JOB_PREFIX = 'email_schedule_';

@Injectable()
export class EmailSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(EmailSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
    private requerimientosService: RequerimientosService,
  ) {}

  async onModuleInit() {
    // Cargar y registrar schedules de todas las empresas al iniciar
    const configs = await this.prisma.systemConfig.findMany({
      where: { configKey: CONFIG_KEY },
      select: { companyId: true, configValue: true },
    });
    for (const row of configs) {
      if (row.configValue) {
        try {
          const cfg: EmailScheduleConfig = JSON.parse(row.configValue);
          if (cfg.enabled) this.registerCron(row.companyId, cfg);
        } catch { /* config inválida */ }
      }
    }
  }

  async getSchedule(companyId: string): Promise<EmailScheduleConfig | null> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { companyId_configKey: { companyId, configKey: CONFIG_KEY } },
    });
    if (!row?.configValue) return null;
    try { return JSON.parse(row.configValue); } catch { return null; }
  }

  async saveSchedule(companyId: string, cfg: EmailScheduleConfig): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where:  { companyId_configKey: { companyId, configKey: CONFIG_KEY } },
      create: { companyId, configKey: CONFIG_KEY, configValue: JSON.stringify(cfg), description: 'Automatización de envío de correos de requerimientos' },
      update: { configValue: JSON.stringify(cfg) },
    });

    // Quitar job anterior si existe
    this.removeCron(companyId);

    if (cfg.enabled && cfg.diasSemana.length > 0 && cfg.destinatarios.length > 0) {
      this.registerCron(companyId, cfg);
    }
  }

  async runNow(companyId: string): Promise<{ enviados: number; destinatarios: number }> {
    const cfg = await this.getSchedule(companyId);
    if (!cfg) throw new Error('No hay configuración de automatización');
    return this.executeScheduledSend(companyId, cfg);
  }

  // ── privados ────────────────────────────────────────────────────────────────

  private registerCron(companyId: string, cfg: EmailScheduleConfig) {
    const cronExpr = this.buildCronExpression(cfg);
    const tz       = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.logger.log(`Registrando cron [${JOB_PREFIX}${companyId}]: ${cronExpr} timezone=${tz}`);
    const job = new CronJob(cronExpr, () => {
      this.executeScheduledSend(companyId, cfg).catch(err =>
        this.logger.error(`Error en envío automático company=${companyId}: ${err?.message}`),
      );
    }, null, false, tz);
    this.schedulerRegistry.addCronJob(`${JOB_PREFIX}${companyId}`, job);
    job.start();
  }

  private removeCron(companyId: string) {
    const name = `${JOB_PREFIX}${companyId}`;
    try {
      this.schedulerRegistry.deleteCronJob(name);
      this.logger.log(`CronJob ${name} eliminado`);
    } catch { /* no existía */ }
  }

  private buildCronExpression(cfg: EmailScheduleConfig): string {
    const dias = cfg.diasSemana.join(',');
    return `0 ${cfg.minuto} ${cfg.hora} * * ${dias}`;
  }

  private async executeScheduledSend(
    companyId: string,
    cfg: EmailScheduleConfig,
  ): Promise<{ enviados: number; destinatarios: number }> {
    this.logger.log(`Ejecutando envío automático company=${companyId}`);
    return this.requerimientosService.enviarCorreo(companyId, {
      destinatarios:  cfg.destinatarios,
      asunto:         cfg.asunto,
      mensaje:        cfg.mensaje,
      area:           cfg.area || undefined,
      prioridad:      cfg.prioridad || undefined,
      estadosActual:  cfg.estados.length > 0 ? cfg.estados : undefined,
    });
  }
}
