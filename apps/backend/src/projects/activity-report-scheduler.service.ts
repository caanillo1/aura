import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';
import { SaveActivityScheduleDto } from './dto/project.dto';

export type ActivityScheduleConfig = SaveActivityScheduleDto;

const CONFIG_KEY = 'actividades_report_schedule';
const JOB_PREFIX = 'act_report_';

@Injectable()
export class ActivityReportSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ActivityReportSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
    private projectsService: ProjectsService,
  ) {}

  async onModuleInit() {
    const configs = await this.prisma.systemConfig.findMany({
      where: { configKey: CONFIG_KEY },
      select: { companyId: true, configValue: true },
    });
    for (const row of configs) {
      if (!row.configValue) continue;
      try {
        const cfg: ActivityScheduleConfig = JSON.parse(row.configValue);
        if (cfg.enabled && cfg.diasSemana.length && cfg.destinatarios.length) {
          this.registerCron(row.companyId, cfg);
        }
      } catch { /* config inválida */ }
    }
  }

  async getSchedule(companyId: string): Promise<ActivityScheduleConfig | null> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { companyId_configKey: { companyId, configKey: CONFIG_KEY } },
    });
    if (!row?.configValue) return null;
    try { return JSON.parse(row.configValue); } catch { return null; }
  }

  async saveSchedule(companyId: string, cfg: ActivityScheduleConfig): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where:  { companyId_configKey: { companyId, configKey: CONFIG_KEY } },
      create: { companyId, configKey: CONFIG_KEY, configValue: JSON.stringify(cfg), description: 'Automatización de reporte de actividades' },
      update: { configValue: JSON.stringify(cfg) },
    });
    this.removeCron(companyId);
    if (cfg.enabled && cfg.diasSemana.length && cfg.destinatarios.length) {
      this.registerCron(companyId, cfg);
    }
  }

  async runNow(companyId: string): Promise<{ enviados: number; destinatarios: number }> {
    const cfg = await this.getSchedule(companyId);
    return this.executeSend(companyId, cfg ?? { enabled: true, diasSemana: [], hora: 8, minuto: 0, status: ['completado','en_progreso','bloqueado'], destinatarios: [] });
  }

  // ── private ────────────────────────────────────────────────────────────────

  private registerCron(companyId: string, cfg: ActivityScheduleConfig) {
    const expr = `0 ${cfg.minuto} ${cfg.hora} * * ${cfg.diasSemana.join(',')}`;
    const tz   = 'America/Bogota';
    this.logger.log(`Cron actividades [${JOB_PREFIX}${companyId}]: "${expr}" timezone=${tz}`);
    // Timezone explícito para que la hora sea en Colombia, no UTC
    const job = new CronJob(expr, () => {
      this.logger.log(`Disparando envío automático actividades company=${companyId}`);
      this.executeSend(companyId, cfg).catch(err =>
        this.logger.error(`Error envío automático actividades company=${companyId}: ${err?.message}`),
      );
    }, null, false, tz);
    this.schedulerRegistry.addCronJob(`${JOB_PREFIX}${companyId}`, job);
    job.start();
    this.logger.log(`Próximo disparo: ${job.nextDate().toISO()}`);
  }

  private removeCron(companyId: string) {
    try { this.schedulerRegistry.deleteCronJob(`${JOB_PREFIX}${companyId}`); } catch { /* no existía */ }
  }

  private async executeSend(companyId: string, cfg: ActivityScheduleConfig): Promise<{ enviados: number; destinatarios: number }> {
    if (!cfg.destinatarios.length) return { enviados: 0, destinatarios: 0 };
    const now = new Date();
    // Fecha en Colombia (no UTC) para que "hoy" sea correcto a las 21:xx hora local
    const todayBogota = now.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
    const dayInBogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' })).getDay();
    const isSaturday  = dayInBogota === 6;

    let dateFrom = todayBogota;
    let dateTo   = todayBogota;

    if (isSaturday) {
      // Lunes de la semana actual → sábado (hoy)
      const bogotaMs  = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' })).getTime();
      const mondayMs  = bogotaMs - 5 * 24 * 60 * 60 * 1000;
      dateFrom = new Date(mondayMs).toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
    }

    this.logger.log(`executeSend company=${companyId} dateFrom=${dateFrom} dateTo=${dateTo} destinatarios=${cfg.destinatarios.length}`);

    return this.projectsService.sendActivitiesReport(companyId, {
      recipients: cfg.destinatarios,
      subject:    cfg.asunto,
      message:    cfg.mensaje,
      status:     cfg.status,
      dateFrom,
      dateTo,
    });
  }
}
