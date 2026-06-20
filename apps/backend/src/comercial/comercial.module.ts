import { Module } from '@nestjs/common';
import { ComercialService } from './comercial.service';
import { ComercialController } from './comercial.controller';

@Module({
  controllers: [ComercialController],
  providers: [ComercialService],
})
export class ComercialModule {}
