import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SesionesController } from './sesiones.controller';
import { SesionesPublicController } from './sesiones.public.controller';
import { SesionesService } from './sesiones.service';
import { SesionesSchedulerService } from './sesiones-scheduler.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), MailModule],
  controllers: [SesionesController, SesionesPublicController],
  providers: [SesionesService, SesionesSchedulerService],
  exports: [SesionesService],
})
export class SesionesModule {}
