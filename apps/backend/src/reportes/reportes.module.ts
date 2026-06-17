import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
