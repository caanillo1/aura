import { Module } from '@nestjs/common';
import { ActasController } from './actas.controller';
import { PublicActasController } from './public-actas.controller';
import { ActasService } from './actas.service';
import { MailModule } from '../mail/mail.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MailModule, GatewayModule, NotificationsModule],
  controllers: [ActasController, PublicActasController],
  providers: [ActasService],
  exports: [ActasService],
})
export class ActasModule {}
