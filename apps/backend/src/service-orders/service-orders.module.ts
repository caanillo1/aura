import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServiceOrdersController } from './service-orders.controller';
import { PrintDataController } from './print-data.controller';
import { ServiceOrdersService } from './service-orders.service';
import { InformeSchedulerService } from './informe-scheduler.service';
import { MailModule } from '../mail/mail.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), MailModule, GatewayModule, NotificationsModule],
  controllers: [ServiceOrdersController, PrintDataController],
  providers: [ServiceOrdersService, InformeSchedulerService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
