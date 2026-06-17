import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';

@ApiTags('Print')
@Controller('print-data')
export class PrintDataController {
  constructor(private readonly svc: ServiceOrdersService) {}

  @Get()
  getPrintData(@Query('token') token: string) {
    if (!token) throw new NotFoundException('Token requerido');
    const data = this.svc.retrievePrintData(token);
    if (!data) throw new NotFoundException('Token de impresión inválido o expirado');
    return data;
  }
}
