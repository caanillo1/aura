import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceOrdersService } from './service-orders.service';

export interface WeeklyConfig {
  enabled: boolean;
  diaSemana: number;    // 0=Dom … 6=Sáb
  hora: number;
  minuto: number;
  destinatarios: string[];
  asunto?: string;
  reportType?: 'ejecutivo' | 'completo';
  lastSentAt?: string;
}

export interface BimensualConfig {
  enabled: boolean;
  hora: number;
  minuto: number;
  destinatarios: string[];
  asunto?: string;
  lastSentAt?: string;
}

const WEEKLY_PREFIX    = 'informe_weekly_';
const BIMENSUAL_PREFIX = 'informe_bimensual_';

@Injectable()
export class InformeSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InformeSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
    private svc: ServiceOrdersService,
  ) {}

  async onModuleInit() {
    const rows = await this.prisma.systemConfig.findMany({
      where: { configKey: { in: [WEEKLY_PREFIX, BIMENSUAL_PREFIX], startsWith: 'informe_' } as any },
      select: { companyId: true, configKey: true, configValue: true },
    });
    // Workaround: fetch both prefixes
    const allRows = await this.prisma.systemConfig.findMany({
      where: {
        OR: [
          { configKey: { startsWith: WEEKLY_PREFIX } },
          { configKey: { startsWith: BIMENSUAL_PREFIX } },
        ],
      },
      select: { companyId: true, configKey: true, configValue: true },
    });
    for (const row of allRows) {
      if (!row.configValue) continue;
      try {
        const osId = row.configKey.startsWith(WEEKLY_PREFIX)
          ? row.configKey.replace(WEEKLY_PREFIX, '')
          : row.configKey.replace(BIMENSUAL_PREFIX, '');
        const cfg = JSON.parse(row.configValue);
        if (!cfg.enabled) continue;
        if (row.configKey.startsWith(WEEKLY_PREFIX))    this.registerWeeklyCron(row.companyId, osId, cfg);
        if (row.configKey.startsWith(BIMENSUAL_PREFIX)) this.registerBimensualCrons(row.companyId, osId, cfg);
      } catch { /* config inválida */ }
    }
  }

  // ── Weekly ──────────────────────────────────────────────────────────────────

  async getWeeklyConfig(companyId: string, osId: string): Promise<WeeklyConfig | null> {
    return this.readConfig<WeeklyConfig>(companyId, `${WEEKLY_PREFIX}${osId}`);
  }

  async saveWeeklyConfig(companyId: string, osId: string, cfg: WeeklyConfig): Promise<{ message: string }> {
    const key = `${WEEKLY_PREFIX}${osId}`;
    await this.prisma.systemConfig.upsert({
      where:  { companyId_configKey: { companyId, configKey: key } },
      create: { companyId, configKey: key, configValue: JSON.stringify(cfg), description: `Auto semanal informe OS ${osId}` },
      update: { configValue: JSON.stringify(cfg) },
    });
    this.removeCron(`weekly_${osId}`);
    if (cfg.enabled && cfg.destinatarios.length > 0) this.registerWeeklyCron(companyId, osId, cfg);
    return { message: cfg.enabled ? 'Automatización semanal activada' : 'Automatización semanal desactivada' };
  }

  async runWeeklyNow(companyId: string, osId: string): Promise<{ message: string }> {
    const cfg = await this.getWeeklyConfig(companyId, osId);
    if (!cfg?.destinatarios?.length) throw new Error('No hay configuración semanal guardada');
    await this.executeWeeklySend(companyId, osId, cfg);
    return { message: 'Correo semanal enviado correctamente' };
  }

  // ── Bi-monthly ───────────────────────────────────────────────────────────────

  async getBimensualConfig(companyId: string, osId: string): Promise<BimensualConfig | null> {
    return this.readConfig<BimensualConfig>(companyId, `${BIMENSUAL_PREFIX}${osId}`);
  }

  async saveBimensualConfig(companyId: string, osId: string, cfg: BimensualConfig): Promise<{ message: string }> {
    const key = `${BIMENSUAL_PREFIX}${osId}`;
    await this.prisma.systemConfig.upsert({
      where:  { companyId_configKey: { companyId, configKey: key } },
      create: { companyId, configKey: key, configValue: JSON.stringify(cfg), description: `Auto bimensual informe OS ${osId}` },
      update: { configValue: JSON.stringify(cfg) },
    });
    this.removeCron(`bimensual_15_${osId}`);
    this.removeCron(`bimensual_lastday_${osId}`);
    if (cfg.enabled && cfg.destinatarios.length > 0) this.registerBimensualCrons(companyId, osId, cfg);
    return { message: cfg.enabled ? 'Automatización bimensual activada' : 'Automatización bimensual desactivada' };
  }

  async runBimensualNow(companyId: string, osId: string, period: 'quincenal' | 'mensual'): Promise<{ message: string }> {
    const cfg = await this.getBimensualConfig(companyId, osId);
    if (!cfg?.destinatarios?.length) throw new Error('No hay configuración bimensual guardada');
    await this.executeBimensualSend(companyId, osId, cfg, period);
    return { message: 'Informe PDF enviado correctamente' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async readConfig<T>(companyId: string, configKey: string): Promise<T | null> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { companyId_configKey: { companyId, configKey } },
    });
    if (!row?.configValue) return null;
    try { return JSON.parse(row.configValue) as T; } catch { return null; }
  }

  private registerWeeklyCron(companyId: string, osId: string, cfg: WeeklyConfig) {
    const expr    = `0 ${cfg.minuto} ${cfg.hora} * * ${cfg.diaSemana}`;
    const jobName = `weekly_${osId}`;
    this.logger.log(`Cron semanal [${jobName}]: ${expr}`);
    const job = new CronJob(expr, () => {
      this.executeWeeklySend(companyId, osId, cfg).catch(err =>
        this.logger.error(`Error cron semanal osId=${osId}: ${err?.message}`),
      );
    });
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
  }

  private registerBimensualCrons(companyId: string, osId: string, cfg: BimensualConfig) {
    const m = cfg.minuto, h = cfg.hora;

    // 15th of every month → first-half report (days 1–15)
    const job15 = new CronJob(`0 ${m} ${h} 15 * *`, () => {
      this.executeBimensualSend(companyId, osId, cfg, 'quincenal').catch(err =>
        this.logger.error(`Error cron 15 osId=${osId}: ${err?.message}`),
      );
    });
    this.schedulerRegistry.addCronJob(`bimensual_15_${osId}`, job15);
    job15.start();

    // Last day of month (fire on 28–31, check inside if truly last day)
    const jobLast = new CronJob(`0 ${m} ${h} 28-31 * *`, () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDate() !== 1) return; // not the last day
      this.executeBimensualSend(companyId, osId, cfg, 'mensual').catch(err =>
        this.logger.error(`Error cron último día osId=${osId}: ${err?.message}`),
      );
    });
    this.schedulerRegistry.addCronJob(`bimensual_lastday_${osId}`, jobLast);
    jobLast.start();

    this.logger.log(`Crons bimensuales registrados para osId=${osId} a las ${h}:${String(m).padStart(2,'0')}`);
  }

  private removeCron(jobName: string) {
    try { this.schedulerRegistry.deleteCronJob(jobName); } catch { /* no existía */ }
  }

  private async executeWeeklySend(companyId: string, osId: string, cfg: WeeklyConfig) {
    const endDate   = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 86_400_000);
    this.logger.log(`Envío semanal osId=${osId}: ${startDate.toDateString()} → ${endDate.toDateString()}`);
    await this.svc.sendWeeklyActivities(companyId, osId, {
      destinatarios: cfg.destinatarios,
      asunto: cfg.asunto,
      startDate, endDate,
      reportType: cfg.reportType ?? 'ejecutivo',
    });
    await this.updateLastSent(companyId, `${WEEKLY_PREFIX}${osId}`, cfg);
  }

  private async executeBimensualSend(
    companyId: string,
    osId: string,
    cfg: BimensualConfig,
    period: 'quincenal' | 'mensual',
  ) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (period === 'quincenal') {
      // Days 1–15 of current month
      startDate   = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate     = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
      periodLabel = `1–15 de ${now.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}`;
    } else {
      // Full month (day 1 to last day)
      startDate   = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      periodLabel = now.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
    }

    this.logger.log(`Envío bimensual [${period}] osId=${osId}: ${periodLabel}`);
    await this.svc.sendPeriodReport(companyId, osId, {
      destinatarios: cfg.destinatarios,
      asunto: cfg.asunto,
      startDate, endDate, periodLabel, period,
    });
    await this.updateLastSent(companyId, `${BIMENSUAL_PREFIX}${osId}`, cfg);
  }

  private async updateLastSent(companyId: string, configKey: string, cfg: any) {
    const updated = { ...cfg, lastSentAt: new Date().toISOString() };
    await this.prisma.systemConfig.update({
      where: { companyId_configKey: { companyId, configKey } },
      data:  { configValue: JSON.stringify(updated) },
    });
  }
}
