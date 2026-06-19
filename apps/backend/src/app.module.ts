import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { MunicipiosModule } from './municipios/municipios.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';
import { TemplatesModule } from './templates/templates.module';
import { ProjectsModule } from './projects/projects.module';
import { ActasModule } from './actas/actas.module';
import { RequerimientosModule } from './requerimientos/requerimientos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { ReportesModule } from './reportes/reportes.module';
import { QueuesModule } from './queues/queues.module';
import { GatewayModule } from './gateway/gateway.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    CompanyModule,
    UsersModule,
    ClientsModule,
    MunicipiosModule,
    ServiceOrdersModule,
    TemplatesModule,
    ProjectsModule,
    ActasModule,
    RequerimientosModule,
    DocumentosModule,
    ReportesModule,
    QueuesModule,
    GatewayModule,
    NotificationsModule,
    WhatsAppModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule {}
