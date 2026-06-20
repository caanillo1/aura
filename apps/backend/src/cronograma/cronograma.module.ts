import { Module } from '@nestjs/common';
import { CronogramaService } from './cronograma.service';
import { CronogramaController } from './cronograma.controller';

@Module({
  controllers: [CronogramaController],
  providers: [CronogramaService],
})
export class CronogramaModule {}
