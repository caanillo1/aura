import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProjectsController, GenerateProjectController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ActivityReportSchedulerService } from './activity-report-scheduler.service';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), MailModule, GatewayModule, NotificationsModule],
  controllers: [ProjectsController, GenerateProjectController],
  providers: [ProjectsService, ActivityReportSchedulerService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
