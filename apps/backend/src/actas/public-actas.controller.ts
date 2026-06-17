import { Controller, Get, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActasService } from './actas.service';

@ApiTags('Public - Firmas')
@Controller('public/actas')
export class PublicActasController {
  constructor(private readonly svc: ActasService) {}

  @Get('pendientes')
  @ApiOperation({ summary: 'Buscar actas pendientes por número de documento (sin auth)' })
  @ApiQuery({ name: 'documento', required: true })
  getPendientes(@Query('documento') documento: string) {
    if (!documento?.trim()) throw new BadRequestException('El número de documento es requerido');
    return this.svc.searchPendingByDocumento(documento.trim());
  }

  @Get('firmantes/:id/acta')
  @ApiOperation({ summary: 'Obtener acta completa para preview (sin auth)' })
  getActaFull(@Param('id') id: string) {
    return this.svc.getPublicActaFull(id);
  }

  @Get('firmantes/:id')
  @ApiOperation({ summary: 'Obtener datos de firmante para portal de firma (sin auth)' })
  getFirmante(@Param('id') id: string) {
    return this.svc.getPublicFirmante(id);
  }

  @Patch('firmantes/:id/sign')
  @ApiOperation({ summary: 'Firmar digitalmente desde portal cliente (sin auth)' })
  signPublic(@Param('id') id: string, @Body() body: { signatureData: string; comprendio?: boolean }) {
    return this.svc.signFirmante(id, body.signatureData, 'client', body.comprendio);
  }
}
