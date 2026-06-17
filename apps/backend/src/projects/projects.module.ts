import { Module } from '@nestjs/common';
import { ProjectsController, GenerateProjectController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [GatewayModule, NotificationsModule],
  controllers: [ProjectsController, GenerateProjectController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
