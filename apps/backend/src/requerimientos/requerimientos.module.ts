import { Module } from '@nestjs/common';
import { RequerimientosService } from './requerimientos.service';
import { RequerimientosController } from './requerimientos.controller';
import { EmailSchedulerService } from './email-scheduler.service';
import { MailModule } from '../mail/mail.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MailModule, GatewayModule, NotificationsModule],
  controllers: [RequerimientosController],
  providers: [RequerimientosService, EmailSchedulerService],
})
export class RequerimientosModule {}
